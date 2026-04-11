// lib/booking/types.ts — Booking domain types

export type BookingType = 'appointment' | 'table' | 'property_viewing'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'walk_in'
export type BookingStep =
  | 'service'       // appointment: pick service
  | 'party_size'    // table: how many guests
  | 'property'      // property_viewing: which property
  | 'datetime'      // all: pick date + time
  | 'special'       // table: special requests / dietary
  | 'details'       // all: name, phone (+ IC for property)
  | 'summary'       // all: review + confirm
  | 'confirmed'     // all: booking created

export interface BookingStateData {
  serviceId?: string
  serviceName?: string
  datetime?: string           // raw user input, e.g. "15 April 2026, 2:00 PM"
  partySize?: number
  customerName?: string
  customerPhone?: string
  specialRequests?: string
  propertyId?: string
  offeredSlots?: string[]     // ISO strings offered when slot is full
}

export interface BookingState {
  type: BookingType
  step: BookingStep
  data: BookingStateData
  lastActivity: number        // Date.now() — 30-min TTL
}

export interface Service {
  id: string
  bot_id: string
  name: string
  description: string | null
  duration_minutes: number
  buffer_minutes: number
  max_simultaneous: number
  price: number | null
  currency: string
  is_active: boolean
  created_at: string
}

export interface OperatingHoursRow {
  id: string
  bot_id: string
  day_of_week: number         // 0 = Sunday, 6 = Saturday
  is_open: boolean
  open_time: string           // 'HH:MM'
  close_time: string
  lunch_start: string | null
  lunch_end: string | null
}
