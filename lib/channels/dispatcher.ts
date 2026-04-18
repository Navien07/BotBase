import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/crypto/tokens'
import * as whatsapp from './whatsapp'
import * as telegram from './telegram'

export async function sendMessage(
  contactId: string,
  message: string,
  botId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('external_id, channel')
    .eq('id', contactId)
    .eq('bot_id', botId)
    .single()

  if (!contact) return false

  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', contact.channel)
    .single()

  if (!channelConfig?.config) return false

  const config = channelConfig.config as Record<string, string>

  if (contact.channel === 'whatsapp') {
    const accessToken = await decrypt(config.access_token)
    return whatsapp.sendTextMessage(
      contact.external_id, message, accessToken, config.phone_number_id
    )
  }

  if (contact.channel === 'telegram') {
    const botToken = await decrypt(config.bot_token)
    return telegram.sendMessage(Number(contact.external_id), message, botToken)
  }

  return false
}

export async function sendDocument(
  contactId: string,
  documentUrl: string,
  filename: string,
  caption: string,
  botId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('external_id, channel')
    .eq('id', contactId)
    .eq('bot_id', botId)
    .single()

  if (!contact) return false

  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', contact.channel)
    .single()

  if (!channelConfig?.config) return false
  const config = channelConfig.config as Record<string, string>

  if (contact.channel === 'whatsapp') {
    const accessToken = await decrypt(config.access_token)
    return whatsapp.sendDocument(
      contact.external_id, documentUrl, filename, caption,
      accessToken, config.phone_number_id
    )
  }

  if (contact.channel === 'telegram') {
    const botToken = await decrypt(config.bot_token)
    return telegram.sendDocument(Number(contact.external_id), documentUrl, caption, botToken)
  }

  return false
}

export async function sendMediaGroup(
  contactId: string,
  items: Array<{ url: string; caption?: string }>,
  botId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('external_id, channel')
    .eq('id', contactId)
    .eq('bot_id', botId)
    .single()
  if (!contact) return false

  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', contact.channel)
    .single()
  if (!channelConfig?.config) return false

  const config = channelConfig.config as Record<string, string>

  if (contact.channel === 'telegram') {
    const botToken = await decrypt(config.bot_token)
    return telegram.sendMediaGroup(Number(contact.external_id), items, botToken)
  }

  // WhatsApp has no native media group — fall back to sequential sendImage
  if (contact.channel === 'whatsapp') {
    const accessToken = await decrypt(config.access_token)
    let allOk = true
    for (const item of items) {
      const ok = await whatsapp.sendImage(
        contact.external_id, item.url, item.caption ?? '', accessToken, config.phone_number_id
      )
      if (!ok) allOk = false
    }
    return allOk
  }

  return false
}

export async function sendPhoto(
  contactId: string,
  photoUrl: string,
  caption: string,
  botId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('external_id, channel')
    .eq('id', contactId)
    .eq('bot_id', botId)
    .single()

  if (!contact) return false

  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', contact.channel)
    .single()

  if (!channelConfig?.config) return false

  const config = channelConfig.config as Record<string, string>

  if (contact.channel === 'telegram') {
    const botToken = await decrypt(config.bot_token)
    return telegram.sendPhoto(Number(contact.external_id), photoUrl, caption, botToken)
  }

  if (contact.channel === 'whatsapp') {
    const accessToken = await decrypt(config.access_token)
    return whatsapp.sendImage(
      contact.external_id, photoUrl, caption, accessToken, config.phone_number_id
    )
  }

  return false
}
