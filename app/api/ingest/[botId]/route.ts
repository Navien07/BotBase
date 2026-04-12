import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 60

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
] as const

const IngestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[ingest] called', { botId, body })

  const parsed = IngestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { filename, mimeType, fileSize } = parsed.data

  try {
    const service = createServiceClient()

    // Pre-generate document ID to use in the storage path
    const documentId = crypto.randomUUID()
    const storagePath = `${botId}/${documentId}/${filename}`

    // Create document record
    const { data: insertData, error: insertError } = await service.from('documents').insert({
      id: documentId,
      bot_id: botId,
      filename,
      file_path: storagePath,
      file_size: fileSize,
      mime_type: mimeType,
      category: 'upload',
      ingest_mode: 'chunks',
      status: 'pending',
      chunk_count: 0,
    }).select('id')

    console.error('[ingest] step: doc insert', { data: insertData, error: insertError })

    if (insertError) {
      return Response.json({ error: 'Failed to create document record' }, { status: 500 })
    }

    // Generate signed upload URL (1h expiry default)
    const { data: signedData, error: signedError } = await service.storage
      .from('bot-files')
      .createSignedUploadUrl(storagePath)

    console.error('[ingest] step: storage url', { data: signedData, error: signedError })

    if (signedError || !signedData) {
      // Clean up orphaned record
      await service.from('documents').delete().eq('id', documentId)
      return Response.json(
        { error: `Failed to create upload URL: ${signedError?.message ?? 'unknown storage error'}` },
        { status: 500 }
      )
    }

    return Response.json({
      documentId,
      signedUrl: signedData.signedUrl,
      token: signedData.token,
      path: storagePath,
    })
  } catch (error) {
    console.error('[ingest] step: uncaught exception', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
