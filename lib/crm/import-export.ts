import { createServiceClient } from '@/lib/supabase/service'
import type { LeadStage } from '@/types/database'

export interface ContactFilters {
  search?: string
  lead_stage?: LeadStage
  language?: string
  channel?: string
  tag?: string
}

const VALID_LEAD_STAGES: LeadStage[] = [
  'new', 'engaged', 'qualified', 'booked', 'converted', 'churned',
]

function normalizeStageName(raw: string): LeadStage | null {
  const lower = raw.trim().toLowerCase() as LeadStage
  return VALID_LEAD_STAGES.includes(lower) ? lower : null
}

export async function importContactsFromCsv(
  botId: string,
  csvText: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return { imported: 0, skipped: 0, errors: ['CSV has no data rows'] }
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const nameIdx = headers.indexOf('name')
  const phoneIdx = headers.indexOf('phone')
  const emailIdx = headers.indexOf('email')
  const tagsIdx = headers.indexOf('tags')
  const stageIdx = headers.indexOf('lead_stage')
  const channelIdx = headers.indexOf('channel')
  const langIdx = headers.indexOf('language')

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  const supabase = createServiceClient()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())

    const phone = phoneIdx >= 0 ? cols[phoneIdx] : undefined
    const email = emailIdx >= 0 ? cols[emailIdx] : undefined
    const name = nameIdx >= 0 ? cols[nameIdx] : undefined

    if (!phone && !email) {
      errors.push(`Row ${i + 1}: missing phone or email — skipped`)
      skipped++
      continue
    }

    const rawStage = stageIdx >= 0 ? cols[stageIdx] : 'new'
    const lead_stage = normalizeStageName(rawStage ?? 'new') ?? 'new'

    const tagsRaw = tagsIdx >= 0 ? cols[tagsIdx] : ''
    const tags = tagsRaw
      ? tagsRaw.split(';').map((t) => t.trim()).filter(Boolean)
      : []

    const channel = channelIdx >= 0 ? cols[channelIdx] : 'import'
    const language = langIdx >= 0 ? cols[langIdx] : 'en'

    // Use phone or email as external_id for imported contacts
    const external_id = phone || email || `import-${i}`

    const { error } = await supabase.from('contacts').upsert(
      {
        bot_id: botId,
        external_id,
        channel,
        name: name || null,
        phone: phone || null,
        email: email || null,
        language,
        tags,
        lead_stage,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'bot_id,external_id,channel',
        ignoreDuplicates: false,
      }
    )

    if (error) {
      errors.push(`Row ${i + 1}: ${error.message}`)
      skipped++
    } else {
      imported++
    }
  }

  return { imported, skipped, errors }
}

export async function exportContactsToCsv(
  botId: string,
  filters: ContactFilters
): Promise<string> {
  const supabase = createServiceClient()

  let query = supabase
    .from('contacts')
    .select('name,phone,email,channel,language,lead_stage,lead_score,tags,notes,opt_out,created_at,last_message_at,total_messages,total_bookings')
    .eq('bot_id', botId)
    .order('created_at', { ascending: false })

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }
  if (filters.lead_stage) query = query.eq('lead_stage', filters.lead_stage)
  if (filters.language) query = query.eq('language', filters.language)
  if (filters.channel) query = query.eq('channel', filters.channel)
  if (filters.tag) query = query.contains('tags', [filters.tag])

  const { data, error } = await query
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    return 'name,phone,email,channel,language,lead_stage,lead_score,tags,notes,opt_out,created_at,last_message_at,total_messages,total_bookings\n'
  }

  const header = [
    'name', 'phone', 'email', 'channel', 'language',
    'lead_stage', 'lead_score', 'tags', 'notes', 'opt_out',
    'created_at', 'last_message_at', 'total_messages', 'total_bookings',
  ].join(',')

  const rows = data.map((c) =>
    [
      csvEscape(c.name ?? ''),
      csvEscape(c.phone ?? ''),
      csvEscape(c.email ?? ''),
      csvEscape(c.channel ?? ''),
      csvEscape(c.language ?? ''),
      csvEscape(c.lead_stage ?? ''),
      c.lead_score ?? 0,
      csvEscape((c.tags ?? []).join(';')),
      csvEscape(c.notes ?? ''),
      c.opt_out ? 'true' : 'false',
      c.created_at ?? '',
      c.last_message_at ?? '',
      c.total_messages ?? 0,
      c.total_bookings ?? 0,
    ].join(',')
  )

  return [header, ...rows].join('\n')
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
