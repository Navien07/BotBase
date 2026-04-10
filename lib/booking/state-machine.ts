import type { PipelineContext } from '@/lib/pipeline/types'

export interface BookingMachineResult {
  response: string
  nextState: string | null  // null = booking complete
  updatedData: Record<string, unknown>
}

// Stub — implemented in Phase 03 (Booking Engine)
export async function runBookingMachine(
  _context: PipelineContext,
  _message: string
): Promise<BookingMachineResult | null> {
  return null
}
