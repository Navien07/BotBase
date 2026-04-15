// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/

export interface HealthConcernMatch {
  concern: string
  recommendedServices: string[]   // service names from GenQi catalogue
  recommendedProducts: string[]   // Elken product names
  responseHint: string            // guidance text to inject into LLM context
}

/**
 * Map of health concern keywords (EN/MS/ZH) to GenQi service + product recommendations.
 * Keys are lowercase regex-safe keyword patterns.
 */
const HEALTH_CONCERN_MAP: Array<{
  keywords: string[]
  match: HealthConcernMatch
}> = [
  {
    keywords: [
      'back pain', 'backache', 'sakit belakang', 'sakit pinggang', '背痛', '腰痛',
    ],
    match: {
      concern: 'Back Pain / Sakit Belakang / 背痛',
      recommendedServices: ['Far Infrared (FIR) Therapy', 'Magnetic Resonance Stimulation (MRS)', 'E-Power Therapy'],
      recommendedProducts: ['Elken Jointcare', 'Elken Omega 369'],
      responseHint: 'The customer is experiencing back pain. GenQi FIR Therapy helps relieve muscle tension and improve circulation. MRS therapy is also highly effective for musculoskeletal pain.',
    },
  },
  {
    keywords: [
      'joint pain', 'arthritis', 'sakit sendi', 'sakit lutut', '关节痛', '关节炎', '膝盖痛',
    ],
    match: {
      concern: 'Joint Pain / Sakit Sendi / 关节痛',
      recommendedServices: ['Far Infrared (FIR) Therapy', 'Magnetic Resonance Stimulation (MRS)'],
      recommendedProducts: ['Elken Jointcare', 'Elken Omega 369', 'Elken Glucosamine'],
      responseHint: 'The customer has joint pain or arthritis. FIR and MRS therapies help reduce inflammation and improve joint mobility.',
    },
  },
  {
    keywords: [
      'fatigue', 'tired', 'exhausted', 'keletihan', 'penat', 'lesu', '疲劳', '疲惫', '乏力',
    ],
    match: {
      concern: 'Fatigue / Keletihan / 疲劳',
      recommendedServices: ['E-Power Therapy', 'Far Infrared (FIR) Therapy', 'GenQi Wellness Consultation'],
      recommendedProducts: ['Elken Spirulina', 'Elken Bee Pollen', 'Elken Alpha-Lipid Lifeline'],
      responseHint: 'The customer is experiencing fatigue. E-Power Therapy boosts energy at the cellular level. Spirulina and Bee Pollen are excellent natural energy supplements.',
    },
  },
  {
    keywords: [
      'weight', 'overweight', 'obesity', 'slim', 'diet', 'berat badan', 'gemuk', 'kurus', '体重', '减肥', '肥胖', '瘦身',
    ],
    match: {
      concern: 'Weight Management / Pengurusan Berat / 体重管理',
      recommendedServices: ['Body Composition Analysis (BCA)', 'GenQi Wellness Consultation', 'Far Infrared (FIR) Therapy'],
      recommendedProducts: ['Elken NutriPlus Shake', 'Elken Fiber'],
      responseHint: 'The customer is concerned about weight. BCA measures body fat, muscle, and water percentages. FIR therapy supports metabolism. NutriPlus meal replacement is popular for weight management.',
    },
  },
  {
    keywords: [
      'detox', 'detoxify', 'cleanse', 'toxin', 'detoksifikasi', 'buang toksin', '排毒', '解毒',
    ],
    match: {
      concern: 'Detox / Detoksifikasi / 排毒',
      recommendedServices: ['Ion Detox Footbath', 'Far Infrared (FIR) Therapy', 'GenQi Wellness Consultation'],
      recommendedProducts: ['Elken Fiber', 'Elken Chlorophyll'],
      responseHint: 'The customer wants to detox. Ion Detox Footbath draws toxins through the feet. FIR therapy promotes sweating and lymphatic drainage. Elken Fiber and Chlorophyll support internal cleansing.',
    },
  },
  {
    keywords: [
      'blood pressure', 'hypertension', 'high blood', 'tekanan darah', 'darah tinggi', '血压', '高血压',
    ],
    match: {
      concern: 'Blood Pressure / Tekanan Darah / 血压',
      recommendedServices: ['Bio-Energy Scan', 'GenQi Wellness Consultation', 'E-Power Therapy'],
      recommendedProducts: ['Elken Omega 369', 'Elken Ganoderma Complex'],
      responseHint: 'The customer has blood pressure concerns. The Bio-Energy Scan provides a holistic health overview. Omega 369 and Ganoderma are known to support cardiovascular health.',
    },
  },
  {
    keywords: [
      'diabetes', 'blood sugar', 'kencing manis', 'gula darah', '糖尿病', '血糖',
    ],
    match: {
      concern: 'Diabetes / Kencing Manis / 糖尿病',
      recommendedServices: ['Bio-Energy Scan', 'Body Composition Analysis (BCA)', 'GenQi Wellness Consultation'],
      recommendedProducts: ['Elken Spirulina', 'Elken Omega 369', 'Elken Ganoderma Complex'],
      responseHint: 'The customer has diabetes concerns. Bio-Energy Scan and BCA provide health baselines. Spirulina and Ganoderma have properties that may support blood sugar management.',
    },
  },
  {
    keywords: [
      'sleep', 'insomnia', 'cannot sleep', 'tidur', 'susah tidur', 'tidak boleh tidur', '睡眠', '失眠', '睡不着',
    ],
    match: {
      concern: 'Sleep Issues / Masalah Tidur / 睡眠问题',
      recommendedServices: ['E-Power Therapy', 'Far Infrared (FIR) Therapy', 'GenQi Wellness Consultation'],
      recommendedProducts: ['Elken Melatonin', 'Elken Royal Jelly'],
      responseHint: 'The customer has sleep problems. E-Power Therapy and FIR promote relaxation and improve sleep quality. Royal Jelly supports overall wellness.',
    },
  },
  {
    keywords: [
      'stress', 'anxiety', 'tension', 'tekanan', 'stress', 'kebimbangan', '压力', '焦虑', '紧张',
    ],
    match: {
      concern: 'Stress / Tekanan / 压力',
      recommendedServices: ['Far Infrared (FIR) Therapy', 'E-Power Therapy', 'GenQi Wellness Consultation'],
      recommendedProducts: ['Elken Royal Jelly', 'Elken Bee Pollen'],
      responseHint: 'The customer is dealing with stress or anxiety. FIR therapy promotes relaxation. Royal Jelly and Bee Pollen help support adrenal function and mental clarity.',
    },
  },
  {
    keywords: [
      'skin', 'complexion', 'acne', 'ageing', 'aging', 'kulit', 'jerawat', 'penuaan', '皮肤', '痘痘', '老化', '美白',
    ],
    match: {
      concern: 'Skin / Kulit / 皮肤',
      recommendedServices: ['Far Infrared (FIR) Therapy', 'Ion Detox Footbath', 'GenQi Wellness Consultation'],
      recommendedProducts: ['Elken Alpha-Lipid Lifeline', 'Elken Collagen', 'Elken Chlorophyll'],
      responseHint: 'The customer is concerned about skin health. FIR improves circulation which benefits skin. Alpha-Lipid colostrum and Collagen support skin repair and anti-ageing.',
    },
  },
  {
    keywords: [
      'circulation', 'blood flow', 'cold hands', 'cold feet', 'peredaran darah', 'tangan sejuk', '血液循环', '手脚冰冷',
    ],
    match: {
      concern: 'Circulation / Peredaran Darah / 血液循环',
      recommendedServices: ['Far Infrared (FIR) Therapy', 'E-Power Therapy', 'Ion Detox Footbath'],
      recommendedProducts: ['Elken Omega 369', 'Elken Ganoderma Complex'],
      responseHint: 'The customer has poor circulation. FIR therapy is specifically effective at improving microcirculation. E-Power Therapy also enhances cellular charge and circulation.',
    },
  },
]

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan user message text for health concern keywords.
 * Returns all matching concern records (may be multiple matches).
 */
export function resolveHealthConcerns(text: string): HealthConcernMatch[] {
  const lower = text.toLowerCase()
  const matches: HealthConcernMatch[] = []
  const seen = new Set<string>()

  for (const entry of HEALTH_CONCERN_MAP) {
    if (seen.has(entry.match.concern)) continue
    const hit = entry.keywords.some((kw) => lower.includes(kw.toLowerCase()))
    if (hit) {
      matches.push(entry.match)
      seen.add(entry.match.concern)
    }
  }

  return matches
}

/**
 * Build a context hint string for the LLM system prompt injection.
 * Summarises all detected health concerns and recommendations.
 */
export function buildHealthContextHint(matches: HealthConcernMatch[]): string {
  if (matches.length === 0) return ''
  const parts = matches.map((m) => {
    const services = m.recommendedServices.join(', ')
    const products = m.recommendedProducts.join(', ')
    return `[${m.concern}]\n  GenQi services: ${services}\n  Elken products: ${products}\n  Guidance: ${m.responseHint}`
  })
  return `HEALTH CONCERN CONTEXT:\n${parts.join('\n\n')}`
}
