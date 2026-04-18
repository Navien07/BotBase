// app/api/bookings/[botId]/[id]/no-show/route.ts — Mark booking as no-show

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  try {
    const serviceClient = createServiceClient()

    const { data: current, error: fetchError } = await serviceClient
      .from('bookings')
      .select('id, audit_log, bot_id')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (fetchError || !current) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    const currentAuditLog = Array.isArray(current.audit_log) ? current.audit_log : []
    const auditEntry = {
      action: 'no_show',
      agent_id: user.id,
      timestamp: new Date().toISOString(),
      note: null,
    }

    const { data: booking, error } = await serviceClient
      .from('bookings')
      .update({
        status: 'no_show',
        audit_log: [...currentAuditLog, auditEntry],
      })
      .eq('id', id)
      .eq('bot_id', botId)
      .select('*')
      .single()

    if (error) throw error

    return Response.json({ booking })
  } catch (error) {
    console.error('[booking no-show POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
