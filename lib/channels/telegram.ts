import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/crypto/tokens'
import { runPipeline } from '@/lib/pipeline'
import { upsertContact } from '@/lib/crm/contacts'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

interface TelegramMessage {
  message_id: number
  from: { id: number; first_name: string; last_name?: string; username?: string }
  chat: { id: number; type: string }
  date: number
  text?: string
  document?: { file_id: string; file_name: string; mime_type: string }
}

interface TelegramCallbackQuery {
  id: string
  from: { id: number; first_name: string }
  message?: TelegramMessage
  data?: string
}

// ─── Secret Token Verification ────────────────────────────────────────────────

export function verifySecretToken(
  secretHeader: string | null,
  expectedSecret: string
): boolean {
  if (!secretHeader || !expectedSecret) return false
  try {
    return crypto.timingSafeEqual(
      Buffer.from(secretHeader),
      Buffer.from(expectedSecret)
    )
  } catch {
    return false
  }
}

// ─── Inbound Update Handler ───────────────────────────────────────────────────

export async function handleUpdate(
  update: TelegramUpdate,
  botId: string
): Promise<void> {
  const message = update.message
  if (!message?.text) return

  const chatId = message.chat.id
  const userId = String(message.from.id)
  const text = message.text
  const name = [message.from.first_name, message.from.last_name]
    .filter(Boolean).join(' ')

  const supabase = createServiceClient()

  // Upsert contact — capture id for pipeline
  const contact = await upsertContact({
    botId,
    externalId: userId,
    channel: 'telegram',
    name,
  })

  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', botId)
    .eq('channel', 'telegram')
    .single()

  if (!channelConfig) return

  const config = channelConfig.config as Record<string, string>
  const botToken = await decrypt(config.bot_token)

  // Send typing action (fire and forget)
  sendChatAction(chatId, 'typing', botToken).catch(() => {})

  const { data: bot } = await supabase
    .from('bots')
    .select('*')
    .eq('id', botId)
    .single()

  if (!bot) return

  // Find or create conversation for this Telegram user
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, agent_id')
    .eq('bot_id', botId)
    .eq('external_user_id', userId)
    .eq('channel', 'telegram')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let conversationId: string
  if (existing) {
    // Human agent has taken over — don't let bot reply
    if (existing.agent_id) return
    conversationId = existing.id
  } else {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        bot_id: botId,
        external_user_id: userId,
        channel: 'telegram',
        language: bot.default_language ?? 'en',
        metadata: {},
      })
      .select('id')
      .single()

    if (convError || !newConv) {
      console.error('[telegram] failed to create conversation:', convError)
      return
    }
    conversationId = newConv.id
  }

  const { stream, result } = await runPipeline({
    botId,
    message: text,
    userId,
    channel: 'telegram',
    bot,
    startedAt: Date.now(),
    conversationId,
    contactId: contact?.id ?? null,
    language: bot.default_language ?? 'en',
    history: [],
    detectedIntent: null,
    detectedLanguage: null,
    messageEmbedding: null,
    faqResult: null,
    ragChunks: [],
    liveApiData: null,
    bookingState: null,
    activeScriptId: null,
    systemPrompt: null,
  })

  let response = ''
  if (stream) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      response += decoder.decode(value, { stream: true })
    }
    response += decoder.decode()
  } else if (result.response) {
    response = result.response
  }

  if (response) {
    await sendMessage(chatId, response, botToken)
  }
}

// ─── Outbound Senders ─────────────────────────────────────────────────────────

export async function sendMessage(
  chatId: number,
  text: string,
  botToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
      }
    )
    return res.ok
  } catch (error) {
    console.error('[telegram] sendMessage error:', error)
    return false
  }
}

export async function sendChatAction(
  chatId: number,
  action: string,
  botToken: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action })
  }).catch(() => {})
}

export async function sendDocument(
  chatId: number,
  documentUrl: string,
  caption: string,
  botToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, document: documentUrl, caption })
      }
    )
    return res.ok
  } catch (error) {
    console.error('[telegram] sendDocument error:', error)
    return false
  }
}

export async function setupWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, secret_token: secretToken })
      }
    )
    return res.ok
  } catch {
    return false
  }
}

export async function getMe(botToken: string): Promise<{ username: string } | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    if (!res.ok) return null
    const data = await res.json() as { ok: boolean; result: { username: string } }
    return data.ok ? { username: data.result.username } : null
  } catch {
    return null
  }
}
