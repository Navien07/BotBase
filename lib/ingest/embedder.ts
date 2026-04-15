// VoyageAI embedder — voyage-3-large, 1024 dimensions
//
// Uses raw fetch instead of the voyageai SDK.
// Turbopack mangles class constructors even with serverExternalPackages,
// and `new VoyageAI()` was resolving to "t is not a constructor" at runtime.
// Raw fetch uses only Node.js built-ins — no class instantiation.

const VOYAGE_BASE = 'https://api.voyageai.com/v1'
const VOYAGE_MODEL = 'voyage-3-large'

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>
  usage: { total_tokens: number }
}

async function fetchEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set')

  const response = await fetch(`${VOYAGE_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`VoyageAI API error ${response.status}: ${errText}`)
  }

  const data = (await response.json()) as VoyageResponse
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

export async function embedText(text: string): Promise<number[]> {
  const embeddings = await fetchEmbeddings([text])
  return embeddings[0]
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  return fetchEmbeddings(texts)
}

export async function embedQuery(text: string): Promise<number[]> {
  return embedText(text)
}
