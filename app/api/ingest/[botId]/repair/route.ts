import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ELKEN_BOT_ID } from '@/lib/tenants/elken/config'
import { parseElkenFilename } from '@/lib/tenants/elken/kb/product-resolver'

export const maxDuration = 30

/**
 * POST /api/ingest/[botId]/repair
 *
 * 1. Finds documents stuck in "processing" for > 30s with actual chunks → marks ready.
 * 2. For Elken docs that are ready but missing brochure_url → backfills it from storage.
 * Called by the knowledge page polling loop.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // ── 1. Repair stuck "processing" docs ──────────────────────────────────────
  const cutoff = new Date(Date.now() - 30_000).toISOString()
  const { data: stuckDocs } = await service
    .from('documents')
    .select('id, file_path, filename')
    .eq('bot_id', botId)
    .eq('status', 'processing')
    .lt('updated_at', cutoff)

  let repaired = 0

  for (const doc of stuckDocs ?? []) {
    const { count } = await service
      .from('chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', doc.id)
      .eq('bot_id', botId)

    const chunkCount = count ?? 0
    if (chunkCount === 0) continue

    const updates: Record<string, unknown> = { status: 'ready', chunk_count: chunkCount }

    // For Elken: also populate brochure_url and title if missing
    if (botId === ELKEN_BOT_ID) {
      const { data: urlData } = service.storage
        .from('bot-files')
        .getPublicUrl(doc.file_path)
      if (urlData?.publicUrl) updates.brochure_url = urlData.publicUrl

      const parsed = parseElkenFilename(doc.filename)
      if (parsed) updates.title = parsed.productName
    }

    await service
      .from('documents')
      .update(updates)
      .eq('id', doc.id)
      .eq('bot_id', botId)
    repaired++
  }

  // ── 2. Backfill brochure_url for Elken ready docs that are missing it ─────
  let backfilled = 0

  if (botId === ELKEN_BOT_ID) {
    const { data: missingBrochure } = await service
      .from('documents')
      .select('id, file_path, filename')
      .eq('bot_id', botId)
      .eq('status', 'ready')
      .is('brochure_url', null)

    for (const doc of missingBrochure ?? []) {
      const { data: urlData } = service.storage
        .from('bot-files')
        .getPublicUrl(doc.file_path)
      if (!urlData?.publicUrl) continue

      const parsed = parseElkenFilename(doc.filename)
      await service
        .from('documents')
        .update({
          brochure_url: urlData.publicUrl,
          ...(parsed ? { title: parsed.productName } : {}),
        })
        .eq('id', doc.id)
        .eq('bot_id', botId)
      backfilled++
    }
  }

  console.log(`[repair] botId=${botId} repaired=${repaired} backfilled=${backfilled}`)
  return Response.json({ repaired, backfilled, checked: (stuckDocs ?? []).length })
}
