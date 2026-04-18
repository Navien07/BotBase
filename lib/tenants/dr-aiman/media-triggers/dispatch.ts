// DR. AIMAN TENANT PLUGIN — post-stream media dispatch.
//
// Flow:
//   1. Belt-and-braces bot ID check.
//   2. Cheap DB pre-check: skip if media already fired in this conversation.
//   3. Classify user intent via Haiku (skeptical / confirmed / neither).
//   4. If trigger found: atomic RPC to claim the fire-once slot.
//   5. Fetch active media, generate signed URLs, dispatch via channel.

import { createServiceClient } from '@/lib/supabase/service'
import { sendPhoto } from '@/lib/channels/dispatcher'
import type { PostStreamContext } from '@/lib/tenants'
import { detectTrigger } from './detect'
import { DR_AIMAN_BOT_ID } from './config'

export async function handlePostStream(ctx: PostStreamContext): Promise<void> {
  if (ctx.botId !== DR_AIMAN_BOT_ID) return

  const contactId = ctx.contactId
  if (!contactId) return

  const supabase = createServiceClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', ctx.conversationId)
    .eq('bot_id', ctx.botId)
    .single()

  const meta = conv?.metadata as Record<string, unknown> | null
  if (meta?.media_triggers_fired) return

  const trigger = await detectTrigger(ctx.userMessage, ctx.assistantResponse)
  if (!trigger) return

  const { data: claimed } = await supabase.rpc('mark_media_triggers_fired', {
    p_conversation_id: ctx.conversationId,
    p_bot_id: ctx.botId,
  })
  if (!claimed) return

  const { data: media } = await supabase
    .from('bot_media_triggers')
    .select('id, storage_path, caption, display_order')
    .eq('bot_id', ctx.botId)
    .eq('trigger_value', trigger)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (!media || media.length === 0) return

  for (const item of media) {
    const { data: signed } = await supabase
      .storage.from('bot-files').createSignedUrl(item.storage_path, 3600)

    if (!signed?.signedUrl) {
      console.error('[dr-aiman/dispatch] signed URL failed for item', item.id)
      continue
    }

    const ok = await sendPhoto(contactId, signed.signedUrl, item.caption ?? '', ctx.botId)
    if (!ok) console.error('[dr-aiman/dispatch] sendPhoto failed for item', item.id)
  }
}
