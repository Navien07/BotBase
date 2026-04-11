// lib/booking/notifications.ts — Booking notification dispatchers
// Never throw — log errors and return silently.

import { createServiceClient } from '@/lib/supabase/service'
import { sendMessage } from '@/lib/channels/dispatcher'
import type { Booking, Bot, Conversation } from '@/types/database'

export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  try {
    const { booking, bot, conversation } = await fetchContext(bookingId)
    if (!booking || !bot || !conversation?.contact_id) return

    const template = await getTemplate(bot.id, 'booking_confirmed', conversation.language)
    const message = template ?? defaultConfirmation(booking)

    await sendMessage(conversation.contact_id, message, bot.id)
  } catch (e) {
    console.error('[notifications] sendBookingConfirmation', e)
  }
}

export async function sendBookingReminder(bookingId: string): Promise<void> {
  try {
    const { booking, bot, conversation } = await fetchContext(bookingId)
    if (!booking || !bot || !conversation?.contact_id) return

    const template = await getTemplate(bot.id, 'reminder_24h', conversation.language)
    const message = template ?? defaultReminder(booking)

    await sendMessage(conversation.contact_id, message, bot.id)

    await createServiceClient()
      .from('bookings')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', bookingId)
  } catch (e) {
    console.error('[notifications] sendBookingReminder', e)
  }
}

export async function sendPostSurvey(bookingId: string): Promise<void> {
  try {
    const { booking, bot, conversation } = await fetchContext(bookingId)
    if (!booking || !bot || !conversation?.contact_id) return

    const template = await getTemplate(bot.id, 'post_survey', conversation.language)
    const message = template ?? defaultSurvey()

    await sendMessage(conversation.contact_id, message, bot.id)

    await createServiceClient()
      .from('bookings')
      .update({ survey_sent_at: new Date().toISOString() })
      .eq('id', bookingId)
  } catch (e) {
    console.error('[notifications] sendPostSurvey', e)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchContext(bookingId: string): Promise<{
  booking: Booking | null
  bot: Bot | null
  conversation: Conversation | null
}> {
  const supabase = createServiceClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (!booking) return { booking: null, bot: null, conversation: null }

  const { data: bot } = await supabase
    .from('bots')
    .select('*')
    .eq('id', booking.bot_id)
    .single()

  // Find the most recent conversation for this contact
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('bot_id', booking.bot_id)
    .eq('contact_id', booking.contact_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    booking: booking as Booking,
    bot: bot as Bot | null,
    conversation: conversation as Conversation | null,
  }
}

async function getTemplate(
  botId: string,
  intent: string,
  language: string
): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('response_templates')
    .select('content')
    .eq('bot_id', botId)
    .eq('intent', intent)
    .eq('language', language)
    .maybeSingle()
  return data?.content ?? null
}

function defaultConfirmation(booking: Booking): string {
  const date = new Date(booking.start_time).toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'full',
    timeStyle: 'short',
  })
  return [
    '✅ Your booking is confirmed!',
    '',
    booking.service_name ? `Service: ${booking.service_name}` : '',
    `Date: ${date}`,
    booking.customer_name ? `Name: ${booking.customer_name}` : '',
    '',
    'Thank you and see you soon!',
  ]
    .filter((l) => l !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

function defaultReminder(booking: Booking): string {
  const date = new Date(booking.start_time).toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'full',
    timeStyle: 'short',
  })
  return [
    '⏰ Reminder: You have a booking tomorrow!',
    '',
    booking.service_name ? `Service: ${booking.service_name}` : '',
    `Date: ${date}`,
    '',
    "We're looking forward to seeing you!",
  ]
    .filter((l) => l !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

function defaultSurvey(): string {
  return [
    'Thank you for your visit! 🙏',
    '',
    'We hope you had a great experience. We would love to hear your feedback!',
    '',
    'Please rate us from 1 (poor) to 5 (excellent) and share any comments.',
  ].join('\n')
}
