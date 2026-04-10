import { createServiceClient } from '@/lib/supabase/service'
import type { Channel, Contact } from '@/types/database'

interface UpsertContactParams {
  botId: string
  externalId: string
  channel: Channel
  name?: string
  phone?: string
  email?: string
  language?: string
}

export async function upsertContact(params: UpsertContactParams): Promise<Contact | null> {
  const { botId, externalId, channel, name, phone, email, language } = params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      {
        bot_id: botId,
        external_id: externalId,
        channel,
        name: name ?? null,
        phone: phone ?? null,
        email: email ?? null,
        language: language ?? 'en',
        last_message_at: new Date().toISOString(),
      },
      {
        onConflict: 'bot_id,external_id,channel',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single()

  if (error) {
    console.error('[crm/contacts] upsertContact error:', error)
    return null
  }

  return data as Contact
}
