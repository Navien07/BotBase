import { runBookingMachine } from '@/lib/booking/state-machine'
import { createServiceClient } from '@/lib/supabase/service'
import type { PipelineContext, StepResult } from './types'

export async function step8Booking(ctx: PipelineContext): Promise<StepResult> {
  const bookingEnabled = ctx.bot.feature_flags?.booking_enabled ?? false

  // If booking state is active (from step-1) — route to machine
  if (ctx.bookingState) {
    const result = await runBookingMachine(ctx, ctx.message)
    if (result) {
      // Update conversation metadata with new booking state
      await updateBookingState(ctx.conversationId, result.nextState, result.updatedData)

      return {
        step: 8, name: 'booking',
        status: 'block',
        durationMs: 0,
        data: {
          reason: 'active_booking_state',
          next_state: result.nextState,
          booking_type: ctx.bookingState.type,
        },
        blockedResponse: result.response,
      }
    }
  }

  // Start new booking flow if intent detected
  if (bookingEnabled && ctx.detectedIntent === 'book_session') {
    const bookingType = ctx.bot.feature_flags?.booking_type ?? 'appointment'
    const initialState = { step: 'collect_name', type: bookingType, data: {} }
    ctx.bookingState = initialState

    const result = await runBookingMachine(ctx, ctx.message)
    if (result) {
      await updateBookingState(ctx.conversationId, result.nextState, result.updatedData)

      return {
        step: 8, name: 'booking',
        status: 'block',
        durationMs: 0,
        data: { reason: 'booking_started', booking_type: bookingType },
        blockedResponse: result.response,
      }
    }
  }

  return {
    step: 8, name: 'booking',
    status: 'skip',
    durationMs: 0,
    data: {
      booking_enabled: bookingEnabled,
      intent: ctx.detectedIntent,
    },
  }
}

async function updateBookingState(
  conversationId: string,
  nextState: string | null,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()

  if (!nextState) {
    // Booking complete — clear booking_state
    const { data: conv } = await supabase
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single()

    const metadata = (conv?.metadata as Record<string, unknown>) ?? {}
    delete metadata.booking_state

    await supabase
      .from('conversations')
      .update({ metadata })
      .eq('id', conversationId)
  } else {
    const { data: conv } = await supabase
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .single()

    const metadata = (conv?.metadata as Record<string, unknown>) ?? {}
    metadata.booking_state = { step: nextState, data }

    await supabase
      .from('conversations')
      .update({ metadata })
      .eq('id', conversationId)
  }
}
