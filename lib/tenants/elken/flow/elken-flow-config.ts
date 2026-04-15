// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/

import type { FlowData } from '@/types/database'

/**
 * Elken "Ask Ethan Digital" welcome flow.
 * Language-aware greeting → main menu → intent routing.
 *
 * This is the default flow loaded for the Elken bot in the flow builder.
 * Admins can modify it in the dashboard but this serves as the canonical seed.
 */
export const ELKEN_WELCOME_FLOW: FlowData = {
  nodes: [
    {
      id: 'start',
      type: 'trigger',
      position: { x: 100, y: 100 },
      data: {
        label: 'New Conversation',
        trigger_type: 'always',
      },
    },
    {
      id: 'greeting-en',
      type: 'message',
      position: { x: 100, y: 220 },
      data: {
        label: 'English Greeting',
        message:
          "👋 Hello! I'm *Ethan*, your personal wellness assistant from Elken.\n\nI can help you:\n1️⃣ Book a GenQi Wellness Centre appointment\n2️⃣ Learn about Elken products\n3️⃣ Get wellness advice\n4️⃣ Find the nearest GenQi centre\n\nHow can I assist you today?",
      },
    },
    {
      id: 'greeting-ms',
      type: 'message',
      position: { x: 400, y: 220 },
      data: {
        label: 'Malay Greeting',
        message:
          "👋 Hai! Saya *Ethan*, pembantu kesihatan peribadi anda dari Elken.\n\nSaya boleh membantu anda:\n1️⃣ Menempah temujanji di Pusat Kesihatan GenQi\n2️⃣ Mengetahui tentang produk Elken\n3️⃣ Mendapatkan nasihat kesihatan\n4️⃣ Mencari Pusat GenQi berdekatan\n\nBagaimana saya boleh membantu anda hari ini?",
      },
    },
    {
      id: 'greeting-zh',
      type: 'message',
      position: { x: 700, y: 220 },
      data: {
        label: 'Chinese Greeting',
        message:
          "👋 您好！我是*Ethan*，您来自益健的个人健康助理。\n\n我可以帮您：\n1️⃣ 预约GenQi康健中心\n2️⃣ 了解益健产品\n3️⃣ 获取健康建议\n4️⃣ 查找最近的GenQi中心\n\n今天我能为您做什么？",
      },
    },
    {
      id: 'language-detect',
      type: 'condition',
      position: { x: 100, y: 350 },
      data: {
        label: 'Detect Language',
        condition: 'ctx.detectedLanguage',
      },
    },
    {
      id: 'route-booking',
      type: 'action',
      position: { x: 100, y: 480 },
      data: {
        label: 'Start Booking Flow',
        action: 'start_booking',
      },
    },
    {
      id: 'route-product',
      type: 'action',
      position: { x: 300, y: 480 },
      data: {
        label: 'Product Enquiry',
        action: 'product_enquiry',
      },
    },
    {
      id: 'route-health',
      type: 'action',
      position: { x: 500, y: 480 },
      data: {
        label: 'Health Advice',
        action: 'health_advice',
      },
    },
    {
      id: 'route-location',
      type: 'action',
      position: { x: 700, y: 480 },
      data: {
        label: 'Find Centre',
        action: 'find_centre',
      },
    },
    {
      id: 'centre-list',
      type: 'message',
      position: { x: 700, y: 600 },
      data: {
        label: 'Show Centre List',
        message:
          '📍 *GenQi Wellness Centres*\n\n1. KL HQ — Pandan Indah, KL\n2. Petaling Jaya — Section 14, PJ\n3. Subang Jaya — SS15\n4. Cheras — Taman Mutiara Barat\n5. Ipoh — Greentown, Perak\n6. Penang — Greenlane, George Town\n7. Johor Bahru — Susur 5, JB\n\nAll centres: Mon–Fri 9am–6pm | Sat 9am–1pm\n\nWould you like to book an appointment at any of these centres?',
      },
    },
  ],
  edges: [
    { id: 'e-start-detect', source: 'start', target: 'language-detect' },
    { id: 'e-detect-en', source: 'language-detect', target: 'greeting-en', label: 'en' },
    { id: 'e-detect-ms', source: 'language-detect', target: 'greeting-ms', label: 'ms/bm' },
    { id: 'e-detect-zh', source: 'language-detect', target: 'greeting-zh', label: 'zh' },
    { id: 'e-greeting-en-book', source: 'greeting-en', target: 'route-booking', label: 'book_session' },
    { id: 'e-greeting-en-product', source: 'greeting-en', target: 'route-product', label: 'browse_product' },
    { id: 'e-greeting-en-health', source: 'greeting-en', target: 'route-health', label: 'health_issue' },
    { id: 'e-greeting-en-location', source: 'greeting-en', target: 'route-location', label: 'find_centre' },
    { id: 'e-location-list', source: 'route-location', target: 'centre-list' },
  ],
}

/**
 * Elken booking reminder flow — triggered 24h before appointment.
 * Used by the cron reminder system.
 */
export const ELKEN_REMINDER_FLOW: FlowData = {
  nodes: [
    {
      id: 'reminder-trigger',
      type: 'trigger',
      position: { x: 100, y: 100 },
      data: {
        label: 'Reminder Cron',
        trigger_type: 'api',
      },
    },
    {
      id: 'send-reminder',
      type: 'action',
      position: { x: 100, y: 220 },
      data: {
        label: 'Send Reminder Message',
        action: 'send_booking_reminder',
      },
    },
  ],
  edges: [
    { id: 'e-trigger-reminder', source: 'reminder-trigger', target: 'send-reminder' },
  ],
}
