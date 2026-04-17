// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/

import { createServiceClient } from '@/lib/supabase/service'
import { anthropic } from '@/lib/anthropic'
import {
  ELKEN_BOT_ID,
  ELKEN_LOCATIONS,
  ELKEN_FACILITIES,
} from '@/lib/tenants/elken/config'
import type { ElkenFacilityId, ElkenLocation } from '@/lib/tenants/elken/config'
import { bookingMsg } from '@/lib/tenants/elken/i18n/scripts'
import { checkElkenSlot } from '@/lib/tenants/elken/booking/slot-checker'
import { dispatchAdminNotification, scheduleElkenNotifications } from '@/lib/tenants/elken/booking/notifications'
import type { ElkenBookingState, ElkenLang, ElkenTrialType } from '@/lib/tenants/elken/booking/types'
import type { PipelineContext, StepResult } from '@/lib/pipeline/types'
import { parseMYDatetime, defaultStartTime, todayMYT } from '@/lib/booking/datetime'

const TTL_MS = 30 * 60 * 1000

// Facilities listed per location (determines number-key order in prompts)
const LOCATION_FACILITIES: Record<ElkenLocation, ElkenFacilityId[]> = {
  okr:    ['bed_female', 'bed_male', 'room_small', 'room_large', 'inhaler'],
  subang: ['bed_female', 'bed_male', 'inhaler'],
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Elken booking handler — registered in lib/tenants/index.ts.
 * Returns StepResult to short-circuit the generic pipeline, or null to fall through.
 */
export async function handleElkenBookingFlow(
  ctx: PipelineContext,
  start: number
): Promise<StepResult | null> {
  if (ctx.botId !== ELKEN_BOT_ID) return null

  const lang = toElkenLang(ctx.detectedLanguage ?? ctx.language)

  // Detect existing Elken state (discriminate from generic BookingState via bot_id field)
  const raw = ctx.bookingState as unknown as ElkenBookingState | null
  const isElkenState =
    raw !== null &&
    typeof raw === 'object' &&
    'bot_id' in raw &&
    (raw as ElkenBookingState).bot_id === ELKEN_BOT_ID
  const currentState: ElkenBookingState | null = isElkenState ? (raw as ElkenBookingState) : null

  // ── TTL check ──────────────────────────────────────────────────────────────
  if (currentState && Date.now() - currentState.created_at > TTL_MS) {
    await persistElkenState(ctx.conversationId, null)
    const freshState = makeInitialState(lang, ctx.botId)
    await persistElkenState(ctx.conversationId, freshState)
    return blockResult(start, { tenant: 'elken', reason: 'ttl_expired' }, bookingMsg('location_prompt', lang))
  }

  // ── Entry: new booking intent ──────────────────────────────────────────────
  if (!currentState && ctx.detectedIntent === 'book_session') {
    const newState = makeInitialState(lang, ctx.botId)
    await persistElkenState(ctx.conversationId, newState)
    return blockResult(start, { tenant: 'elken', reason: 'booking_started' }, bookingMsg('location_prompt', lang))
  }

  // ── No active Elken state, not a booking intent → fall through ─────────────
  if (!currentState) return null

  // ── Advance state machine ──────────────────────────────────────────────────
  try {
    const { nextState, response } = await advanceElkenState(currentState, ctx)

    if (nextState.step === 'confirmed') {
      await persistElkenState(ctx.conversationId, null)
    } else {
      await persistElkenState(ctx.conversationId, nextState)
    }

    return blockResult(start, {
      tenant: 'elken',
      previous_step: currentState.step,
      next_step: nextState.step,
      location: nextState.location,
      facility: nextState.facility,
    }, response)
  } catch (err) {
    console.error('[ElkenSM] State machine error:', err)
    await persistElkenState(ctx.conversationId, null)
    return blockResult(start, { tenant: 'elken', error: true }, bookingMsg('location_prompt', lang))
  }
}

// ─── State machine ────────────────────────────────────────────────────────────

async function advanceElkenState(
  state: ElkenBookingState,
  ctx: PipelineContext
): Promise<{ nextState: ElkenBookingState; response: string }> {
  const { lang } = state
  const input = ctx.message.trim()

  switch (state.step) {

    case 'location': {
      const location = parseLocation(input)
      if (!location) {
        return { nextState: state, response: bookingMsg('location_prompt', lang) }
      }
      const nextState: ElkenBookingState = { ...state, step: 'facility', location }
      const key = location === 'okr' ? 'facility_okr' : 'facility_subang'
      return { nextState, response: bookingMsg(key, lang) }
    }

    case 'facility': {
      const facilityId = parseFacility(input, state.location!)
      if (!facilityId) {
        const key = state.location === 'okr' ? 'facility_okr' : 'facility_subang'
        return { nextState: state, response: bookingMsg(key, lang) }
      }

      // Meeting rooms only available at OKR
      if ((facilityId === 'room_small' || facilityId === 'room_large') && state.location === 'subang') {
        return { nextState: state, response: bookingMsg('facility_invalid_for_location', lang) }
      }

      const facilityLbl = ELKEN_FACILITIES[facilityId].label[lang]
      const nextState: ElkenBookingState = { ...state, step: 'datetime_and_details', facility: facilityId }

      if (facilityId === 'inhaler') {
        return { nextState, response: bookingMsg('inhaler_details_prompt', lang, { facility: facilityLbl }) }
      }
      if (facilityId === 'room_small' || facilityId === 'room_large') {
        return { nextState, response: bookingMsg('meeting_details_prompt', lang, { facility: facilityLbl }) }
      }
      // bed_female | bed_male | bed_unisex
      return { nextState, response: bookingMsg('bed_details_prompt', lang, { facility: facilityLbl }) }
    }

    case 'datetime_and_details': {
      const extracted = await extractDetailsWithHaiku(input, state.facility ?? '')
      const nextState: ElkenBookingState = {
        ...state,
        preferred_datetime: extracted.preferred_datetime ?? state.preferred_datetime,
        customer_name:       extracted.customer_name    ?? state.customer_name,
        contact:             extracted.contact          ?? state.contact,
        is_member:           extracted.is_member        ?? state.is_member,
        duration:            extracted.duration         ?? state.duration,
      }

      const slotCheck = await checkElkenSlot(nextState)
      const facilityId  = nextState.facility as ElkenFacilityId
      const facilityLbl = ELKEN_FACILITIES[facilityId]?.label[lang] ?? facilityId
      const name        = nextState.customer_name ?? '?'
      const datetime    = nextState.preferred_datetime ?? '?'

      if (!slotCheck.available) {
        const alternatives = slotCheck.alternatives.length > 0
          ? slotCheck.alternatives.join(', ')
          : '—'
        return {
          nextState: { ...nextState, step: 'datetime_and_details' },
          response:  bookingMsg('slot_full', lang, { alternatives }),
        }
      }

      // ── Branch by facility type ──────────────────────────────────────────
      if (facilityId === 'room_small' || facilityId === 'room_large') {
        return {
          nextState: { ...nextState, step: 'member_id' },
          response:  bookingMsg('meeting_member_id_prompt', lang, { name, datetime, facility: facilityLbl }),
        }
      }

      if (facilityId.startsWith('bed_')) {
        if (nextState.is_member === true) {
          return {
            nextState: { ...nextState, step: 'bes_device' },
            response:  bookingMsg('bed_bes_prompt', lang, { name, datetime, facility: facilityLbl }),
          }
        }
        // Non-member (or unknown → treated as non-member)
        return {
          nextState: { ...nextState, step: 'trial_type' },
          response:  bookingMsg('bed_trial_prompt', lang, { name, datetime, facility: facilityLbl }),
        }
      }

      // inhaler — confirm immediately
      const bookingId = await createElkenBooking(ctx, nextState)
      if (bookingId) {
        dispatchAdminNotification(ELKEN_BOT_ID, bookingId, 'booking_created')
          .catch((e: unknown) => console.error('[ElkenSM] Admin notification failed:', e))
        scheduleElkenNotifications(
          ELKEN_BOT_ID, bookingId, ctx.userId, ctx.channel,
          nextState.preferred_datetime ?? '', nextState.customer_name ?? '',
          lang, nextState.is_member ?? false
        ).catch((err: unknown) => console.error('[ElkenBooking] Schedule notifications failed:', err))
      }
      return {
        nextState: { ...nextState, step: 'confirmed' },
        response:  bookingMsg('inhaler_confirmed', lang, {
          name,
          datetime,
          duration: nextState.duration ?? '',
        }),
      }
    }

    case 'member_id': {
      const nextState: ElkenBookingState = { ...state, member_id: input }
      const bookingId = await createElkenBooking(ctx, nextState)
      if (bookingId) {
        dispatchAdminNotification(ELKEN_BOT_ID, bookingId, 'booking_created')
          .catch((e: unknown) => console.error('[ElkenSM] Admin notification failed:', e))
        scheduleElkenNotifications(
          ELKEN_BOT_ID, bookingId, ctx.userId, ctx.channel,
          nextState.preferred_datetime ?? '', nextState.customer_name ?? '',
          lang, nextState.is_member ?? false
        ).catch((err: unknown) => console.error('[ElkenBooking] Schedule notifications failed:', err))
      }
      const facilityLbl = ELKEN_FACILITIES[nextState.facility as ElkenFacilityId]?.label[lang] ?? ''
      return {
        nextState: { ...nextState, step: 'confirmed' },
        response:  bookingMsg('meeting_confirmed', lang, {
          name:     nextState.customer_name ?? '?',
          facility: facilityLbl,
          datetime: nextState.preferred_datetime ?? '?',
        }),
      }
    }

    case 'bes_device': {
      const hasBes   = parseBesResponse(input)
      const nextState: ElkenBookingState = { ...state, bes_device: hasBes }
      const bookingId = await createElkenBooking(ctx, nextState)
      if (bookingId) {
        dispatchAdminNotification(ELKEN_BOT_ID, bookingId, 'booking_created')
          .catch((e: unknown) => console.error('[ElkenSM] Admin notification failed:', e))
        scheduleElkenNotifications(
          ELKEN_BOT_ID, bookingId, ctx.userId, ctx.channel,
          nextState.preferred_datetime ?? '', nextState.customer_name ?? '',
          lang, nextState.is_member ?? false
        ).catch((err: unknown) => console.error('[ElkenBooking] Schedule notifications failed:', err))
      }
      const besStatus: Record<ElkenLang, string> = {
        en: hasBes ? 'with BES' : 'no BES',
        bm: hasBes ? 'dengan BES' : 'tanpa BES',
        zh: hasBes ? '携带BES设备' : '不带BES设备',
      }
      const facilityLbl = ELKEN_FACILITIES[nextState.facility as ElkenFacilityId]?.label[lang] ?? ''
      return {
        nextState: { ...nextState, step: 'confirmed' },
        response:  bookingMsg('bed_member_confirmed', lang, {
          name:       nextState.customer_name ?? '?',
          facility:   facilityLbl,
          datetime:   nextState.preferred_datetime ?? '?',
          bes_status: besStatus[lang],
        }),
      }
    }

    case 'trial_type': {
      const trialType = parseTrialType(input)
      const nextState: ElkenBookingState = { ...state, trial_type: trialType ?? undefined }
      const bookingId = await createElkenBooking(ctx, nextState)
      if (bookingId) {
        dispatchAdminNotification(ELKEN_BOT_ID, bookingId, 'booking_created')
          .catch((e: unknown) => console.error('[ElkenSM] Admin notification failed:', e))
        scheduleElkenNotifications(
          ELKEN_BOT_ID, bookingId, ctx.userId, ctx.channel,
          nextState.preferred_datetime ?? '', nextState.customer_name ?? '',
          lang, nextState.is_member ?? false
        ).catch((err: unknown) => console.error('[ElkenBooking] Schedule notifications failed:', err))
      }
      return {
        nextState: { ...nextState, step: 'confirmed' },
        response:  bookingMsg('bed_nonmember_confirmed', lang, { name: nextState.customer_name ?? '?' }),
      }
    }

    default:
      return { nextState: state, response: bookingMsg('location_prompt', lang) }
  }
}

// ─── Haiku extraction ─────────────────────────────────────────────────────────

interface ExtractedDetails {
  preferred_datetime: string | null
  customer_name:      string | null
  contact:            string | null
  is_member:          boolean | null
  duration:           '30min' | '60min' | null
}

async function extractDetailsWithHaiku(
  input: string,
  facilityId: string
): Promise<ExtractedDetails> {
  const nullResult: ExtractedDetails = {
    preferred_datetime: null, customer_name: null,
    contact: null, is_member: null, duration: null,
  }

  try {
    const isInhaler = facilityId === 'inhaler'
    const today = todayMYT()
    const system = `Extract booking details from the customer's message as a JSON object.
Today is ${today} (Malaysia Time, UTC+8).
Return ONLY valid JSON with these fields:
- preferred_datetime: string or null — MUST be ISO 8601 format YYYY-MM-DDTHH:mm in Malaysia time. Examples:
  "I want 25 May at 2pm" → "2026-05-25T14:00"
  "next Saturday 10am" → resolve to actual date e.g. "2026-04-25T10:00"
  "tomorrow 3pm" → resolve to actual date e.g. "2026-04-18T15:00"
  "20/05/2026 at 4:30pm" → "2026-05-20T16:30"
  If only a date with no time, use T10:00. If no date found, return null.
- customer_name: string or null
- contact: string or null (phone number, keep as stated)
- is_member: true, false, or null (true = yes/member, false = no/not a member, null = not mentioned)
- duration: ${isInhaler ? '"30min", "60min", or null (30 mins = "30min", 1 hour/1.5 hours = "60min")' : 'null always'}
Reply ONLY with the JSON object. No explanation.`

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system,
      messages: [{ role: 'user', content: input }],
    })

    const text = anthropic.getTextContent(res).trim()
    console.log(`[ElkenSM:Haiku] raw response: ${text}`)

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[ElkenSM:Haiku] no JSON found in response')
      return nullResult
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ExtractedDetails>
    const result = {
      preferred_datetime: typeof parsed.preferred_datetime === 'string' ? parsed.preferred_datetime : null,
      customer_name:      typeof parsed.customer_name === 'string'      ? parsed.customer_name      : null,
      contact:            typeof parsed.contact === 'string'            ? parsed.contact            : null,
      is_member:          typeof parsed.is_member === 'boolean'         ? parsed.is_member          : null,
      duration:           parsed.duration === '30min' || parsed.duration === '60min' ? parsed.duration : null,
    }
    console.log(`[ElkenSM:Haiku] extracted preferred_datetime: "${result.preferred_datetime ?? 'null'}"`)
    return result
  } catch (err) {
    console.error('[ElkenSM] Haiku extraction failed:', err)
    return nullResult
  }
}

