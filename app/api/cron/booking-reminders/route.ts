// app/api/cron/booking-reminders/route.ts — Send 24h booking reminders
// Called by Vercel Cron: schedule "0 * * * *" (every hour)
// Protected by Authorization: Bearer ${CRON_SECRET}
// NO export const dynamic — incompatible with cacheComponents:true in next.config.ts

import { createServiceClient } from '@/lib/supabase/service'
import { sendBookingReminder } from '@/lib/booking/notifications'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()

    // Find confirmed bookings starting in 23–25 hours that haven't been reminded
    const now = new Date()
    const from = new Date(now.getTime() + 23 * 60 * 60_000).toISOString()
    const to = new Date(now.getTime() + 25 * 60 * 60_000).toISOString()

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'confirmed')
      .is('reminder_sent_at', null)
      .gte('start_time', from)
      .lte('start_time', to)

    if (error) throw error

    if (!bookings || bookings.length === 0) {
      return Response.json({ processed: 0 })
    }

    // Send reminders sequentially to avoid hammering the channel APIs
    let processed = 0
    for (const { id } of bookings) {
      try {
        await sendBookingReminder(id)
        processed++
      } catch (e) {
        console.error('[booking-reminders] failed for', id, e)
      }
    }

    return Response.json({ processed })
  } catch (error) {
    console.error('[booking-reminders GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
