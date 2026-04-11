import { createClient } from '@/lib/supabase/server'
import { analyticsHandlers, REPORT_TYPES, type AnalyticsReport } from '@/lib/analytics/queries'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  // Auth guard — session client only, never service client for auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const report = searchParams.get('report') as AnalyticsReport | null

  if (!report || !REPORT_TYPES.includes(report)) {
    return Response.json(
      { error: `Unknown report type. Must be one of: ${REPORT_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  // Default window: last 7 days
  const defaultTo = new Date().toISOString()
  const defaultFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const from = searchParams.get('from') ?? defaultFrom
  const to   = searchParams.get('to')   ?? defaultTo

  try {
    const handler = analyticsHandlers[report]
    const { data, error } = await handler(botId, from, to)

    if (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[analytics GET] report=${report} botId=${botId}`, error)
      return Response.json({ error: msg }, { status: 500 })
    }

    return Response.json({ data }, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('[analytics GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
