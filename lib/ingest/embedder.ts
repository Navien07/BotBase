// VoyageAI embedder — voyage-3-large, 1024 dimensions
// Note: voyageai ESM patch applied via postinstall (scripts/patch-voyageai-esm.cjs)
// serverExternalPackages: ['voyageai'] in next.config.ts

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VoyageAI = require('voyageai').default ?? require('voyageai')

const VOYAGE_MODEL = 'voyage-3-large'

function getClient() {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set')
  return new VoyageAI({ apiKey })
}

export async function embedText(text: string): Promise<number[]> {
  const client = getClient()
  const result = await client.embed({ input: [text], model: VOYAGE_MODEL })
  return result.data[0].embedding as number[]
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const client = getClient()
  const result = await client.embed({ input: texts, model: VOYAGE_MODEL })
  return (result.data as Array<{ embedding: number[] }>).map((d) => d.embedding)
}

export async function embedQuery(text: string): Promise<number[]> {
  return embedText(text)
}
