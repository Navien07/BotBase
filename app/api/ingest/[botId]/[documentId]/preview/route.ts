import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/ingest/[botId]/[documentId]/preview
// Returns a short-lived signed download URL for the file
export async function GET(
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
    const { data: doc, error: fetchError } = await service
      .from('documents')
      .select('file_path, category, mime_type, filename')
      .eq('id', documentId)
      .eq('bot_id', botId)
      .single()

    if (fetchError || !doc) {
      return Response.json({ error: 'Document not found' }, { status: 404 })
    }

    if (doc.category === 'url' || !doc.file_path) {
      return Response.json({ error: 'No file to preview' }, { status: 400 })
    }

    const { data, error: signError } = await service.storage
      .from('bot-files')
      .createSignedUrl(doc.file_path, 300) // 5-minute URL

    if (signError || !data) {
      throw signError ?? new Error('Failed to create signed URL')
    }

    return Response.json({ url: data.signedUrl, mimeType: doc.mime_type, filename: doc.filename })
  } catch (error) {
    console.error('[document preview GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    )
  }
}
