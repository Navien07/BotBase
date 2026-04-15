import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const periodSchema = z.enum(['today', '7d', '30d']).default('7d')

type Trend = 'up' | 'down' | 'neutral'

interface MetricValue {
  value: number
  delta: number
  trend: Trend
}

interface SnapshotResponse {
  period: string
  metrics: {
    conversations:     MetricValue
    leadsCollected:    MetricValue
    whatsappMessages:  MetricValue
    telegramMessages:  MetricValue
    confirmedBookings: MetricValue
    pendingBookings:   MetricValue
    followupsSent:     MetricValue
    responseRate:      MetricValue
  }
}

function getPeriodBounds(period: 'today' | '7d' | '30d'): {
  from: Date
  to: Date
  prevFrom: Date
  prevTo: Date
} {
  const now = new Date()
  let from: Date
  let prevFrom: Date
  let prevTo: Date

  if (period === 'today') {
    from = new Date(now)
    from.setHours(0, 0, 0, 0)
    prevTo = new Date(from)
    prevFrom = new Date(from)
    prevFrom.setDate(prevFrom.getDate() - 1)
  } else if (period === '7d') {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    prevTo = new Date(from)
    prevFrom = new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else {
    // 30d
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    prevTo = new Date(from)
    prevFrom = new Date(from.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return { from, to: now, prevFrom, prevTo }
}

function computeMetric(current: number, previous: number): MetricValue {
  let delta = 0
  let trend: Trend = 'neutral'

  if (previous > 0) {
    delta = Math.round(((current - previous) / previous) * 100)
    if (delta > 0) trend = 'up'
    else if (delta < 0) trend = 'down'
  } else if (current > 0) {
    // Previous was zero — it's new activity
    delta = 100
    trend = 'up'
  }

  return { value: current, delta, trend }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  // Auth check — session client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const periodParsed = periodSchema.safeParse(searchParams.get('period') ?? '7d')
  if (!periodParsed.success) {
    return Response.json({ error: 'Invalid period. Must be today, 7d, or 30d' }, { status: 400 })
  }
  const period = periodParsed.data

  try {
    const { from, to, prevFrom, prevTo } = getPeriodBounds(period)

    const serviceClient = createServiceClient()
    const { data: raw, error } = await serviceClient.rpc('get_analytics_snapshot', {
      p_bot_id:   botId,
      p_from:     from.toISOString(),
      p_to:       to.toISOString(),
      p_prev_from: prevFrom.toISOString(),
      p_prev_to:  prevTo.toISOString(),
    })

    if (error) {
      console.error('[snapshot GET] RPC error', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    const d = raw as Record<string, number>

    // Response rate = (bot_messages / user_messages) * 100
    const botMessages  = d.bot_messages  ?? 0
    const userMessages = d.user_messages ?? 0
    const responseRate = userMessages > 0 ? Math.round((botMessages / userMessages) * 100) : 0

    // For response rate delta: compute prev rate from prev period
    // The RPC does not return prev bot/user split — approximate as neutral when no prev data
    // (prev periods are not returned for message-role split in the RPC)
    const responseRateMetric: MetricValue = {
      value: responseRate,
      delta: 0,
      trend: 'neutral',
    }

    const response: SnapshotResponse = {
      period,
      metrics: {
        conversations:     computeMetric(d.conversations      ?? 0, d.conversations_prev      ?? 0),
        leadsCollected:    computeMetric(d.leads              ?? 0, d.leads_prev              ?? 0),
        whatsappMessages:  computeMetric(d.wa_messages        ?? 0, d.wa_messages_prev        ?? 0),
        telegramMessages:  computeMetric(d.tg_messages        ?? 0, d.tg_messages_prev        ?? 0),
        confirmedBookings: computeMetric(d.confirmed_bookings ?? 0, d.confirmed_bookings_prev ?? 0),
        pendingBookings:   computeMetric(d.pending_bookings   ?? 0, d.pending_bookings_prev   ?? 0),
        followupsSent:     computeMetric(d.followups_done     ?? 0, d.followups_done_prev     ?? 0),
        responseRate:      responseRateMetric,
      },
    }

    return Response.json(response, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('[snapshot GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
