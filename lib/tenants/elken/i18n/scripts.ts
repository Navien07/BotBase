// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/
// All response strings verbatim from the Elken flowchart PDF.

import type { ElkenLang } from '../booking/types'

type LangMap = Record<ElkenLang, string>
type Scripts = Record<string, LangMap | string>

export const ELKEN_SCRIPTS: Scripts = {
  location_prompt: {
    en: "Great! 🙂 Which centre would you like to book?\n1. GenQi Old Klang Road\n2. GenQi Subang",
    bm: "Baik! 🙂 Pusat mana yang ingin anda tempah?\n1. GenQi Old Klang Road\n2. GenQi Subang",
    zh: "好的！🙂 您想预约哪个中心？\n1. GenQi旧巴生路\n2. GenQi梳邦",
  },
  facility_okr: {
    en: "Got it! 🙂 Tell me more on your booking needs.\nFemale bed / Male bed / Meeting Room / Meeting Hall / Inhaler?",
    bm: "Faham! 🙂 Beritahu saya tentang keperluan tempahan anda.\nKatil wanita / Katil lelaki / Bilik Mesyuarat / Dewan Mesyuarat / Inhaler?",
    zh: "明白！🙂 请告诉我您的预约需求。\n女性床位 / 男性床位 / 小型会议室 / 大型会议厅 / 吸入器？",
  },
  facility_subang: {
    en: "Got it! 🙂 Tell me more on your booking needs.\nFemale bed / Male bed / Inhaler?",
    bm: "Faham! 🙂 Beritahu saya tentang keperluan tempahan anda.\nKatil wanita / Katil lelaki / Inhaler?",
    zh: "明白！🙂 请告诉我您的预约需求。\n女性床位 / 男性床位 / 吸入器？",
  },
  facility_invalid_for_location: {
    en: "Our meeting rooms are only available at GenQi Old Klang Road.\nPlease choose from: Female bed / Male bed / Inhaler.",
    bm: "Bilik mesyuarat kami hanya tersedia di GenQi Old Klang Road.\nSila pilih daripada: Katil wanita / Katil lelaki / Inhaler.",
    zh: "我们的会议室仅在GenQi旧巴生路提供。\n请从以下选择：女性床位 / 男性床位 / 吸入器。",
  },
  meeting_details_prompt: {
    en: "Nice! 🙂 {facility}. What is your preferred date & time? Can I have your name and contact number?",
    bm: "Baik! 🙂 {facility}. Apakah tarikh & masa pilihan anda? Boleh saya dapatkan nama dan nombor hubungan anda?",
    zh: "好的！🙂 {facility}。您的首选日期和时间是什么？请提供您的姓名和联系方式。",
  },
  meeting_member_id_prompt: {
    en: "Thanks {name} 🙂 — {datetime} is available for {facility}. For your info, our meeting room & hall only open for Elken member with valid ID. No food and drinks are permitted in our premises. Can I have your member ID? Please present 15 min earlier before your booking for registration.",
    bm: "Terima kasih {name} 🙂 — {datetime} tersedia untuk {facility}. Untuk makluman anda, bilik dan dewan mesyuarat kami hanya untuk ahli Elken dengan kad keahlian yang sah. Tiada makanan dan minuman dibenarkan di premis kami. Boleh saya dapatkan ID keahlian anda? Sila hadir 15 minit lebih awal sebelum tempahan anda untuk pendaftaran.",
    zh: "谢谢 {name} 🙂 — {datetime} 的{facility}可供预约。请注意，我们的会议室和会议厅仅供持有效会员证的Elken会员使用。场内禁止饮食。请提供您的会员编号，并提前15分钟到达登记。",
  },
  meeting_confirmed: {
    en: "All set {name} 🙂 Your booking is confirmed with details {facility} {datetime}. Please be reminded that no food and drinks are permitted in our premises. Please present 15 min earlier before your booking for registration purpose. See you then!",
    bm: "Siap {name} 🙂 Tempahan anda telah disahkan dengan butiran {facility} {datetime}. Sila ambil perhatian bahawa tiada makanan dan minuman dibenarkan di premis kami. Sila hadir 15 minit lebih awal untuk tujuan pendaftaran. Jumpa nanti!",
    zh: "好的 {name} 🙂 您的预约已确认，详情为 {facility} {datetime}。请注意场内禁止饮食。请提前15分钟到达进行登记。到时见！",
  },
  bed_details_prompt: {
    en: "Nice! 🙂 {facility}. What is your preferred date & time? What's your name and phone number, and are you a member of Elken?",
    bm: "Baik! 🙂 {facility}. Apakah tarikh & masa pilihan anda? Nama dan nombor telefon anda? Adakah anda ahli Elken?",
    zh: "好的！🙂 {facility}。您的首选日期和时间是什么？请提供您的姓名、电话号码，以及您是否是Elken会员？",
  },
  bed_bes_prompt: {
    en: "Thanks {name} 🙂 — {datetime} is available for {facility} section. Will you bring along your BES device?",
    bm: "Terima kasih {name} 🙂 — {datetime} tersedia untuk bahagian {facility}. Adakah anda akan membawa peranti BES anda?",
    zh: "谢谢 {name} 🙂 — {datetime} 的{facility}床位可供预约。您会携带BES设备吗？",
  },
  bed_member_confirmed: {
    en: "All set {name} 🙂 Your booking is confirmed with details {facility} {datetime} {bes_status}. No food and drinks are permitted in our premises. Please present 15 min earlier before your booking for registration purpose. See you then!",
    bm: "Siap {name} 🙂 Tempahan anda telah disahkan dengan butiran {facility} {datetime} {bes_status}. Tiada makanan dan minuman dibenarkan di premis kami. Sila hadir 15 minit lebih awal untuk tujuan pendaftaran. Jumpa nanti!",
    zh: "好的 {name} 🙂 您的预约已确认，详情为 {facility} {datetime} {bes_status}。场内禁止饮食。请提前15分钟到达进行登记。到时见！",
  },
  bed_trial_prompt: {
    en: "Thanks {name} 🙂 — {datetime} is available for {facility} section. What types of trial (free 20 mins) you are looking for — back / foot?",
    bm: "Terima kasih {name} 🙂 — {datetime} tersedia untuk bahagian {facility}. Apakah jenis percubaan (percuma 20 minit) yang anda cari — belakang / kaki?",
    zh: "谢谢 {name} 🙂 — {datetime} 的{facility}床位可供预约。您想体验哪种免费试用（20分钟）— 背部 / 足部？",
  },
  bed_nonmember_confirmed: {
    en: "All set {name} 🙂 Our specialist will contact you for further details within the next 24 hours.",
    bm: "Siap {name} 🙂 Pakar kami akan menghubungi anda untuk maklumat lanjut dalam masa 24 jam.",
    zh: "好的 {name} 🙂 我们的专员将在24小时内联系您以了解更多详情。",
  },
  inhaler_details_prompt: {
    en: "Nice! 🙂 {facility}. What is your preferred date, time & duration of 30 mins / 1.5 hours? What's your name and phone number, and are you a member of Elken?",
    bm: "Baik! 🙂 {facility}. Apakah tarikh, masa & tempoh (30 minit / 1.5 jam) pilihan anda? Nama dan nombor telefon anda? Adakah anda ahli Elken?",
    zh: "好的！🙂 {facility}。您的首选日期、时间和疗程时长（30分钟/1.5小时）是什么？请提供您的姓名、电话号码，以及您是否是Elken会员？",
  },
  inhaler_confirmed: {
    en: "Thanks {name} 🙂 — {datetime} {duration} is available & confirmed. Please present 15 min earlier before your booking for registration purpose. See you soon!",
    bm: "Terima kasih {name} 🙂 — {datetime} {duration} tersedia & disahkan. Sila hadir 15 minit lebih awal untuk tujuan pendaftaran. Jumpa nanti!",
    zh: "谢谢 {name} 🙂 — {datetime} {duration}可供预约并已确认。请提前15分钟到达进行登记。到时见！",
  },
  slot_full: {
    en: "Ops! We're sorry, the selected time slot is fully booked. Next available time slots is {alternatives}. Would you like me to proceed for you?",
    bm: "Alamak! Maaf, slot masa yang dipilih telah penuh. Slot masa yang tersedia seterusnya ialah {alternatives}. Adakah anda ingin saya teruskan?",
    zh: "抱歉！您选择的时间段已被预订。下一个可用时间段是 {alternatives}。您希望我为您预订吗？",
  },
  greeting_en: "Hi! 😊 Thank you for contacting Elken. My name is Ethan, I'll be your assistant for today — what can I do for you?\n1. Product enquiries\n2. GenQi facilities Booking",
  greeting_bm: "Hai! 😊 Terima kasih kerana menghubungi Elken. Nama saya Ethan, saya akan menjadi pembantu anda untuk harini — apakah yang boleh saya bantu?\n1. Pertanyaan Produk\n2. Tempahan Kemudahan GenQi",
  greeting_zh: "您好！😊 感谢您联系 Elken。我是 Ethan，很高兴为您服务 — 请问今天有什么可以帮到您？\n1. 一般咨询\n2. GenQi 设施预订",
}

export function bookingMsg(
  key: string,
  lang: ElkenLang,
  vars: Record<string, string> = {}
): string {
  const template = ELKEN_SCRIPTS[key]
  if (!template) return ''
  // Handle plain string keys (greetings) vs lang-keyed objects
  const raw = typeof template === 'string'
    ? template
    : ((template as LangMap)[lang] ?? (template as LangMap)['en'] ?? '')
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    raw
  )
}
