import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
})

function escapeCSV(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(cells: unknown[]): string {
  return cells.map(escapeCSV).join(',') + '\r\n'
}

function sectionHeader(title: string): string {
  return `\r\n${title}\r\n`
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse({
    from: searchParams.get('from') ?? undefined,
    to:   searchParams.get('to')   ?? undefined,
  })

  if (!parsed.success) {
    return Response.json({ error: 'Invalid from/to dates. Use ISO 8601 format.' }, { status: 400 })
  }

  const to   = parsed.data.to   ?? new Date().toISOString()
  const from = parsed.data.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // For snapshot prev period = same span before from
  const spanMs    = new Date(to).getTime() - new Date(from).getTime()
  const prevFrom  = new Date(new Date(from).getTime() - spanMs).toISOString()
  const prevTo    = from

  try {
    const serviceClient = createServiceClient()

    const [
      snapshotRes,
      channelRes,
      leadsRes,
      bookingRes,
      followupRes,
      unansweredRes,
    ] = await Promise.all([
      serviceClient.rpc('get_analytics_snapshot', {
        p_bot_id: botId, p_from: from, p_to: to,
        p_prev_from: prevFrom, p_prev_to: prevTo,
      }),
      serviceClient.rpc('get_conversations_by_channel', {
        p_bot_id: botId, p_from: from, p_to: to,
      }),
      serviceClient.rpc('get_leads_by_stage', {
        p_bot_id: botId, p_from: from, p_to: to,
      }),
      serviceClient.rpc('get_booking_status_breakdown', {
        p_bot_id: botId, p_from: from, p_to: to,
      }),
      serviceClient.rpc('get_followup_completion', {
        p_bot_id: botId, p_from: from, p_to: to,
      }),
      serviceClient.rpc('get_unanswered_queries', {
        p_bot_id: botId, p_from: from, p_to: to,
      }),
    ])

    const d = (snapshotRes.data ?? {}) as Record<string, number>
    const botMessages  = d.bot_messages  ?? 0
    const userMessages = d.user_messages ?? 0
    const responseRate = userMessages > 0 ? Math.round((botMessages / userMessages) * 100) : 0

    // Build CSV string
    let csv = `IceBot Analytics Export\r\n`
    csv += `Period,${from},${to}\r\n`
    csv += `Generated,${new Date().toISOString()}\r\n`

    // Section 1: KPI Summary
    csv += sectionHeader('KPI Summary')
    csv += row(['Metric', 'Value'])
    csv += row(['Conversations Started',  d.conversations      ?? 0])
    csv += row(['Leads Collected',         d.leads              ?? 0])
    csv += row(['WhatsApp Messages',        d.wa_messages        ?? 0])
    csv += row(['Telegram Messages',        d.tg_messages        ?? 0])
    csv += row(['Confirmed Bookings',       d.confirmed_bookings ?? 0])
    csv += row(['Pending Bookings',         d.pending_bookings   ?? 0])
    csv += row(['Follow-ups Sent',          d.followups_done     ?? 0])
    csv += row(['Response Rate (%)',        responseRate])

    // Section 2: Daily Conversations by Channel
    csv += sectionHeader('Daily Conversations by Channel')
    csv += row(['Date', 'WhatsApp', 'Telegram', 'Web', 'API'])
    const channelRows = (channelRes.data ?? []) as Array<{
      date: string; whatsapp: number; telegram: number; web: number; api: number
    }>
    for (const r of channelRows) {
      csv += row([r.date, r.whatsapp, r.telegram, r.web, r.api])
    }

    // Section 3: Lead Stage Counts
    csv += sectionHeader('Lead Stage Counts')
    csv += row(['Stage', 'Count'])
    const leadsRows = (leadsRes.data ?? []) as Array<{ stage: string; count: number }>
    for (const r of leadsRows) {
      csv += row([r.stage, r.count])
    }

    // Section 4: Booking Status Counts
    csv += sectionHeader('Booking Status Counts')
    csv += row(['Status', 'Count'])
    const bookingRows = (bookingRes.data ?? []) as Array<{ status: string; count: number }>
    for (const r of bookingRows) {
      csv += row([r.status, r.count])
    }

    // Section 5: Follow-up Completion
    csv += sectionHeader('Follow-up Completion')
    csv += row(['Status', 'Count'])
    const followupRows = (followupRes.data ?? []) as Array<{ status: string; count: number }>
    for (const r of followupRows) {
      csv += row([r.status, r.count])
    }

    // Section 6: Top 10 Unanswered Queries
    csv += sectionHeader('Top 10 Unanswered Queries')
    csv += row(['Query', 'Count', 'Last Seen', 'Avg Confidence'])
    const unansweredRows = (unansweredRes.data ?? []) as Array<{
      query: string; count: number; last_seen: string; avg_confidence: number
    }>
    for (const r of unansweredRows.slice(0, 10)) {
      csv += row([r.query, r.count, r.last_seen, r.avg_confidence])
    }

    const fromDate = from.split('T')[0]
    const toDate   = to.split('T')[0]
    const filename = `icebot-analytics-${botId}-${fromDate}-${toDate}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (error) {
    console.error('[export GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
