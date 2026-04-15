// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/

import { createServiceClient } from '@/lib/supabase/service'
import { sendMessage, sendDocument } from '@/lib/channels/dispatcher'
import { ELKEN_BOT_ID, ELKEN_LOCATIONS, ELKEN_FACILITIES } from '@/lib/tenants/elken/config'
import type { ElkenFacilityId, ElkenLocation } from '@/lib/tenants/elken/config'
import { toElkenLang } from '@/lib/tenants/elken/config'
import type { ElkenLang } from '@/lib/tenants/elken/booking/types'
import type { Booking, Contact } from '@/types/database'

// ─── PIC Admin Notification ───────────────────────────────────────────────────

/**
 * Send a WhatsApp notification to the location's PIC via the bot's n8n webhook.
 * Full implementation — reads pic_contacts from bots table.
 *
 * PROMPT 3: dispatchBrochure is also implemented here.
 */
// Admin notifications route through n8n because targetNumber is the
// PIC's WhatsApp number — not a contact in the DB. Native dispatcher
// only sends to registered contacts.
export async function dispatchAdminNotification(
  botId: string,
  bookingId: string,
  trigger: 'booking_created' | 'booking_confirmed'
): Promise<boolean> {
  if (botId !== ELKEN_BOT_ID) return false

  const supabase = createServiceClient()

  // Fetch booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('bot_id', ELKEN_BOT_ID)
    .single()

  if (!booking) return false

  // Fetch bot config
  const { data: bot } = await supabase
    .from('bots')
    .select('n8n_outbound_webhook, pic_contacts, name')
    .eq('id', botId)
    .single()

  if (!bot?.n8n_outbound_webhook) {
    console.warn('[ElkenNotif] No n8n_outbound_webhook configured')
    return false
  }

  const picContacts = (bot.pic_contacts ?? {}) as Record<string, string>
  const bookingMeta = (booking.metadata ?? {}) as Record<string, unknown>
  const locationId = (bookingMeta.location_id ?? '') as string
  const picNumber = picContacts[locationId]

  if (!picContacts || Object.keys(picContacts).length === 0) {
    console.info('[ElkenNotif] No PIC contacts configured')
    return false
  }
  if (!picNumber) {
    console.warn(`[ElkenNotif] No PIC number for location: ${locationId}`)
    return false
  }

  const locationLabel = locationId && locationId in ELKEN_LOCATIONS
    ? ELKEN_LOCATIONS[locationId as ElkenLocation].name
    : (booking.location ?? locationId ?? 'Unknown')

  const facilityId = bookingMeta.facility_id as string | undefined
  const facilityLabel = facilityId && facilityId in ELKEN_FACILITIES
    ? ELKEN_FACILITIES[facilityId as ElkenFacilityId].label.en
    : (booking.service_name ?? facilityId ?? 'Unknown')

  const formattedDt = booking.start_time
    ? new Date(booking.start_time).toLocaleString('en-MY', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kuala_Lumpur',
      })
    : 'TBC'

  const isMember = bookingMeta.is_member as boolean | undefined
  const hasBes = bookingMeta.bes_device as boolean | undefined
  const trialType = bookingMeta.trial_type as string | undefined
  const memberId = bookingMeta.member_id as string | undefined
  const isInhaler = facilityId === 'inhaler'

  let message: string

  if (trigger === 'booking_confirmed') {
    message = `✅ *Booking Confirmed by Staff*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${booking.customer_name ?? '—'}\n📞 *Contact:* ${booking.customer_phone ?? '—'}\n🏢 *Location:* ${locationLabel}\n🛏️ *Facility:* ${facilityLabel}\n📅 *Date & Time:* ${formattedDt}\n━━━━━━━━━━━━━━━━━━━━\n📲 *Customer notified via WhatsApp/Telegram.*`
  } else if (isInhaler) {
    message = `📋 *New Inhaler Booking — Confirmed*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${booking.customer_name ?? '—'}\n📞 *Contact:* ${booking.customer_phone ?? '—'}\n🏢 *Location:* ${locationLabel}\n💨 *Facility:* ${facilityLabel}\n📅 *Date & Time:* ${formattedDt}\n━━━━━━━━━━━━━━━━━━━━\nℹ️ *Status:* Confirmed. No approval needed.`
  } else if (isMember) {
    message = `📋 *New Booking — Pending Approval*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${booking.customer_name ?? '—'}\n📞 *Contact:* ${booking.customer_phone ?? '—'}\n🏢 *Location:* ${locationLabel}\n🛏️ *Facility:* ${facilityLabel}\n📅 *Date & Time:* ${formattedDt}\n✅ *Member:* Yes\n🆔 *Member ID:* ${memberId ?? 'Not provided'}\n💊 *BES Device:* ${hasBes ? 'With BES' : 'No BES'}\n━━━━━━━━━━━━━━━━━━━━\n⏳ *Action Required:* Please approve this booking in the dashboard.`
  } else {
    message = `📋 *New Trial Enquiry — Specialist Follow-up Required*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${booking.customer_name ?? '—'}\n📞 *Contact:* ${booking.customer_phone ?? '—'}\n🏢 *Location:* ${locationLabel}\n🛏️ *Facility:* ${facilityLabel} (Free Trial)\n📅 *Requested Time:* ${formattedDt}\n👥 *Member:* No\n🎯 *Trial Type:* ${trialType ?? 'Not specified'}\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Action Required:* Please contact this customer within 24 hours.`
  }

  try {
    const res = await fetch(bot.n8n_outbound_webhook as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'admin_notification',
        targetNumber: picNumber,
        message,
        bookingId,
        trigger,
        botName: bot.name,
      }),
    })
    return res.ok
  } catch (err) {
    console.error('[ElkenNotif] dispatchAdminNotification fetch failed:', err)
    return false
  }
}

