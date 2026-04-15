// POST /api/notifications/dispatch
// Called by n8n Schedule Trigger daily at 02:00 UTC (10:00 AM MYT)
// Also callable manually for testing

import { createServiceClient } from '@/lib/supabase/service'
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

  // Fetch bot webhook URLs for all affected bots
  const botIds = [...new Set(notifications.map(n => n.bot_id as string))]
  const { data: bots } = await supabase
    .from('bots')
    .select('id, n8n_outbound_webhook, name')
    .in('id', botIds)

  const webhookMap = Object.fromEntries(
    (bots ?? []).map(b => [b.id as string, b.n8n_outbound_webhook as string | null])
  )

  let dispatched = 0
  let failed = 0

  for (const notification of notifications) {
    const webhook = webhookMap[notification.bot_id as string]
    if (!webhook) {
      console.warn(`[NotificationDispatch] No webhook for bot ${notification.bot_id}`)
      continue
    }

    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: notification.type === 'post_session_survey' ? 'survey' : 'reminder',
          userId: notification.user_id,
          channel: notification.channel,
          message: notification.message,
          bookingId: notification.booking_id,
          notificationId: notification.id,
        }),
      })

      if (res.ok) {
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
