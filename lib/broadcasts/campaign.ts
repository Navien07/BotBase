// lib/broadcasts/campaign.ts — Broadcast campaign sending logic

import { createServiceClient } from '@/lib/supabase/service'
import { sendMessage } from '@/lib/channels/dispatcher'

interface Contact {
  id: string
  bot_id: string
  channel: string
  lead_stage: string | null
  language: string | null
  tags: string[] | null
  last_message_at: string | null
  opt_out: boolean
}

interface AudienceFilter {
  lead_stage?: string[]
  language?: string
  tags?: string[]
  last_active_days?: number
}

export async function resolveAudience(
  botId: string,
  filter: Record<string, unknown>
): Promise<Contact[]> {
  const supabase = createServiceClient()
  const f = filter as AudienceFilter

  let query = supabase
    .from('contacts')
    .select('id, bot_id, channel, lead_stage, language, tags, last_message_at, opt_out')
    .eq('bot_id', botId)
    .eq('opt_out', false)

  if (f.lead_stage && f.lead_stage.length > 0) {
    query = query.in('lead_stage', f.lead_stage)
  }

  if (f.language) {
    query = query.eq('language', f.language)
  }

  if (f.tags && f.tags.length > 0) {
    query = query.overlaps('tags', f.tags)
  }

  if (f.last_active_days && f.last_active_days > 0) {
    const cutoff = new Date(
      Date.now() - f.last_active_days * 24 * 60 * 60_000
    ).toISOString()
    query = query.gte('last_message_at', cutoff)
  }

  const { data, error } = await query
  if (error) {
    console.error('[resolveAudience]', error)
    return []
  }
  return (data ?? []) as Contact[]
}

export async function sendBroadcast(campaignId: string): Promise<void> {
  const supabase = createServiceClient()

  // Fetch campaign
  const { data: campaign, error: campaignErr } = await supabase
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignErr || !campaign) {
    console.error('[sendBroadcast] campaign not found', campaignId, campaignErr)
    return
  }

  // Mark as sending
  await supabase
    .from('broadcast_campaigns')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', campaignId)

  const messageTemplate = (campaign.message_template ?? {}) as Record<string, unknown>
  const messageBody = (messageTemplate.body as string) ?? ''

  // Resolve audience
  const contacts = await resolveAudience(campaign.bot_id, campaign.audience_filter ?? {})

  let sentCount = 0
  let failedCount = 0

  for (const contact of contacts) {
    try {
      // Use contact's channel if campaign targets 'all', else use campaign channel
      const targetChannel = campaign.channel === 'all' ? contact.channel : campaign.channel
      if (contact.channel !== targetChannel) continue

      const success = await sendMessage(contact.id, messageBody, campaign.bot_id)

      // Record recipient status
      await supabase.from('broadcast_recipients').insert({
        campaign_id: campaignId,
        contact_id: contact.id,
        status: success ? 'sent' : 'failed',
        sent_at: success ? new Date().toISOString() : null,
      })

      if (success) {
        sentCount++
      } else {
        failedCount++
      }
    } catch (e) {
      console.error('[sendBroadcast] contact', contact.id, e)
      failedCount++

      // Still record the failure — use then() since PostgrestFilterBuilder is not a full Promise
      void supabase.from('broadcast_recipients').insert({
        campaign_id: campaignId,
        contact_id: contact.id,
        status: 'failed',
      }).then(undefined, () => {})
    }
  }

  // Mark as sent with stats
  await supabase
    .from('broadcast_campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      stats: {
        total: contacts.length,
        sent: sentCount,
        failed: failedCount,
        delivered: 0,
        read: 0,
        replied: 0,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
}