// ─── Brochure Delivery ────────────────────────────────────────────────────────

/**
 * Send a product brochure PDF to a user via n8n webhook.
 * Language priority: [detectedLang, 'trilingual', 'en'] deduplicated.
 * PROMPT 3: full implementation stub — requires documents.brochure_url column (migration 00026).
 */
export async function dispatchBrochure(
  botId: string,
  userId: string,
  channel: string,
  productName: string,
  detectedLang: string
): Promise<boolean> {
  if (botId !== ELKEN_BOT_ID) return false

  const supabase = createServiceClient()

  const langPriority = [detectedLang, 'trilingual', 'en']
    .filter((v, i, a) => a.indexOf(v) === i)

  let doc: { brochure_url: string; title: string } | null = null

  for (const lang of langPriority) {
    const { data } = await supabase
      .from('documents')
      .select('brochure_url, title')
      .eq('bot_id', botId)
      .eq('metadata->>product_name', productName)
      .eq('metadata->>language', lang)
      .not('brochure_url', 'is', null)
      .limit(1)
      .maybeSingle()

    if (data?.brochure_url) {
      doc = data as { brochure_url: string; title: string }
      break
    }
  }

  if (!doc) return false

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('bot_id', botId)
    .eq('external_id', userId)
    .eq('channel', channel)
    .single()

  if (!contact?.id) return false

  return sendDocument(
    contact.id,
    doc.brochure_url,
    doc.title + '.pdf',
    `Here is the brochure for ${doc.title} 📄`,
    botId
  )
}

// ─── Scheduled Notifications ─────────────────────────────────────────────────

