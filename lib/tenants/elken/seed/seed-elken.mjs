#!/usr/bin/env node
// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/
//
// Seed script: populates Elken/GenQi data into a fresh BotBase DB.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node lib/tenants/elken/seed/seed-elken.mjs

import { createClient } from '@supabase/supabase-js'

const BOT_ID = '21794953-b13f-4e5f-984a-1536c453461d'
const TENANT_ID = '9bd271da-955b-41bb-aadc-b9733ae5c585'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

// ─── Services (GenQi Wellness Services) ───────────────────────────────────────

const SERVICES = [
  {
    bot_id: BOT_ID,
    name: 'Far Infrared (FIR) Therapy',
    description: 'Therapeutic session using far infrared rays to penetrate deep into body tissue, improving circulation, relieving pain, and promoting detoxification through sweating.',
    duration_minutes: 45,
    buffer_minutes: 15,
    max_simultaneous: 4,
    price: 50.00,
    currency: 'MYR',
    is_active: true,
  },
  {
    bot_id: BOT_ID,
    name: 'Ion Detox Footbath',
    description: 'A gentle ionic cleansing session where feet are immersed in ionised water to draw out toxins through the soles of the feet, supporting lymphatic drainage and energy balance.',
    duration_minutes: 30,
    buffer_minutes: 10,
    max_simultaneous: 6,
    price: 40.00,
    currency: 'MYR',
    is_active: true,
  },
  {
    bot_id: BOT_ID,
    name: 'Body Composition Analysis (BCA)',
    description: 'Non-invasive body scan measuring body fat percentage, muscle mass, bone density, hydration level, and metabolic age. Includes a personalised wellness report.',
    duration_minutes: 30,
    buffer_minutes: 10,
    max_simultaneous: 2,
    price: 30.00,
    currency: 'MYR',
    is_active: true,
  },
  {
    bot_id: BOT_ID,
    name: 'Bio-Energy Scan',
    description: 'Advanced bio-resonance scanning technology that assesses the bio-energetic state of organs and body systems. Provides a comprehensive overview of your health baseline.',
    duration_minutes: 45,
    buffer_minutes: 15,
    max_simultaneous: 2,
    price: 60.00,
    currency: 'MYR',
    is_active: true,
  },
  {
    bot_id: BOT_ID,
    name: 'E-Power Therapy',
    description: 'Applies a high-frequency electrical field to the body to enhance cellular function, improve circulation, reduce fatigue, and promote overall energy and vitality.',
    duration_minutes: 30,
    buffer_minutes: 10,
    max_simultaneous: 3,
    price: 35.00,
    currency: 'MYR',
    is_active: true,
  },
  {
    bot_id: BOT_ID,
    name: 'Magnetic Resonance Stimulation (MRS)',
    description: 'Uses pulsed electromagnetic fields (PEMF) to stimulate cellular regeneration, reduce joint and muscle pain, and support the body\'s natural healing process.',
    duration_minutes: 30,
    buffer_minutes: 10,
    max_simultaneous: 2,
    price: 45.00,
    currency: 'MYR',
    is_active: true,
  },
  {
    bot_id: BOT_ID,
    name: 'GenQi Wellness Consultation',
    description: 'One-on-one consultation with a certified GenQi wellness advisor. Review your health goals, discuss suitable therapies and Elken products, and build a personalised wellness plan.',
    duration_minutes: 60,
    buffer_minutes: 15,
    max_simultaneous: 2,
    price: null,  // complimentary
    currency: 'MYR',
    is_active: true,
  },
]

// ─── Operating Hours (Mon–Fri 9–18, Sat 9–13, Sun closed) ────────────────────

