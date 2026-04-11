import { createServiceClient } from '@/lib/supabase/service'

export async function calculateLeadScore(contactId: string): Promise<number> {
  const supabase = createServiceClient()

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('total_messages, total_bookings, last_message_at, opt_out')
    .eq('id', contactId)
    .single()

  if (error || !contact) return 0

  let score = 10 // base

  // +1 per message, max 20
  score += Math.min(contact.total_messages, 20)

  // +20 if has bookings
  if (contact.total_bookings > 0) score += 20

  // -10 if no message in 14 days
  if (contact.last_message_at) {
    const daysSinceLastMessage =
      (Date.now() - new Date(contact.last_message_at).getTime()) /
      (1000 * 60 * 60 * 24)
    if (daysSinceLastMessage > 14) score -= 10
  } else {
    score -= 10
  }

  // -20 if opted out
  if (contact.opt_out) score -= 20

  return Math.max(0, Math.min(100, score))
}

export async function refreshLeadScore(contactId: string): Promise<void> {
  const supabase = createServiceClient()
  const score = await calculateLeadScore(contactId)
  await supabase
    .from('contacts')
    .update({ lead_score: score, updated_at: new Date().toISOString() })
    .eq('id', contactId)
}
