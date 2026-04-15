// lib/pipeline/step-8-booking.ts — Booking state machine integration

import {
  isBookingStateActive,
  getInitialState,
  getNextStep,
  buildPromptForStep,
} from '@/lib/booking/state-machine'
import { createServiceClient } from '@/lib/supabase/service'
import { getTenantBookingHandler } from '@/lib/tenants'
import type { PipelineContext, StepResult } from './types'
import type { BookingState, Service } from '@/lib/booking/types'

export async function step8Booking(ctx: PipelineContext): Promise<StepResult> {
  const start = Date.now()

  // ── Tenant plugin hook — runs before generic state machine ──────────────────
  const tenantResult = await getTenantBookingHandler(ctx, start)
  if (tenantResult !== null) return tenantResult

  const bookingEnabled = ctx.bot.feature_flags?.booking_enabled ?? false
  const supabase = createServiceClient()

  // Pre-fetch active services (needed for prompt generation + service resolution)
  let services: Service[] = []
  if (bookingEnabled) {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('bot_id', ctx.botId)
      .eq('is_active', true)
      .order('created_at')
    services = (data as Service[] | null) ?? []
  }

  // ── RULE 6: booking state takes priority over intent detection ──────────────

  const currentState = ctx.bookingState as BookingState | null

  if (isBookingStateActive(currentState)) {
    const newState = getNextStep(currentState!, ctx.message, services)
    const response = buildPromptForStep(newState, services)

    if (newState.step === 'confirmed') {
      // Create the booking record, then clear state
      await createBookingRecord(ctx, newState)
      await persistBookingState(ctx.conversationId, null)
    } else {
      await persistBookingState(ctx.conversationId, newState)
    }

    return {
      step: 8,
      name: 'booking',
      status: 'block',
      durationMs: Date.now() - start,
      data: {
        booking_type: currentState!.type,
        previous_step: currentState!.step,
        next_step: newState.step,
      },
      blockedResponse: response,
    }
  }

  // ── Start new booking flow when intent = book_session ──────────────────────

  if (bookingEnabled && ctx.detectedIntent === 'book_session') {
    const bookingType = ctx.bot.feature_flags?.booking_type ?? 'appointment'
    const initialState = getInitialState(bookingType)
    const response = buildPromptForStep(initialState, services)

    await persistBookingState(ctx.conversationId, initialState)
    ctx.bookingState = initialState as unknown as typeof ctx.bookingState

    return {
      step: 8,
      name: 'booking',
      status: 'block',
      durationMs: Date.now() - start,
      data: { reason: 'booking_started', booking_type: bookingType },
      blockedResponse: response,
    }
  }

  return {
    step: 8,
    name: 'booking',
    status: 'skip',
    durationMs: Date.now() - start,
    data: {
      booking_enabled: bookingEnabled,
      intent: ctx.detectedIntent,
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function persistBookingState(
  conversationId: string,
  state: BookingState | null
): Promise<void> {
  const supabase = createServiceClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single()

  const metadata = (conv?.metadata as Record<string, unknown>) ?? {}

  if (state === null) {
    delete metadata.booking_state
  } else {
    metadata.booking_state = state
  }

  await supabase
    .from('conversations')
    .update({ metadata })
    .eq('id', conversationId)
}

async function createBookingRecord(
  ctx: PipelineContext,
  state: BookingState
): Promise<void> {
  const supabase = createServiceClient()
  const d = state.data

  // Try to parse datetime from free text; fall back to now + 1 day
  let startTime: Date
  try {
    const parsed = new Date(d.datetime ?? '')
    startTime = isNaN(parsed.getTime()) ? defaultStartTime() : parsed
  } catch {
    startTime = defaultStartTime()
  }

  await supabase.from('bookings').insert({
    bot_id: ctx.botId,
    contact_id: ctx.contactId,
    booking_type: state.type,
    service_id: d.serviceId ?? null,
    service_name: d.serviceName ?? null,
    start_time: startTime.toISOString(),
    customer_name: d.customerName ?? null,
    customer_phone: d.customerPhone ?? null,
    party_size: d.partySize ?? 1,
    special_requests: d.specialRequests ?? null,
    status: 'pending',
    channel: ctx.channel,
    audit_log: [{ action: 'created', at: new Date().toISOString(), via: 'chat' }],
  })
}

function defaultStartTime(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}
