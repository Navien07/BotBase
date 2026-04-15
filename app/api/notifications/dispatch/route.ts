// POST /api/notifications/dispatch
// Called by n8n Schedule Trigger daily at 02:00 UTC (10:00 AM MYT)
// Also callable manually for testing

import { createServiceClient } from '@/lib/supabase/service'
import { sendMessage } from '@/lib/channels/dispatcher'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  // Process window: anything due in the last 25 hours (handles missed runs)
  const windowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000)

  const { data: notifications, error } = await supabase
    .from('pending_notifications')
    .select('*')
    .lte('scheduled_for', now.toISOString())
    .gte('scheduled_for', windowStart.toISOString())
    .is('sent_at', null)
    .is('failed_at', null)
    .lt('retry_count', 3)
    .order('scheduled_for', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[NotificationDispatch] DB error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!notifications?.length) {
    return NextResponse.json({ dispatched: 0, message: 'No notifications due' })
  }

  let dispatched = 0
  let failed = 0

  for (const notification of notifications) {
    try {
      // Resolve contact_id: stored directly if populated, else look up by user_id + channel
      let contactId = notification.contact_id as string | null

      if (!contactId) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('bot_id', notification.bot_id)
          .eq('external_id', notification.user_id)
          .eq('channel', notification.channel)
          .single()

        contactId = contact?.id ?? null
      }

      if (!contactId) {
        console.warn(`[NotificationDispatch] No contact found for user ${notification.user_id} on ${notification.channel}`)
        await supabase
          .from('pending_notifications')
          .update({ retry_count: (notification.retry_count as number) + 1 })
          .eq('id', notification.id)
        failed++
        continue
      }

      const sent = await sendMessage(
        contactId,
        notification.message as string,
        notification.bot_id as string
      )

      if (sent) {
        await supabase
          .from('pending_notifications')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', notification.id)
        dispatched++
      } else {
        await supabase
          .from('pending_notifications')
          .update({ retry_count: (notification.retry_count as number) + 1 })
          .eq('id', notification.id)
        failed++
      }
    } catch (err) {
      console.error(`[NotificationDispatch] Send failed for ${notification.id}:`, err)
      const retryCount = notification.retry_count as number
      await supabase
        .from('pending_notifications')
        .update({
          retry_count: retryCount + 1,
          failed_at: retryCount >= 2 ? new Date().toISOString() : null,
        })
        .eq('id', notification.id)
      failed++
    }
  }

  console.log(`[NotificationDispatch] dispatched=${dispatched} failed=${failed}`)
  return NextResponse.json({ dispatched, failed, total: notifications.length })
}
