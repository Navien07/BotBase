import { createServiceClient } from '@/lib/supabase/service'
import type { LeadStage } from '@/types/database'

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

// ─── Lead Stage Auto-Classification ──────────────────────────────────────────
//
// Priority order (first match wins):
//   churned    → opted out OR inactive 30+ days with prior activity
//   converted  → has a completed booking
//   booked     → has a pending/confirmed booking
//   qualified  → sent browse_product or book_session intent (interested but no booking yet)
//   engaged    → 3+ messages exchanged
//   new        → default
//
export async function classifyLeadStage(contactId: string): Promise<LeadStage> {
  const supabase = createServiceClient()

  // Fetch contact basics
  const { data: contact } = await supabase
    .from('contacts')
    .select('opt_out, total_messages, total_bookings, last_message_at')
    .eq('id', contactId)
    .single()

  if (!contact) return 'new'

  // Churned: opted out
  if (contact.opt_out) return 'churned'

  // Churned: no activity in 30+ days (but had prior messages)
  if (contact.total_messages > 0 && contact.last_message_at) {
    const daysSince = (Date.now() - new Date(contact.last_message_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 30) return 'churned'
  }

  // Booking-based stages
  if (contact.total_bookings > 0) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('status')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (bookings) {
      const statuses = bookings.map(b => b.status)
      if (statuses.includes('completed')) return 'converted'
      if (statuses.some(s => ['pending', 'confirmed'].includes(s))) return 'booked'
    }
  }

  // Qualified: has shown buying intent (browse_product or book_session) in message intents
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .limit(10)

  if (conversations && conversations.length > 0) {
    const convIds = conversations.map(c => c.id)
    const { data: intentMessages } = await supabase
      .from('messages')
      .select('intent')
      .in('conversation_id', convIds)
      .in('intent', ['browse_product', 'book_session'])
      .limit(1)

    if (intentMessages && intentMessages.length > 0) return 'qualified'
  }

  // Engaged: 3+ messages
  if (contact.total_messages >= 3) return 'engaged'

  return 'new'
}

export async function refreshLeadStageAndScore(contactId: string): Promise<void> {
  const supabase = createServiceClient()
  const [score, stage] = await Promise.all([
    calculateLeadScore(contactId),
    classifyLeadStage(contactId),
  ])
  await supabase
    .from('contacts')
    .update({ lead_score: score, lead_stage: stage, updated_at: new Date().toISOString() })
    .eq('id', contactId)
}
