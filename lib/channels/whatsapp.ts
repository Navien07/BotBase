import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/crypto/tokens'
import { runPipeline } from '@/lib/pipeline'
import { upsertContact } from '@/lib/crm/contacts'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account'
  entry: WhatsAppEntry[]
}

interface WhatsAppEntry {
  id: string
  changes: WhatsAppChange[]
}

interface WhatsAppChange {
  value: WhatsAppValue
  field: string
}

interface WhatsAppValue {
  messaging_product: string
  metadata: { display_phone_number: string; phone_number_id: string }
  contacts?: Array<{ profile: { name: string }; wa_id: string }>
  messages?: WhatsAppMessage[]
  statuses?: WhatsAppStatus[]
}

interface WhatsAppMessage {
  id: string
  from: string
  type: string
  timestamp: string
  text?: { body: string }
  document?: { id: string; filename: string; mime_type: string }
}

interface WhatsAppStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  recipient_id: string
}

// ─── Webhook Verification ─────────────────────────────────────────────────────

export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  verifyToken: string
): string | null {
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge
  }
  return null
}

// ─── Signature Verification ───────────────────────────────────────────────────

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    )
  } catch {
    return false
  }
}

// ─── Inbound Message Handler ──────────────────────────────────────────────────

export async function handleInboundMessage(
  payload: WhatsAppWebhookPayload,
  botId: string
): Promise<void> {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue
      const { messages, contacts, metadata } = change.value
      if (!messages?.length) continue

      for (const msg of messages) {
        if (msg.type !== 'text') continue
        const text = msg.text?.body
        if (!text) continue

        const senderPhone = msg.from
        const senderName = contacts?.[0]?.profile?.name

        // Upsert contact
        await upsertContact({
          botId,
          externalId: senderPhone,
          channel: 'whatsapp',
          phone: senderPhone,
          name: senderName,
        })

        // Get channel config for credentials
        const supabase = createServiceClient()
        const { data: channelConfig } = await supabase
          .from('channel_configs')
          .select('config')
          .eq('bot_id', botId)
          .eq('channel', 'whatsapp')
          .single()

        if (!channelConfig) continue

        const config = channelConfig.config as Record<string, string>
        const accessToken = await decrypt(config.access_token)
        const phoneNumberId = metadata.phone_number_id ?? config.phone_number_id

        // Mark message as read (fire and forget)
        markAsRead(msg.id, accessToken, phoneNumberId).catch(() => {})

        // Get bot config
        const { data: bot } = await supabase
          .from('bots')
          .select('*')
          .eq('id', botId)
          .single()

        if (!bot) continue

        // Run pipeline
        const { stream, result } = await runPipeline({
          botId,
          message: text,
          userId: senderPhone,
          channel: 'whatsapp',
          bot,
          startedAt: Date.now(),
          conversationId: '',
          contactId: null,
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

        // Collect stream response
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
          await sendTextMessage(senderPhone, response, accessToken, phoneNumberId)
        }
      }
    }
  }
}

// ─── Outbound Senders ─────────────────────────────────────────────────────────

export async function sendTextMessage(
  to: string,
  text: string,
  accessToken: string,
  phoneNumberId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text }
        })
      }
    )
    return res.ok
  } catch (error) {
    console.error('[whatsapp] sendTextMessage error:', error)
    return false
  }
}

export async function sendDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption: string,
  accessToken: string,
  phoneNumberId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'document',
          document: { link: documentUrl, filename, caption }
        })
      }
    )
    return res.ok
  } catch (error) {
    console.error('[whatsapp] sendDocument error:', error)
    return false
  }
}

export async function markAsRead(
  messageId: string,
  accessToken: string,
  phoneNumberId: string
): Promise<void> {
  await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    }
  ).catch(() => {})
}
