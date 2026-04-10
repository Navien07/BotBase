import { embedText } from '@/lib/ingest/embedder'
import { retrieveFaqs } from '@/lib/rag/retrieve'
import type { PipelineContext, StepResult } from './types'

export async function step5Faqs(ctx: PipelineContext): Promise<StepResult> {
  // Embed the message (cached in context for step-6)
  let embedding: number[]
  try {
    embedding = await embedText(ctx.message)
    ctx.messageEmbedding = embedding
  } catch (err) {
    console.error('[step-5-faqs] embed error:', err)
    return {
      step: 5, name: 'faqs',
      status: 'error',
      durationMs: 0,
      data: { error: 'embedding failed' },
    }
  }

  const threshold = ctx.bot.rag_threshold ?? 0.55
  const faqResult = await retrieveFaqs(embedding, ctx.botId, threshold)

  if (faqResult) {
    ctx.faqResult = faqResult
    return {
      step: 5, name: 'faqs',
      status: 'pass',
      durationMs: 0,
      data: {
        faq_found: true,
        similarity: faqResult.similarity,
        question: faqResult.question.slice(0, 80),
      },
    }
  }

  return {
    step: 5, name: 'faqs',
    status: 'pass',
    durationMs: 0,
    data: { faq_found: false },
  }
}
