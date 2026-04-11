import { NextRequest } from 'next/server'
import { importContactsFromCsv } from '@/lib/crm/import-export'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })
    if (!file.name.endsWith('.csv')) {
      return Response.json({ error: 'Only CSV files are supported' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const csvText = await file.text()
    const result = await importContactsFromCsv(botId, csvText)

    return Response.json(result)
  } catch (error) {
    console.error('[contacts/import POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
