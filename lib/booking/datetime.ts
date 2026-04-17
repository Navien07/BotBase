/**
 * Booking datetime utilities — Malaysia time (UTC+8)
 *
 * parseMYDatetime() converts customer-supplied datetime strings to UTC Date objects.
 * All customer dates are treated as Malaysia Time (MYT, UTC+8) unless they already
 * carry a timezone suffix.
 */

/**
 * Parse a datetime string captured from customer input or Haiku extraction.
 *
 * Handles:
 *   "2026-05-20T16:30"        — ISO from Haiku prompt (treated as MYT)
 *   "2026-05-20T16:30+08:00"  — ISO with explicit offset (used as-is)
 *   "20/05/2026 16:30"        — DD/MM/YYYY HH:mm
 *   "20/05/2026 at 16:30"     — DD/MM/YYYY at HH:mm (Haiku legacy)
 *   "20/05/2026"              — date-only → defaults to 10:00 MYT
 *
 * Returns null if the string cannot be parsed.
 */
export function parseMYDatetime(raw: string | null | undefined): Date | null {
  if (!raw || !raw.trim()) return null

  const s = raw.trim()

  // ── ISO with timezone suffix already present ──────────────────────────────
  // e.g. "2026-05-20T16:30:00+08:00" or "2026-05-20T08:30:00Z"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*[Z+\-]\d/.test(s)) {
    const dt = new Date(s)
    return isNaN(dt.getTime()) ? null : dt
  }

  // ── ISO without timezone → treat as MYT (UTC+8) ──────────────────────────
  // e.g. "2026-05-20T16:30" or "2026-05-20T16:30:00"
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (isoMatch) {
    const [, y, mo, d, h, m] = isoMatch
    const dt = new Date(`${y}-${mo}-${d}T${h}:${m}:00+08:00`)
    return isNaN(dt.getTime()) ? null : dt
  }

  // ── ISO date-only → 10:00 MYT ─────────────────────────────────────────────
  // e.g. "2026-05-20"
  const isoDateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDateMatch) {
    const [, y, mo, d] = isoDateMatch
    const dt = new Date(`${y}-${mo}-${d}T10:00:00+08:00`)
    return isNaN(dt.getTime()) ? null : dt
  }

  // ── DD/MM/YYYY HH:mm (with optional "at") ────────────────────────────────
  // e.g. "20/05/2026 at 16:30" or "20/05/2026 16:30"
  const ddmmtimeMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+at\s+|\s+)(\d{1,2}):(\d{2})/)
  if (ddmmtimeMatch) {
    const [, d, mo, y, h, m] = ddmmtimeMatch
    const dt = new Date(
      `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${m}:00+08:00`
    )
    return isNaN(dt.getTime()) ? null : dt
  }

  // ── DD/MM/YYYY date-only → 10:00 MYT ────────────────────────────────────
  const ddmmMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmMatch) {
    const [, d, mo, y] = ddmmMatch
    const dt = new Date(
      `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T10:00:00+08:00`
    )
    return isNaN(dt.getTime()) ? null : dt
  }

  return null
}

/**
 * Returns a safe fallback datetime: tomorrow at 10:00 MYT.
 * Used when parseMYDatetime() returns null.
 */
export function defaultStartTime(): Date {
  // Get "tomorrow" in MYT by offsetting UTC by +8h, then snapping to 10:00 MYT
  const nowMYT = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const yyyy = nowMYT.getUTCFullYear()
  const mm   = String(nowMYT.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(nowMYT.getUTCDate() + 1).padStart(2, '0')
  return new Date(`${yyyy}-${mm}-${dd}T10:00:00+08:00`)
}

/**
 * Get today's date as a human-readable string in Malaysia timezone.
 * Used to ground the Haiku extraction prompt.
 * e.g. "17 April 2026 (Friday)"
 */
export function todayMYT(): string {
  return new Date().toLocaleDateString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
