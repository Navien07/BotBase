import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    // Fetch current script
    const { data: script, error: fetchError } = await service
      .from('bot_scripts')
      .select('*')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (fetchError || !script) return Response.json({ error: 'Script not found' }, { status: 404 })

    const newVersion = (script.version as number) + 1

    // Insert version snapshot
    await service.from('bot_script_versions').insert({
      script_id: id,
      bot_id: botId,
      version: newVersion,
      flow_data: script.flow_data,
      published_by: user.id,
    })

    // Update script: bump version, set is_active, set published_at
    const { data: updated, error: updateError } = await service
      .from('bot_scripts')
      .update({
        version: newVersion,
        is_active: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('bot_id', botId)
      .select()
      .single()

    if (updateError) throw updateError
    return Response.json({ script: updated, version: newVersion })
  } catch (error) {
    console.error('[script publish POST]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