const OPERATING_HOURS = [
  { bot_id: BOT_ID, day_of_week: 1, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '13:00', lunch_end: '14:00' },
  { bot_id: BOT_ID, day_of_week: 2, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '13:00', lunch_end: '14:00' },
  { bot_id: BOT_ID, day_of_week: 3, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '13:00', lunch_end: '14:00' },
  { bot_id: BOT_ID, day_of_week: 4, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '13:00', lunch_end: '14:00' },
  { bot_id: BOT_ID, day_of_week: 5, is_open: true, open_time: '09:00', close_time: '18:00', lunch_start: '13:00', lunch_end: '14:00' },
  { bot_id: BOT_ID, day_of_week: 6, is_open: true, open_time: '09:00', close_time: '13:00', lunch_start: null, lunch_end: null },
  { bot_id: BOT_ID, day_of_week: 0, is_open: false, open_time: '00:00', close_time: '00:00', lunch_start: null, lunch_end: null },
]

// ─── FAQs (EN/BM/ZH) ─────────────────────────────────────────────────────────

const FAQS = [
  // English
  {
    bot_id: BOT_ID, language: 'en', is_active: true,
    question: 'What is GenQi Wellness Centre?',
    answer: 'GenQi is Elken\'s network of wellness centres across Malaysia, offering bio-energy therapies including Far Infrared (FIR) Therapy, Ion Detox Footbath, Body Composition Analysis, Bio-Energy Scan, E-Power Therapy, and Magnetic Resonance Stimulation (MRS).',
  },
  {
    bot_id: BOT_ID, language: 'en', is_active: true,
    question: 'How do I book an appointment at GenQi?',
    answer: 'You can book directly through this chat! Just tell me you\'d like to book a session and I\'ll guide you through selecting a centre, service, date, and time. Alternatively, you can call your nearest GenQi centre directly.',
  },
  {
    bot_id: BOT_ID, language: 'en', is_active: true,
    question: 'How much does a GenQi session cost?',
    answer: 'Session prices vary by therapy:\n• FIR Therapy: RM 50 / session\n• Ion Detox Footbath: RM 40 / session\n• Body Composition Analysis: RM 30 / session\n• Bio-Energy Scan: RM 60 / session\n• E-Power Therapy: RM 35 / session\n• MRS Therapy: RM 45 / session\n• Wellness Consultation: Complimentary',
  },
  {
    bot_id: BOT_ID, language: 'en', is_active: true,
    question: 'Where are the GenQi centres located?',
    answer: 'GenQi has 7 centres across Malaysia:\n1. KL HQ — Pandan Indah, KL\n2. Petaling Jaya — Section 14, PJ\n3. Subang Jaya — SS15, Selangor\n4. Cheras — Taman Mutiara Barat, KL\n5. Ipoh — Greentown, Perak\n6. Penang — Greenlane, George Town\n7. Johor Bahru — Susur 5, JB\n\nAll centres operate Mon–Fri 9am–6pm and Sat 9am–1pm.',
  },
  {
    bot_id: BOT_ID, language: 'en', is_active: true,
    question: 'Do I need to be an Elken member to visit GenQi?',
    answer: 'No! GenQi Wellness Centres are open to everyone, members and non-members alike. However, Elken members may enjoy special promotions and discounted session packages. Ask our team for the latest member benefits.',
  },
  // Malay
  {
    bot_id: BOT_ID, language: 'bm', is_active: true,
    question: 'Apakah itu Pusat Kesihatan GenQi?',
    answer: 'GenQi adalah rangkaian pusat kesihatan Elken di seluruh Malaysia, menawarkan terapi bio-tenaga termasuk Terapi Far Infrared (FIR), Mandi Kaki Detoks Ion, Analisis Komposisi Badan, Imbasan Bio-Tenaga, Terapi E-Power, dan Rangsangan Resonans Magnetik (MRS).',
  },
  {
    bot_id: BOT_ID, language: 'bm', is_active: true,
    question: 'Bagaimana cara menempah temujanji di GenQi?',
    answer: 'Anda boleh menempah terus melalui sembang ini! Beritahu saya bahawa anda ingin membuat sesi dan saya akan membimbing anda memilih pusat, perkhidmatan, tarikh dan masa. Anda juga boleh menghubungi pusat GenQi berdekatan secara terus.',
  },
  // Chinese
  {
    bot_id: BOT_ID, language: 'zh', is_active: true,
    question: 'GenQi康健中心是什么？',
    answer: 'GenQi是益健在马来西亚各地的康健中心网络，提供生物能量疗法，包括远红外线（FIR）疗法、离子排毒足浴、身体成分分析、生物能量扫描、E-Power疗法和磁共振刺激（MRS）。',
  },
  {
    bot_id: BOT_ID, language: 'zh', is_active: true,
    question: '如何在GenQi预约？',
    answer: '您可以直接通过这个聊天预约！告诉我您想预约一个疗程，我会引导您选择中心、服务、日期和时间。您也可以直接致电最近的GenQi中心。',
  },
  // Payment Methods
  {
    bot_id: BOT_ID, language: 'en', is_active: true,
    question: 'What payment methods are accepted at GenQi?',
    answer: "We accept all payment methods — cash, credit/debit cards (Visa & Mastercard), and all major e-wallets including Touch 'n Go eWallet, GrabPay, and Boost. Payment is made on-site at the reception upon arrival.",
  },
  {
    bot_id: BOT_ID, language: 'bm', is_active: true,
    question: 'Apakah kaedah pembayaran yang diterima di GenQi?',
    answer: "Kami menerima semua kaedah pembayaran — tunai, kad kredit/debit (Visa & Mastercard), dan semua e-dompet utama termasuk Touch 'n Go eWallet, GrabPay, dan Boost. Pembayaran dibuat di kaunter semasa ketibaan.",
  },
  {
    bot_id: BOT_ID, language: 'zh', is_active: true,
    question: 'GenQi接受哪些付款方式？',
    answer: "我们接受所有付款方式——现金、信用卡/借记卡（Visa和Mastercard），以及所有主要电子钱包，包括Touch 'n Go eWallet、GrabPay和Boost。请于抵达时在前台付款。",
  },
]

