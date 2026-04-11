// app/api/cron/drip/route.ts — Process drip sequence enrollments
// Vercel Cron: "0 * * * *"
// NO export const dynamic — incompatible with cacheComponents:true

import { processDripSequences } from '@/lib/broadcasts/followup'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDripSequences()
    return Response.json(result)
  } catch (error) {
    console.error('[cron/drip GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
