import type { FAQResult, RAGChunk } from '@/lib/pipeline/types'

export function buildFaqContext(faq: FAQResult): string {
  return `FAQ Match (similarity: ${(faq.similarity * 100).toFixed(0)}%):
Q: ${faq.question}
A: ${faq.answer}`
}

export function buildRagContext(chunks: RAGChunk[]): string {
  if (chunks.length === 0) return ''
  const parts = chunks.map((c, i) =>
    `[Source ${i + 1}] (similarity: ${(c.similarity * 100).toFixed(0)}%)\n${c.content}`
  )
  return `Relevant knowledge base content:\n\n${parts.join('\n\n---\n\n')}`
}

export function buildLiveApiContext(data: Record<string, unknown>): string {
  return `Live data:\n${JSON.stringify(data, null, 2)}`
}

export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4)
}