// ─── Products ─────────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    bot_id: BOT_ID, is_active: true, currency: 'MYR',
    name: 'Elken NutriPlus Shake',
    category: 'Nutrition',
    description: 'Nutritionally complete meal replacement shake with 22 vitamins and minerals, high-quality protein, and dietary fibre. Available in Chocolate, Vanilla, and Strawberry.',
    key_features: '• 22 vitamins & minerals\n• High protein formula\n• Low glycaemic index\n• Available in 3 flavours',
    benefits: 'Weight management, balanced nutrition, muscle support, convenient meal replacement',
    price: 150.00,
  },
  {
    bot_id: BOT_ID, is_active: true, currency: 'MYR',
    name: 'Elken Alpha-Lipid Lifeline',
    category: 'Nutrition',
    description: 'Premium colostrum supplement powered by New Image International. Rich in immunoglobulins, growth factors, and bioactive proteins.',
    key_features: '• Bovine colostrum\n• Immunoglobulins IgG, IgA, IgM\n• Growth factors\n• Probiotics added',
    benefits: 'Immune support, gut health, anti-ageing, energy, muscle recovery',
    price: 240.00,
  },
  {
    bot_id: BOT_ID, is_active: true, currency: 'MYR',
    name: 'Elken Spirulina',
    category: 'Nutrition',
    description: 'Certified organic spirulina tablets — nature\'s most complete superfood. Rich in protein, B-vitamins, iron, and antioxidants.',
    key_features: '• Certified organic\n• 60% protein by weight\n• Rich in B12 & iron\n• Antioxidant-rich',
    benefits: 'Energy boost, natural detox, iron supplementation, immune support',
    price: 110.00,
  },
  {
    bot_id: BOT_ID, is_active: true, currency: 'MYR',
    name: 'Elken Ganoderma Complex',
    category: 'Wellness',
    description: 'Potent formula combining Ganoderma (Reishi) extract with supporting herbal ingredients for cardiovascular and immune health.',
    key_features: '• Reishi mushroom extract\n• Standardised polysaccharides\n• Adaptogenic formula\n• No artificial additives',
    benefits: 'Heart health, liver support, immune boost, blood pressure support, stress adaptation',
    price: 180.00,
  },
  {
    bot_id: BOT_ID, is_active: true, currency: 'MYR',
    name: 'Elken Omega 369',
    category: 'Wellness',
    description: 'Balanced blend of Omega-3, 6, and 9 fatty acids from fish oil and evening primrose oil for cardiovascular and joint health.',
    key_features: '• Fish oil (EPA & DHA)\n• Evening primrose oil (GLA)\n• Oleic acid (Omega 9)\n• Enteric-coated softgels',
    benefits: 'Heart health, brain function, joint comfort, skin health, anti-inflammatory',
    price: 140.00,
  },
  {
    bot_id: BOT_ID, is_active: true, currency: 'MYR',
    name: 'Elken Bee Pollen',
    category: 'Nutrition',
    description: 'Pure bee pollen granules harvested from pristine environments. A natural source of protein, enzymes, vitamins, and amino acids.',
    key_features: '• 100% pure bee pollen\n• All 22 essential amino acids\n• Natural enzymes\n• No additives',
    benefits: 'Natural energy, endurance, mental clarity, protein supplementation, allergy resilience',
    price: 115.00,
  },
  {
    bot_id: BOT_ID, is_active: true, currency: 'MYR',
    name: 'Elken Royal Jelly',
    category: 'Nutrition',
    description: 'Premium freeze-dried royal jelly capsules. Known to support hormonal balance, skin health, and overall vitality.',
    key_features: '• Freeze-dried to preserve potency\n• 10-HDA content guaranteed\n• Hormone-balancing\n• Skin nourishing',
    benefits: 'Hormonal balance, skin health, anti-stress, anti-ageing, fertility support',
    price: 160.00,
  },
  {
    bot_id: BOT_ID, is_active: true, currency: 'MYR',
    name: 'Elken Fiber',
    category: 'Wellness',
    description: 'Prebiotic dietary fibre supplement that promotes digestive health, regularity, and gut microbiome balance.',
    key_features: '• Psyllium husk + inulin\n• Prebiotic formula\n• Gentle daily use\n• No laxative effect',
    benefits: 'Digestive health, regularity, detox support, cholesterol management, weight control',
    price: 85.00,
  },
]

