// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/

export interface ElkenProductEntry {
  id: string
  name: string
  category: 'nutrition' | 'wellness' | 'beauty' | 'device'
  description: string
  keyBenefits: string[]
  priceRange: string        // e.g. "RM 120 – RM 180"
  targetConcerns: string[]  // keywords that map to this product
}

export const ELKEN_PRODUCT_CATALOG: ElkenProductEntry[] = [
  {
    id: 'nutriplus-shake',
    name: 'Elken NutriPlus Shake',
    category: 'nutrition',
    description: 'A nutritionally complete meal replacement shake with 22 vitamins and minerals, high-quality protein, and dietary fibre. Available in chocolate, vanilla, and strawberry flavours.',
    keyBenefits: ['Weight management', 'High protein', 'Balanced nutrition', 'Easy meal replacement'],
    priceRange: 'RM 120 – RM 180',
    targetConcerns: ['weight', 'diet', 'meal replacement', 'nutrition', 'slim', 'berat badan', '减肥', '营养'],
  },
  {
    id: 'alpha-lipid-lifeline',
    name: 'Elken Alpha-Lipid Lifeline',
    category: 'nutrition',
    description: 'Premium colostrum supplement powered by New Image International. Rich in immunoglobulins, growth factors, and bioactive proteins to support immune function, gut health, and vitality.',
    keyBenefits: ['Immune support', 'Gut health', 'Anti-ageing', 'Energy boost'],
    priceRange: 'RM 200 – RM 280',
    targetConcerns: ['immune', 'immunity', 'colostrum', 'imun', 'anti-ageing', '免疫', '初乳', '抗衰老'],
  },
  {
    id: 'spirulina',
    name: 'Elken Spirulina',
    category: 'nutrition',
    description: 'Certified organic spirulina tablets — one of nature\'s most complete superfoods. Rich in protein, B-vitamins, iron, and antioxidants.',
    keyBenefits: ['Energy', 'Detox', 'Iron-rich', 'Antioxidant'],
    priceRange: 'RM 80 – RM 150',
    targetConcerns: ['energy', 'fatigue', 'detox', 'spirulina', 'superfood', '螺旋藻', '能量', '排毒'],
  },
  {
    id: 'bee-pollen',
    name: 'Elken Bee Pollen',
    category: 'nutrition',
    description: 'Pure bee pollen granules harvested from pristine environments. A natural source of protein, enzymes, vitamins, and amino acids that support energy and endurance.',
    keyBenefits: ['Natural energy', 'Protein source', 'Endurance', 'Mental clarity'],
    priceRange: 'RM 90 – RM 140',
    targetConcerns: ['energy', 'fatigue', 'bee pollen', 'bee', 'pollen', '花粉', '蜂花粉'],
  },
  {
    id: 'royal-jelly',
    name: 'Elken Royal Jelly',
    category: 'nutrition',
    description: 'Premium freeze-dried royal jelly capsules. Known to support hormonal balance, skin health, stress resilience, and overall vitality.',
    keyBenefits: ['Hormonal balance', 'Skin health', 'Anti-stress', 'Anti-ageing'],
    priceRange: 'RM 110 – RM 200',
    targetConcerns: ['royal jelly', 'hormones', 'skin', 'stress', 'jelly diraja', '蜂王浆', '皮肤', '荷尔蒙'],
  },
  {
    id: 'ganoderma-complex',
    name: 'Elken Ganoderma Complex',
    category: 'wellness',
    description: 'A potent formula combining Ganoderma (Reishi mushroom) extract with supporting herbal ingredients. Traditionally used to support cardiovascular health, liver function, and immunity.',
    keyBenefits: ['Heart health', 'Liver support', 'Immune boost', 'Blood pressure'],
    priceRange: 'RM 130 – RM 220',
    targetConcerns: ['ganoderma', 'reishi', 'blood pressure', 'heart', 'liver', 'tekanan darah', 'jantung', '灵芝', '血压', '心脏'],
  },
  {
    id: 'omega-369',
    name: 'Elken Omega 369',
    category: 'wellness',
    description: 'Balanced blend of Omega-3, 6, and 9 fatty acids from fish oil and evening primrose oil. Supports cardiovascular health, brain function, joint comfort, and skin health.',
    keyBenefits: ['Heart health', 'Brain function', 'Joint comfort', 'Skin health'],
    priceRange: 'RM 100 – RM 170',
    targetConcerns: ['omega', 'fish oil', 'joint', 'heart', 'brain', 'omega 3', 'sendi', '欧米茄', '鱼油', '关节'],
  },
  {
    id: 'fiber',
    name: 'Elken Fiber',
    category: 'nutrition',
    description: 'A prebiotic dietary fibre supplement that promotes digestive health, regularity, and gut microbiome balance. Gentle and suitable for daily use.',
    keyBenefits: ['Digestive health', 'Regularity', 'Detox support', 'Gut flora'],
    priceRange: 'RM 70 – RM 120',
    targetConcerns: ['fiber', 'fibre', 'constipation', 'digestion', 'gut', 'sembelit', 'penghadaman', '纤维', '便秘', '消化'],
  },
  {
    id: 'chlorophyll',
    name: 'Elken Chlorophyll',
    category: 'wellness',
    description: 'Liquid chlorophyll supplement made from alfalfa. Supports internal cleansing, blood health, and body odour control.',
    keyBenefits: ['Internal cleansing', 'Blood building', 'Deodorising', 'Alkalising'],
    priceRange: 'RM 60 – RM 100',
    targetConcerns: ['chlorophyll', 'klorofil', 'detox', 'cleanse', 'blood', '叶绿素', '排毒'],
  },
  {
    id: 'genqi-device',
    name: 'GenQi Home Wellness Device',
    category: 'device',
    description: 'Compact home-use bio-energy device for daily wellness maintenance. Provides mild electrical stimulation to support circulation and cellular vitality.',
    keyBenefits: ['Home wellness', 'Circulation', 'Convenience', 'Daily use'],
    priceRange: 'RM 1,500 – RM 3,000',
    targetConcerns: ['device', 'machine', 'home use', 'genqi device', 'alat', '仪器', '家用'],
  },
]

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Find Elken products matching a user's query text.
 * Returns up to 3 best-matching products.
 */
