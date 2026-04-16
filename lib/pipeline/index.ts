import { step1History } from './step-1-history'
import { step2Guardrails } from './step-2-guardrails'
import { step3Detect } from './step-3-detect'
import { step4Scripts } from './step-4-scripts'
import { step5Faqs } from './step-5-faqs'
import { step6Rag } from './step-6-rag'
import { step7LiveApi } from './step-7-live-api'
import { step8Booking } from './step-8-booking'
import { step9Prompt } from './step-9-prompt'
import { step10Llm } from './step-10-llm'
import type { PipelineContext, PipelineResult, StepResult } from './types'

function buildBlockResult(
  blockedStep: StepResult,
  steps: StepResult[],
  ctx: PipelineContext
): { stream: null; result: PipelineResult } {
  return {
    stream: null,
    result: {
      response: blockedStep.blockedResponse ?? '',
      isStream: false,
      steps,
      intent: ctx.detectedIntent,
      language: ctx.detectedLanguage ?? 'en',
      ragFound: false,
      ragDocumentIds: [],
      guardrailTriggered: blockedStep.name === 'guardrails',
      templateUsed: null,
      bookingActive: blockedStep.name === 'booking',
      totalDurationMs: Date.now() - ctx.startedAt,
    },
  }
}

export async function runPipeline(
  context: PipelineContext
): Promise<{ stream: ReadableStream<Uint8Array> | null; result: PipelineResult }> {
  const steps: StepResult[] = []

  async function runStep(
    stepFn: (ctx: PipelineContext) => Promise<StepResult>
  ): Promise<StepResult> {
    const start = Date.now()
    const result = await stepFn(context)
    result.durationMs = Date.now() - start
    steps.push(result)
    return result
  }

  // Step 1: Load history + check booking state
  await runStep(step1History)

  // Step 2: Guardrails — may block
  const s2 = await runStep(step2Guardrails)
  if (s2.status === 'block') return buildBlockResult(s2, steps, context)

  // Step 3: Detect intent + language
  await runStep(step3Detect)

  // Step 4: Scripts — may block
  const s4 = await runStep(step4Scripts)
  if (s4.status === 'block') return buildBlockResult(s4, steps, context)

  // Steps 5 + 6: FAQ + RAG (sequential — step-6 reuses step-5 embedding)
  await runStep(step5Faqs)
  await runStep(step6Rag)

  // Step 7: Live API data
  await runStep(step7LiveApi)

  // Step 8: Booking state machine — may block
  const s8 = await runStep(step8Booking)
  if (s8.status === 'block') return buildBlockResult(s8, steps, context)

  // Step 9: Assemble system prompt
  await runStep(step9Prompt)

  // Step 10: LLM — returns ReadableStream
  const { stream, stepResult: s10 } = await step10Llm(context, steps)
  s10.durationMs = 0 // stream hasn't finished yet
  steps.push(s10)

  return {
    stream,
    result: {
      response: null,
      isStream: true,
      steps,
      intent: context.detectedIntent,
      language: context.detectedLanguage ?? 'en',
      ragFound: context.ragChunks.length > 0,
      ragDocumentIds: [...new Set(context.ragChunks.map((c) => c.documentId))],
      guardrailTriggered: false,
      templateUsed: null,
      bookingActive: !!context.bookingState,
      totalDurationMs: Date.now() - context.startedAt,
    },
  }
}

export type { PipelineContext, PipelineResult } from './types'
