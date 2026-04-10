import { createServiceClient } from '@/lib/supabase/service'

interface RateLimitOptions {
  max: number
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const supabase = createServiceClient()
  const windowKey = `${identifier}:${Math.floor(Date.now() / options.windowMs)}`

  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_key: windowKey,
    p_window_ms: options.windowMs,
  })

  if (error) {
    // Fail open — allow on error to prevent lockouts
    console.error('[rate-limit] error:', error)
    return { allowed: true, remaining: options.max, resetAt: new Date() }
  }

  const count = data as number
  const resetAt = new Date(
    Math.ceil(Date.now() / options.windowMs) * options.windowMs
  )

  return {
    allowed: count <= options.max,
    remaining: Math.max(0, options.max - count),
    resetAt,
  }
}

// Rate limit presets
export const RATE_LIMITS = {
  chat:       { max: 60,  windowMs: 60_000 },  // 60/min per API key
  webhook:    { max: 200, windowMs: 60_000 },  // 200/min per IP
  widget:     { max: 30,  windowMs: 60_000 },  // 30/min per session
  onboarding: { max: 10,  windowMs: 60_000 },  // 10/min per IP
  dashboard:  { max: 120, windowMs: 60_000 },  // 120/min per user
} as const
