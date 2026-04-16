// PDF brochure delivery — sends product PDFs to users after RAG-based responses.
// Called fire-and-forget from telegram/whatsapp webhook handlers.

import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/crypto/tokens'
import { sendDocument as telegramSendDocument } from './telegram'
import { sendDocument as whatsappSendDocument } from './whatsapp'

interface DeliveryTarget {
  channel: 'telegram' | 'whatsapp'
  // telegram: numeric chat id; whatsapp: phone number string
  recipient: string
  botId: string
}

export async function deliverPdfBrochures(
  documentIds: string[],
  target: DeliveryTarget
): Promise<void> {
  if (!documentIds.length) return

  const supabase = createServiceClient()

  // Fetch only PDF documents from the given IDs
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, title, file_path')
    .in('id', documentIds)
    .eq('bot_id', target.botId)
    .ilike('file_path', '%.pdf')

  if (error || !docs?.length) return

  // Get channel credentials
  const { data: channelConfig } = await supabase
    .from('channel_configs')
    .select('config')
    .eq('bot_id', target.botId)
    .eq('channel', target.channel)
    .single()

  if (!channelConfig?.config) return
  const config = channelConfig.config as Record<string, string>

  for (const doc of docs) {
    // Create a 1-hour signed URL for the file
    const { data: signedData, error: signErr } = await supabase.storage
      .from('bot-files')
      .createSignedUrl(doc.file_path as string, 3600)

    if (signErr || !signedData?.signedUrl) {
      console.error('[pdf-delivery] signed URL error:', signErr)
      continue
    }

    const title = (doc.title as string) || 'Product Brochure'
    const caption = `📄 ${title}`

    if (target.channel === 'telegram') {
      const botToken = await decrypt(config.bot_token)
      await telegramSendDocument(
        Number(target.recipient),
        signedData.signedUrl,
        caption,
        botToken
      ).catch((e: unknown) => console.error('[pdf-delivery] telegram error:', e))
    }

    if (target.channel === 'whatsapp') {
      const accessToken = await decrypt(config.access_token)
      const phoneNumberId = config.phone_number_id
      await whatsappSendDocument(
        target.recipient,
        signedData.signedUrl,
        `${title}.pdf`,
        caption,
        accessToken,
        phoneNumberId
      ).catch((e: unknown) => console.error('[pdf-delivery] whatsapp error:', e))
    }
  }
}
