import { NextRequest } from 'next/server'
import { exportContactsToCsv } from '@/lib/crm/import-export'
import type { LeadStage } from '@/types/database'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  try {
    const { searchParams } = new URL(req.url)

    const csv = await exportContactsToCsv(botId, {
      search: searchParams.get('search') ?? undefined,
      lead_stage: (searchParams.get('lead_stage') as LeadStage) || undefined,
      language: searchParams.get('language') ?? undefined,
      channel: searchParams.get('channel') ?? undefined,
      tag: searchParams.get('tag') ?? undefined,
    })

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contacts-${botId}-${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    console.error('[contacts/export GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