export function resolveProductQuery(query: string): ElkenProductEntry[] {
  const lower = query.toLowerCase()
  const scored: Array<{ product: ElkenProductEntry; score: number }> = []

  for (const product of ELKEN_PRODUCT_CATALOG) {
    let score = 0

    // Direct name match is highest priority
    if (product.name.toLowerCase().includes(lower)) score += 10
    if (product.id.toLowerCase().includes(lower)) score += 8

    // Check concern keywords
    for (const concern of product.targetConcerns) {
      if (lower.includes(concern.toLowerCase())) score += 3
      if (concern.toLowerCase().includes(lower)) score += 2
    }

    // Check category
    if (product.category.toLowerCase().includes(lower)) score += 1

    if (score > 0) scored.push({ product, score })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.product)
}

/** Format a product entry into a WhatsApp/Telegram-friendly message */
export function formatProductMessage(product: ElkenProductEntry): string {
  const benefits = product.keyBenefits.map((b) => `• ${b}`).join('\n')
  return `*${product.name}*\n\n${product.description}\n\n*Key Benefits:*\n${benefits}\n\n💰 Price Range: ${product.priceRange}\n\nWould you like more details, or shall I help you place an order?`
}

/** Format multiple products as a numbered list for selection */
export function formatProductList(products: ElkenProductEntry[]): string {
  if (products.length === 0) return 'I couldn\'t find a specific product match. Please describe what you\'re looking for and I\'ll do my best to help!'
  const list = products.map((p, i) => `${i + 1}. *${p.name}* — ${p.priceRange}`).join('\n')
  return `Here are some Elken products that may help:\n\n${list}\n\nReply with the number for more details, or ask me anything else about our products!`
}

// ─── Filename parser for brochure metadata ────────────────────────────────────

type ElkenDocLang = 'en' | 'bm' | 'zh' | 'trilingual'

export interface ElkenParsedFilename {
  category: string
  productLine: string
  subProduct?: string
  productName: string
  language: ElkenDocLang
}

const VALID_LANGS: ElkenDocLang[] = ['en', 'bm', 'zh', 'trilingual']

function humanize(s: string): string {
  return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Parse an Elken filename to extract product metadata.
 *
 * Convention: {category}_{product-line}[_{sub-product}]_{language}.pdf
 * Also handles legacy prefix: BM_, CH_, EN_ (mapped to bm/zh/en).
 *
 * Returns null if the filename doesn't match the convention.
 */
export function parseElkenFilename(filename: string): ElkenParsedFilename | null {
  let name = filename.replace(/\.pdf$/i, '').replace(/\.docx?$/i, '')

  // Handle legacy prefix convention: BM_, CH_, EN_
  let prefixLang: ElkenDocLang | null = null
  if (/^BM_/i.test(name)) {
    prefixLang = 'bm'
    name = name.replace(/^BM_/i, '')
  } else if (/^CH_/i.test(name)) {
    prefixLang = 'zh'
    name = name.replace(/^CH_/i, '')
  } else if (/^EN_/i.test(name)) {
    prefixLang = 'en'
    name = name.replace(/^EN_/i, '')
  }

  const parts = name.split('_')

  if (prefixLang) {
    // After stripping prefix: {category}_{product-line}[_{sub-product}]
    if (parts.length < 2) return null
    const category = parts[0]
    const productParts = parts.slice(1)
    const productLine = productParts[0]
    const subProduct = productParts.length > 1 ? productParts.slice(1).map(humanize).join(' ') : undefined
    const productName = humanize(productParts.join('-'))
    return { category, productLine, subProduct, productName, language: prefixLang }
  }

  // Standard convention: last part is language
  if (parts.length < 3) return null
  const maybeLang = parts[parts.length - 1].toLowerCase() as ElkenDocLang
  if (!VALID_LANGS.includes(maybeLang)) return null

  const category = parts[0]
  const productParts = parts.slice(1, -1)
  const productLine = productParts[0]
  const subProduct = productParts.length > 1 ? productParts.slice(1).map(humanize).join(' ') : undefined
  const productName = humanize(productParts.join('-'))

  return { category, productLine, subProduct, productName, language: maybeLang }
}
