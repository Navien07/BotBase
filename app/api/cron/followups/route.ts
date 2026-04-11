// app/api/cron/followups/route.ts — Process follow-up queue
// Vercel Cron: "*/10 * * * *"
// NO export const dynamic — incompatible with cacheComponents:true

import { processFollowupQueue } from '@/lib/broadcasts/followup'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processFollowupQueue()
    return Response.json(result)
  } catch (error) {
    console.error('[cron/followups GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
