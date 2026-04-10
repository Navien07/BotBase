import { embedText } from '@/lib/ingest/embedder'
import { retrieveChunks, retrieveProducts } from '@/lib/rag/retrieve'
import type { PipelineContext, StepResult } from './types'

const PRODUCT_INTENTS = new Set(['browse_product', 'health_issue'])

export async function step6Rag(ctx: PipelineContext): Promise<StepResult> {
  // Use cached embedding from step-5, or re-embed if missing
  let embedding = ctx.messageEmbedding
  if (!embedding) {
    try {
      embedding = await embedText(ctx.message)
      ctx.messageEmbedding = embedding
    } catch (err) {
      console.error('[step-6-rag] embed error:', err)
      return {
        step: 6, name: 'rag',
        status: 'error',
        durationMs: 0,
        data: { error: 'embedding failed' },
      }
    }
  }

  const threshold = ctx.bot.rag_threshold ?? 0.55
  const chunks = await retrieveChunks(embedding, ctx.botId, threshold, 5)

  // Also retrieve products for relevant intents
  if (ctx.detectedIntent && PRODUCT_INTENTS.has(ctx.detectedIntent)) {
    const productChunks = await retrieveProducts(embedding, ctx.botId, threshold, 3)
    chunks.push(...productChunks)
  }

  // Sort by similarity descending, deduplicate
  const seen = new Set<string>()
  const deduped = chunks
    .sort((a, b) => b.similarity - a.similarity)
    .filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
    .slice(0, 6)

  ctx.ragChunks = deduped

  const topSimilarity = deduped[0]?.similarity ?? 0

  return {
    step: 6, name: 'rag',
    status: 'pass',
    durationMs: 0,
    data: {
      chunks_found: deduped.length,
      rag_found: deduped.length > 0,
      top_similarity: topSimilarity,
      intent: ctx.detectedIntent,
    },
  }
}