const REMINDER_MESSAGES: Record<string, Record<string, string>> = {
  booking_reminder_24h: {
    en: "Hi {name}! 😊 This is a reminder that your GenQi session is tomorrow. Please arrive 15 minutes early for registration. No food or drinks permitted on premises. See you soon!",
    bm: "Hai {name}! 😊 Ini adalah peringatan bahawa sesi GenQi anda adalah esok. Sila hadir 15 minit lebih awal untuk pendaftaran. Tiada makanan dan minuman dibenarkan. Jumpa nanti!",
    zh: "您好 {name}！😊 提醒您明天有GenQi预约。请提前15分钟到达登记。场内禁止饮食。期待您的到来！",
  },
  post_session_survey: {
    en: "Hi {name}! 😊 We hope you enjoyed your GenQi session today! We'd love to hear your feedback. How would you rate your experience? (1 = Poor, 5 = Excellent)",
    bm: "Hai {name}! 😊 Kami harap anda menikmati sesi GenQi anda hari ini! Kami ingin mendengar maklum balas anda. Bagaimana anda menilai pengalaman anda? (1 = Lemah, 5 = Cemerlang)",
    zh: "您好 {name}！😊 希望您今天的GenQi体验愉快！我们很想听听您的反馈。您如何评价今天的体验？（1=差，5=优秀）",
  },
  nonmember_trial_followup: {
    en: "Hi {name}! 😊 Thank you for booking a free trial at GenQi. Our Elken specialist will be in touch with you shortly. If you haven't heard from us yet, please call 012-2208396 (OKR) or 012-2206215 (Subang).",
    bm: "Hai {name}! 😊 Terima kasih kerana menempah percubaan percuma di GenQi. Pakar Elken kami akan menghubungi anda tidak lama lagi. Jika anda belum mendengar daripada kami, sila hubungi 012-2208396 (OKR) atau 012-2206215 (Subang).",
    zh: "您好 {name}！😊 感谢您预约GenQi免费体验。我们的Elken专员将尽快与您联系。如果您还没收到我们的消息，请致电012-2208396（OKR）或012-2206215（梳邦）。",
  },
}

/**
 * Schedule 24h reminder, post-session survey, and (if non-member) trial follow-up
 * for a newly created Elken booking. Fire-and-forget — never throws.
 */
