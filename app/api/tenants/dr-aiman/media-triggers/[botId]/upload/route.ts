import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'
import { rateLimit } from '@/lib/security/rate-limit'
import { logAudit } from '@/lib/audit/logger'
import {
  DR_AIMAN_BOT_ID,
  TRIGGER_VALUES,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/lib/tenants/dr-aiman/media-triggers/config'

// ─── Magic byte detection ─────────────────────────────────────────────────────
// Validates the actual file contents, not the client-supplied Content-Type.
// SVGs and polyglot files are rejected because they have no matching magic bytes.

function detectMimeFromMagicBytes(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png'
  }
  // WebP: RIFF????WEBP (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

// ─── POST /api/tenants/dr-aiman/media-triggers/[botId]/upload ─────────────────
// Accepts: multipart/form-data with fields:
//   file           File   required — JPEG, PNG, or WebP, max 5MB
//   trigger_value  string required — "skeptical" | "confirmed"
//   caption        string optional

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  // Gate: Dr. Aiman bot only
  if (botId !== DR_AIMAN_BOT_ID) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 10 uploads/min (heavyweight — sharp re-encode + storage I/O)
  const rl = await rateLimit(user.id, { max: 10, windowMs: 60_000 })
  if (!rl.allowed) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

  // Bot access check
  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck
  const { tenantId } = accessCheck

  // Parse form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const triggerRaw = formData.get('trigger_value')
  const captionRaw = formData.get('caption')

  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Missing file' }, { status: 400 })
  }
  if (!triggerRaw || typeof triggerRaw !== 'string') {
    return Response.json({ error: 'Missing trigger_value' }, { status: 400 })
  }
  if (!(TRIGGER_VALUES as readonly string[]).includes(triggerRaw)) {
    return Response.json(
      { error: `trigger_value must be one of: ${TRIGGER_VALUES.join(', ')}` },
      { status: 400 }
    )
  }
  const triggerValue = triggerRaw as typeof TRIGGER_VALUES[number]
  const caption = typeof captionRaw === 'string' && captionRaw.length > 0
    ? captionRaw
    : null

  // File size check (client-side pre-check does not substitute for server validation)
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return Response.json(
      { error: `File exceeds maximum size of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB` },
      { status: 400 }
    )
  }

  // Read buffer and validate via magic bytes — rejects SVGs, polyglots, renamed files
  const arrayBuffer = await file.arrayBuffer()
  const inputBuffer = Buffer.from(arrayBuffer)

  if (inputBuffer.length < 12) {
    return Response.json({ error: 'File too small to be a valid image' }, { status: 400 })
  }

  const detectedMime = detectMimeFromMagicBytes(inputBuffer)
  if (!detectedMime || !(ALLOWED_MIME_TYPES as readonly string[]).includes(detectedMime)) {
    return Response.json(
      { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
      { status: 400 }
    )
  }

  try {
    // Re-encode via Sharp:
    // .rotate() — auto-orients using EXIF orientation tag, then strips the EXIF tag.
    //             Prevents sideways images on Telegram (common with phone camera uploads).
    // .toBuffer() — re-encodes in the same format; Sharp 0.34+ strips remaining
    //               metadata (EXIF, XMP, IPTC) by default during re-encode.
    const cleanedBuffer = await sharp(inputBuffer)
      .rotate()
      .toBuffer()

    // Generate storage path
    const uuid = randomUUID()
    const ext = extForMime(detectedMime)
    const storagePath = `${botId}/media-triggers/${uuid}.${ext}`

    const serviceClient = createServiceClient()

    // Upload to bot-files bucket
    const { error: uploadError } = await serviceClient
      .storage
      .from('bot-files')
      .upload(storagePath, cleanedBuffer, {
        contentType: detectedMime,
        upsert: false,
      })
    if (uploadError) throw uploadError

    // Insert DB row via atomic RPC — COALESCE(MAX(display_order), 0) + 1
    // computed inside the INSERT...SELECT, narrower race window than two-step JS approach
    const { data: newId, error: insertError } = await serviceClient
      .rpc('insert_media_trigger', {
        p_bot_id: botId,
        p_trigger_value: triggerValue,
        p_storage_path: storagePath,
        p_mime_type: detectedMime,
        p_file_size_bytes: cleanedBuffer.length,
        p_caption: caption,
        p_uploaded_by: user.id,
      })
    if (insertError) {
      // Clean up orphaned storage object on DB insert failure
      await serviceClient.storage.from('bot-files').remove([storagePath])
      throw insertError
    }

    // Signed preview URL for immediate use in the upload response
    const { data: signed } = await serviceClient
      .storage
      .from('bot-files')
      .createSignedUrl(storagePath, 3600)

    // Audit log — fire and forget, never block the response
    logAudit({
      action: 'media_trigger_uploaded',
      botId,
      tenantId,
      userId: user.id,
      metadata: {
        trigger_value: triggerValue,
        storage_path: storagePath,
        mime_type: detectedMime,
        file_size_bytes: cleanedBuffer.length,
      },
    }).catch(console.error)

    return Response.json(
      {
        id: newId as string,
        storage_path: storagePath,
        signed_preview_url: signed?.signedUrl ?? null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[dr-aiman/upload POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