// ─── Booking record creation ──────────────────────────────────────────────────

async function createElkenBooking(
  ctx: PipelineContext,
  state: ElkenBookingState
): Promise<string | null> {
  const supabase = createServiceClient()

  // ── Diagnostic: full state snapshot at insert time ───────────────────────
  console.log(
    `[ElkenSM:insert] step="${state.step}" ` +
    `preferred_datetime="${state.preferred_datetime ?? 'NULL'}" ` +
    `customer_name="${state.customer_name ?? 'NULL'}" ` +
    `facility="${state.facility ?? 'NULL'}" ` +
    `is_member=${state.is_member ?? 'NULL'}`
  )

  const parsed = parseMYDatetime(state.preferred_datetime)
  const startTime: Date = parsed ?? defaultStartTime()
  console.log(
    `[ElkenSM:datetime] captured="${state.preferred_datetime ?? 'null'}" → parsed="${parsed?.toISOString() ?? 'null'}" → stored="${startTime.toISOString()}" via ${parsed ? 'captured' : 'DEFAULT_FALLBACK'}`
  )

  const facilityId  = state.facility as ElkenFacilityId | undefined
  const facilityLbl = facilityId
    ? (ELKEN_FACILITIES[facilityId]?.label.en ?? state.facility)
    : state.facility
  const locationLbl = state.location ? ELKEN_LOCATIONS[state.location].name : null
  const isMember    = state.is_member ?? false
  const status      = isMember ? 'pending' : 'trial_pending'

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      bot_id:          ELKEN_BOT_ID,
      contact_id:      ctx.contactId ?? null,
      conversation_id: ctx.conversationId,
      booking_type:    'appointment',
      service_name:    facilityLbl ?? null,
      location:        locationLbl ?? null,
      start_time:      startTime.toISOString(),
      customer_name:   state.customer_name ?? null,
      customer_phone:  state.contact ?? null,
      party_size:      1,
      status,
      channel:         ctx.channel,
      metadata: {
        facility_id:  facilityId ?? null,
        location_id:  state.location ?? null,
        is_member:    isMember,
        member_id:    state.member_id ?? null,
        bes_device:   state.bes_device ?? null,
        trial_type:   state.trial_type ?? null,
        duration:     state.duration ?? null,
        lang:         state.lang,
        source:       'elken_plugin',
      },
      audit_log: [{ action: 'created', at: new Date().toISOString(), via: 'chat', tenant: 'elken' }],
    })
    .select('id')
    .single()

  if (error) {
    console.error('[ElkenSM] createElkenBooking error:', error)
    return null
  }

  const bookingId = (data as { id: string } | null)?.id ?? null

  // Write phone back to contact record if we have one and phone is new
  if (bookingId && ctx.contactId && state.contact) {
    supabase
      .from('contacts')
      .update({ phone: state.contact })
      .eq('id', ctx.contactId)
      .is('phone', null)
      .then(({ error: e }) => {
        if (e) console.error('[ElkenSM] contact phone update error:', e)
      })
  }

  return bookingId
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistElkenState(
  conversationId: string,
  state: ElkenBookingState | null
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

// ─── Input parsers ────────────────────────────────────────────────────────────

function parseLocation(input: string): ElkenLocation | null {
  const s = input.toLowerCase().trim()
  if (/^1$|old klang|klang road|\bokr\b/.test(s)) return 'okr'
  if (/^2$|subang/.test(s)) return 'subang'
  return null
}

function parseFacility(input: string, loc: ElkenLocation): ElkenFacilityId | null {
  const s = input.toLowerCase().trim()

  // Numbered selection
  const n = parseInt(s, 10)
  if (!isNaN(n) && n >= 1) {
    return LOCATION_FACILITIES[loc][n - 1] ?? null
  }

  // Keyword matching — order matters (specific before generic)
  if (/female|wanita|女性床/.test(s))                        return 'bed_female'
  if (/\bmale\b|lelaki|男性床/.test(s))                      return 'bed_male'
  if (/unisex|混合床/.test(s))                               return 'bed_unisex'
  if (/inhaler|吸入器/.test(s))                              return 'inhaler'
  if (/meeting hall|hall\b|dewan|大型/.test(s))              return 'room_large'
  if (/meeting room|\broom\b|bilik|小型/.test(s))            return 'room_small'
  if (/\bbed\b|katil/.test(s))                               return 'bed_female'

  return null
}

function parseBesResponse(input: string): boolean {
  return /^(yes|y|ya|ok|okay|sure|bring|will|yeah|是|要)/i.test(input.trim())
}

function parseTrialType(input: string): ElkenTrialType | null {
  const s = input.toLowerCase()
  if (/back|belakang|背部|背/.test(s)) return 'back'
  if (/foot|kaki|足部|足/.test(s))     return 'foot'
  return null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toElkenLang(lang: string | null | undefined): ElkenLang {
  if (lang === 'zh' || lang?.startsWith('zh')) return 'zh'
  if (lang === 'bm' || lang === 'ms' || lang === 'my' || lang === 'malay') return 'bm'
  return 'en'
}

function makeInitialState(lang: ElkenLang, botId: string): ElkenBookingState {
  return { step: 'location', lang, created_at: Date.now(), bot_id: botId }
}

function blockResult(
  start: number,
  data: Record<string, unknown>,
  response: string
): StepResult {
  return {
    step: 8,
    name: 'booking',
    status: 'block',
    durationMs: Date.now() - start,
    data,
    blockedResponse: response,
  }
}