export async function scheduleElkenNotifications(
  botId: string,
  bookingId: string,
  userId: string,
  channel: string,
  sessionStart: string,
  customerName: string,
  lang: ElkenLang,
  isMember: boolean
): Promise<void> {
  if (botId !== ELKEN_BOT_ID) return
  if (channel !== 'whatsapp' && channel !== 'telegram') return

  const supabase = createServiceClient()
  const now = new Date()

  let startDate: Date
  try {
    const parsed = new Date(sessionStart)
    startDate = isNaN(parsed.getTime()) ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : parsed
  } catch {
    startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  }

  const name = customerName || 'Valued Customer'

  const buildMsg = (type: string) =>
    (REMINDER_MESSAGES[type][lang] ?? REMINDER_MESSAGES[type].en).replace('{name}', name)

  const rows: {
    bot_id: string
    booking_id: string
    user_id: string
    channel: string
    type: string
    message: string
    scheduled_for: string
  }[] = [
    {
      bot_id: botId,
      booking_id: bookingId,
      user_id: userId,
      channel,
      type: 'booking_reminder_24h',
      message: buildMsg('booking_reminder_24h'),
      scheduled_for: new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      bot_id: botId,
      booking_id: bookingId,
      user_id: userId,
      channel,
      type: 'post_session_survey',
      message: buildMsg('post_session_survey'),
      scheduled_for: new Date(startDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    },
  ]

  if (!isMember) {
    rows.push({
      bot_id: botId,
      booking_id: bookingId,
      user_id: userId,
      channel,
      type: 'nonmember_trial_followup',
      message: buildMsg('nonmember_trial_followup'),
      scheduled_for: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    })
  }

  const { error } = await supabase.from('pending_notifications').insert(rows)
  if (error) {
    console.error('[ElkenNotif] scheduleElkenNotifications insert failed:', error)
    return
  }

  console.log(`[ElkenNotif] Scheduled ${rows.length} notification(s) for booking ${bookingId}`)
}

// ─── Customer Confirmation & Reminder ────────────────────────────────────────

export function formatElkenConfirmation(booking: Booking, lang: ElkenLang): string {
  const centre = booking.location ?? 'GenQi Wellness Centre'
  const service = booking.service_name ?? 'Wellness Session'
  const name = booking.customer_name ?? 'Valued Customer'
  const dt = formatMYDatetime(booking.start_time)

  const messages: Record<ElkenLang, string> = {
    en: `✅ *Booking Confirmed — GenQi Wellness*\n\nDear ${name},\n\nYour appointment has been confirmed!\n\n📍 Centre: ${centre}\n💆 Service: ${service}\n📅 Date & Time: ${dt}\n\nPlease arrive 5 minutes early. If you need to reschedule, please contact us at least 24 hours in advance.\n\n— Ask Ethan Digital by Elken`,
    bm: `✅ *Tempahan Disahkan — GenQi Wellness*\n\nDear ${name},\n\nTemujanji anda telah disahkan!\n\n📍 Pusat: ${centre}\n💆 Perkhidmatan: ${service}\n📅 Tarikh & Masa: ${dt}\n\nSila tiba 5 minit lebih awal. Jika anda perlu mengubah jadual, sila hubungi kami sekurang-kurangnya 24 jam lebih awal.\n\n— Ask Ethan Digital by Elken`,
    zh: `✅ *预约已确认 — GenQi康健*\n\n亲爱的${name}，\n\n您的预约已确认！\n\n📍 中心：${centre}\n💆 服务：${service}\n📅 日期和时间：${dt}\n\n请提前5分钟到达。如需改期，请至少提前24小时联系我们。\n\n— Ask Ethan Digital by Elken`,
  }
  return messages[lang]
}

export function formatElkenReminder(booking: Booking, lang: ElkenLang): string {
  const centre = booking.location ?? 'GenQi Wellness Centre'
  const service = booking.service_name ?? 'Wellness Session'
  const name = booking.customer_name ?? 'Valued Customer'
  const dt = formatMYDatetime(booking.start_time)

  const messages: Record<ElkenLang, string> = {
    en: `⏰ *Appointment Reminder — GenQi Wellness*\n\nHi ${name}! This is a friendly reminder that your appointment is coming up in 24 hours.\n\n📍 Centre: ${centre}\n💆 Service: ${service}\n📅 Date & Time: ${dt}\n\nSee you soon! Reply if you need to make changes.\n\n— Ask Ethan Digital by Elken`,
    bm: `⏰ *Peringatan Temujanji — GenQi Wellness*\n\nHai ${name}! Ini adalah peringatan mesra bahawa temujanji anda akan berlangsung dalam 24 jam.\n\n📍 Pusat: ${centre}\n💆 Perkhidmatan: ${service}\n📅 Tarikh & Masa: ${dt}\n\nJumpa nanti! Balas jika anda perlu membuat perubahan.\n\n— Ask Ethan Digital by Elken`,
    zh: `⏰ *预约提醒 — GenQi康健*\n\n您好${name}！温馨提醒您，您的预约将在24小时后进行。\n\n📍 中心：${centre}\n💆 服务：${service}\n📅 日期和时间：${dt}\n\n期待您的到来！如需更改请回复。\n\n— Ask Ethan Digital by Elken`,
  }
  return messages[lang]
}

export async function sendElkenBookingConfirmation(bookingId: string): Promise<void> {
  const { booking, contact } = await fetchBookingWithContact(bookingId)
  if (!booking || !contact) return
  const lang = toElkenLang(contact.language)
  await sendMessage(contact.id, formatElkenConfirmation(booking, lang), ELKEN_BOT_ID)
}

export async function sendElkenBookingReminder(bookingId: string): Promise<void> {
  const { booking, contact } = await fetchBookingWithContact(bookingId)
  if (!booking || !contact) return
  const lang = toElkenLang(contact.language)
  await sendMessage(contact.id, formatElkenReminder(booking, lang), ELKEN_BOT_ID)

  const supabase = createServiceClient()
  await supabase
    .from('bookings')
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('bot_id', ELKEN_BOT_ID)
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function fetchBookingWithContact(
  bookingId: string
): Promise<{ booking: Booking | null; contact: Contact | null }> {
  const supabase = createServiceClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('bot_id', ELKEN_BOT_ID)
    .single()

  if (!booking?.contact_id) return { booking: booking as Booking | null, contact: null }

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', booking.contact_id)
    .eq('bot_id', ELKEN_BOT_ID)
    .single()

  return {
    booking: booking as Booking | null,
    contact: contact as Contact | null,
  }
}

function formatMYDatetime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}
