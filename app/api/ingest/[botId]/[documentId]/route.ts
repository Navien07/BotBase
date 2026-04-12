import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// DELETE /api/ingest/[botId]/[documentId]
// Removes document from DB, its chunks, and the file from Storage
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string; documentId: string }> }
) {
  const { botId, documentId } = await params

  if (!botId || !documentId) {
    return Response.json({ error: 'Missing params' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  try {
    // 1. Fetch the document to get file_path
    const { data: doc, error: fetchError } = await service
      .from('documents')
      .select('id, file_path, category')
      .eq('id', documentId)
      .eq('bot_id', botId)
      .single()

    if (fetchError || !doc) {
      return Response.json({ error: 'Document not found' }, { status: 404 })
    }

    // 2. Delete chunks first (in case no cascade)
    await service
      .from('chunks')
      .delete()
      .eq('document_id', documentId)
      .eq('bot_id', botId)

    // 3. Delete document record
    const { error: deleteError } = await service
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('bot_id', botId)

    if (deleteError) throw deleteError

    // 4. Delete from Storage (file-based docs only)
    if (doc.category !== 'url' && doc.file_path) {
      await service.storage.from('bot-files').remove([doc.file_path])
      // ignore storage errors — DB record is already gone
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('[document DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    )
  }
}

// GET /api/ingest/[botId]/[documentId]/preview — handled in preview/route.ts
