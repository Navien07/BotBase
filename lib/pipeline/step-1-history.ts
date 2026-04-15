import { createServiceClient } from '@/lib/supabase/service'
import type { PipelineContext, StepResult, HistoryTurn, BookingState } from './types'

export async function step1History(ctx: PipelineContext): Promise<StepResult> {
  const supabase = createServiceClient()

  const { data: messages, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', ctx.conversationId)
    .eq('bot_id', ctx.botId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[step-1-history] error:', error)
    return {
      step: 1, name: 'history',
      status: 'error',
      durationMs: 0,
      data: { error: error.message },
    }
  }

  // Reverse to get chronological order, take last 10 turns
  const history: HistoryTurn[] = (messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .reverse()
    .slice(-10)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  ctx.history = history

  // Check for active booking state
  const { data: conversation } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', ctx.conversationId)
    .single()

  const bookingState = (conversation?.metadata as Record<string, unknown>)?.booking_state as BookingState | undefined
  if (bookingState) {
    ctx.bookingState = bookingState
  }

  return {
    step: 1,
    name: 'history',
    status: 'pass',
    durationMs: 0,
    data: {
      turn_count: history.length,
      booking_state_active: !!bookingState,
    },
  }
}
