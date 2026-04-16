import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 30

/**
 * POST /api/ingest/[botId]/repair
 *
 * Finds documents stuck in "processing" for > 90 seconds and checks whether
 * chunks actually exist for them in the DB. If they do, sets status to "ready"
 * with the real chunk count. Called by the knowledge page polling loop.
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

  // Find docs stuck in "processing" for more than 30 seconds
  const cutoff = new Date(Date.now() - 30_000).toISOString()
  const { data: stuckDocs, error: fetchError } = await service
    .from('documents')
    .select('id')
    .eq('bot_id', botId)
    .eq('status', 'processing')
    .lt('updated_at', cutoff)

  if (fetchError || !stuckDocs?.length) {
    return Response.json({ repaired: 0 })
  }

  let repaired = 0

  for (const doc of stuckDocs) {
    // Count actual chunks in DB for this document
    const { count } = await service
      .from('chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', doc.id)
      .eq('bot_id', botId)

    const chunkCount = count ?? 0

    if (chunkCount > 0) {
      await service
        .from('documents')
        .update({ status: 'ready', chunk_count: chunkCount })
        .eq('id', doc.id)
        .eq('bot_id', botId)
      repaired++
    }
  }

  return Response.json({ repaired, checked: stuckDocs.length })
}
