import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const ids = url.searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  if (!ids.length) return Response.json({ documents: [] })

  const service = createServiceClient()
  const { data: docs } = await service
    .from('documents')
    .select('id, title, file_path')
    .in('id', ids)
    .eq('bot_id', botId)
    .ilike('file_path', '%.pdf')

  if (!docs?.length) return Response.json({ documents: [] })

  const results: { id: string; title: string; url: string }[] = []
  for (const doc of docs) {
    const { data } = await service.storage
      .from('bot-files')
      .createSignedUrl(doc.file_path as string, 3600)
    if (data?.signedUrl) {
      results.push({ id: doc.id as string, title: (doc.title as string) || 'Product Brochure', url: data.signedUrl })
    }
  }

  return Response.json({ documents: results })
}
