// lib/booking/state-machine.ts — Booking state machine (all booking types)

import type { BookingType, BookingStep, BookingState, Service } from './types'

const TTL_MS = 30 * 60 * 1000 // 30-minute inactivity TTL

// ─── Public API ───────────────────────────────────────────────────────────────

export function getInitialState(type: BookingType): BookingState {
  const firstStep: BookingStep =
    type === 'appointment' ? 'service' :
    type === 'table' ? 'party_size' :
    'property'

  return {
    type,
    step: firstStep,
    data: {},
    lastActivity: Date.now(),
  }
}

export function isBookingStateActive(state: BookingState | null): boolean {
  if (!state) return false
  return Date.now() - state.lastActivity < TTL_MS
}

export function clearBookingState(): null {
  return null
}

/**
 * Advance the booking state machine by one step.
 * Parses userInput to populate state.data for the current step,
 * then returns the state at the next step.
 * Pass services[] so service-selection can be resolved by name or index.
 */
export function getNextStep(
  state: BookingState,
  userInput: string,
  services: Service[] = []
): BookingState {
  const input = userInput.trim()
  const now = Date.now()

  switch (state.step) {
    case 'service': {
      const service = resolveService(input, services)
      return {
        ...state,
        step: 'datetime',
        data: {
          ...state.data,
          serviceId: service?.id ?? undefined,
          serviceName: service?.name ?? input,
        },
        lastActivity: now,
      }
    }

    case 'party_size': {
      const numMatch = input.match(/\d+/)
      const partySize = numMatch ? parseInt(numMatch[0], 10) : 1
      return {
        ...state,
        step: 'datetime',
        data: { ...state.data, partySize: Math.max(1, partySize) },
        lastActivity: now,
      }
    }

    case 'property': {
      return {
        ...state,
        step: 'datetime',
        data: { ...state.data, propertyId: input, serviceName: input },
        lastActivity: now,
      }
    }

    case 'datetime': {
      const nextStep: BookingStep = state.type === 'table' ? 'special' : 'details'
      return {
        ...state,
        step: nextStep,
        data: { ...state.data, datetime: input },
        lastActivity: now,
      }
    }

    case 'special': {
      const requests = /^(none|no|nil|tiada|-)$/i.test(input.trim()) ? undefined : input
      return {
        ...state,
        step: 'details',
        data: { ...state.data, specialRequests: requests },
        lastActivity: now,
      }
    }

    case 'details': {
      const { name, phone } = parseContactDetails(input)
      return {
        ...state,
        step: 'summary',
        data: {
          ...state.data,
          customerName: name ?? state.data.customerName ?? input,
          customerPhone: phone ?? state.data.customerPhone,
        },
        lastActivity: now,
      }
    }

    case 'summary': {
      if (isConfirmation(input)) {
        return { ...state, step: 'confirmed', lastActivity: now }
      }
      // User declined — restart the flow
      return getInitialState(state.type)
    }

    default:
      return { ...state, lastActivity: now }
  }
}

/**
 * Return the bot message to send at the current state step.
 */
export function buildPromptForStep(state: BookingState, services: Service[]): string {
  switch (state.step) {
    case 'service': {
      if (services.length === 0) {
        return "I'd like to help you book an appointment. What service are you looking for?"
      }
      const list = services
        .map((s, i) => {
          const price = s.price != null ? ` — ${s.currency} ${s.price.toFixed(2)}` : ''
          const dur = s.duration_minutes ? ` (${s.duration_minutes} min)` : ''
          return `${i + 1}. ${s.name}${dur}${price}`
        })
        .join('\n')
      return `Which service would you like to book?\n\n${list}\n\nPlease reply with the number or service name.`
    }

    case 'party_size':
      return 'How many guests will be joining? Please provide the number of people.'

    case 'property':
      return 'Which property would you like to view? Please provide the property name or unit number.'

    case 'datetime':
      return 'What is your preferred date and time?\n\nPlease specify clearly, for example:\n"15 April 2026, 2:00 PM"'

    case 'special':
      return 'Do you have any special requests, dietary requirements, or a special occasion to note? (Reply "None" if not applicable)'

    case 'details': {
      if (state.type === 'property_viewing') {
        return 'Please provide your contact details:\n\n• Full Name:\n• Phone Number:\n• IC Number:\n\nYou can reply with each detail on a new line.'
      }
      return 'Please provide your contact details:\n\n• Full Name:\n• Phone Number:\n\nYou can reply with each detail on a new line.'
    }

    case 'summary': {
      const d = state.data
      const lines: string[] = ['📋 *Booking Summary*\n']
      if (d.serviceName) lines.push(`Service: ${d.serviceName}`)
      if (d.partySize && d.partySize > 1) lines.push(`Party size: ${d.partySize} guests`)
      if (d.datetime) lines.push(`Date & Time: ${d.datetime}`)
      if (d.customerName) lines.push(`Name: ${d.customerName}`)
      if (d.customerPhone) lines.push(`Phone: ${d.customerPhone}`)
      if (d.specialRequests) lines.push(`Special requests: ${d.specialRequests}`)
      lines.push('\nIs everything correct? Reply *Yes* to confirm or *No* to start over.')
      return lines.join('\n')
    }

    case 'confirmed':
      return '✅ Your booking has been confirmed! You will receive a confirmation shortly. Is there anything else I can help you with?'

    default:
      return "I'm processing your booking. Please hold on."
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function resolveService(input: string, services: Service[]): Service | null {
  if (services.length === 0) return null

  // Match by number (e.g. "1", "2")
  const numMatch = input.match(/^\s*(\d+)\s*$/)
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1
    return services[idx] ?? null
  }

  // Match by name (case-insensitive substring)
  const lower = input.toLowerCase()
  return (
    services.find((s) => s.name.toLowerCase() === lower) ??
    services.find((s) => s.name.toLowerCase().includes(lower)) ??
    null
  )
}

function parseContactDetails(input: string): { name: string | null; phone: string | null } {
  // Strip common label prefixes
  const lines = input
    .split(/\n|,/)
    .map((l) =>
      l.replace(/^\s*(full\s*name|name|phone|phone\s*number|nombor|tel|no\.?|ic|ic\s*number|nama)[\s:]+/i, '').trim()
    )
    .filter(Boolean)

  // MY/SG phone: +60, 01x, 6, starts with digits
  const phonePattern = /\+?6?0?1\d[\d\s-]{7,11}/
  let phone: string | null = null
  let name: string | null = null

  for (const line of lines) {
    const phoneMatch = line.match(phonePattern)
    if (phoneMatch && !phone) {
      phone = phoneMatch[0].replace(/[\s-]/g, '')
    } else if (!name && line.length > 1 && !/^\d/.test(line)) {
      name = line
    }
  }

  return { name, phone }
}

function isConfirmation(input: string): boolean {
  return /^(yes|y|ok|okay|confirm|confirmed|ya|betul|benar|correct|sure|yep|yup|1)$/i.test(
    input.trim()
  )
}