// ─── Seed runner ──────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding Elken data for bot:', BOT_ID)

  // Services
  console.log('\n📋 Inserting GenQi services...')
  await supabase.from('services').delete().eq('bot_id', BOT_ID)
  const { error: servicesErr } = await supabase.from('services').insert(SERVICES)
  if (servicesErr) console.error('  ❌ Services error:', servicesErr.message)
  else console.log(`  ✅ ${SERVICES.length} services inserted`)

  // Operating hours
  console.log('\n🕐 Inserting operating hours...')
  const { error: hoursErr } = await supabase
    .from('operating_hours')
    .upsert(OPERATING_HOURS, { onConflict: 'bot_id,day_of_week', ignoreDuplicates: false })
  if (hoursErr) console.error('  ❌ Operating hours error:', hoursErr.message)
  else console.log(`  ✅ ${OPERATING_HOURS.length} operating hour rows inserted`)

  // FAQs
  console.log('\n❓ Inserting FAQs...')
  await supabase.from('faqs').delete().eq('bot_id', BOT_ID)
  const { error: faqsErr } = await supabase.from('faqs').insert(FAQS)
  if (faqsErr) console.error('  ❌ FAQs error:', faqsErr.message)
  else console.log(`  ✅ ${FAQS.length} FAQs inserted`)

  // Products
  console.log('\n🛍️  Inserting products...')
  await supabase.from('products').delete().eq('bot_id', BOT_ID)
  const { error: productsErr } = await supabase.from('products').insert(PRODUCTS)
  if (productsErr) console.error('  ❌ Products error:', productsErr.message)
  else console.log(`  ✅ ${PRODUCTS.length} products inserted`)

  console.log('\n✅ Elken seed complete!')
  console.log(`   Tenant ID : ${TENANT_ID}`)
  console.log(`   Bot ID    : ${BOT_ID}`)
  console.log('\n⚠️  Remember to run the embedding job on FAQs and products after seeding.')
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
