import { createServiceClient } from '@/lib/supabase/service'

export type AnalyticsReport =
  | 'message-volume'
  | 'intent-breakdown'
  | 'language-dist'
  | 'traffic-source'
  | 'unanswered'
  | 'latency'
  | 'funnel'
  | 'guardrails'
  | 'satisfaction'
  | 'booking-funnel'
  | 'kpi'

export const REPORT_TYPES: AnalyticsReport[] = [
  'message-volume',
  'intent-breakdown',
  'language-dist',
  'traffic-source',
  'unanswered',
  'latency',
  'funnel',
  'guardrails',
  'satisfaction',
  'booking-funnel',
  'kpi',
]

// ─── Individual report queries ────────────────────────────────────────────────

export async function getMessageVolume(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_message_volume', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getIntentBreakdown(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_intent_breakdown', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getLanguageDist(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_language_dist', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getTrafficSource(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_traffic_source', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getLatencyStats(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_latency_stats', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getGuardrailStats(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_guardrail_stats', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getLeadFunnel(botId: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_lead_funnel', { p_bot_id: botId })
}

export async function getSatisfactionCounts(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_satisfaction_counts', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getBookingFunnel(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_booking_funnel', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getUnansweredQueries(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  return supabase.rpc('get_unanswered_queries', { p_bot_id: botId, p_from: from, p_to: to })
}

export async function getKpi(botId: string, from: string, to: string) {
  const supabase = createServiceClient()
  const [convRes, msgRes, guardRes, googleRes] = await Promise.all([
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('bot_id', botId)
      .gte('created_at', from)
      .lte('created_at', to),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('bot_id', botId)
      .gte('created_at', from)
      .lte('created_at', to),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('bot_id', botId)
      .eq('guardrail_triggered', true)
      .gte('created_at', from)
      .lte('created_at', to),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('bot_id', botId)
      .eq('used_google_fallback', true)
      .gte('created_at', from)
      .lte('created_at', to),
  ])
  const error = convRes.error ?? msgRes.error ?? guardRes.error ?? googleRes.error
  return {
    data: {
      conversations: convRes.count ?? 0,
      messages: msgRes.count ?? 0,
      guardrails_triggered: guardRes.count ?? 0,
      google_fallback_uses: googleRes.count ?? 0,
    },
    error,
  }
}

// ─── Dispatch map ─────────────────────────────────────────────────────────────

type QueryFn = (
  botId: string,
  from: string,
  to: string
) => Promise<{ data: unknown; error: unknown }>

export const analyticsHandlers: Record<AnalyticsReport, QueryFn> = {
  'message-volume':   getMessageVolume,
  'intent-breakdown': getIntentBreakdown,
  'language-dist':    getLanguageDist,
  'traffic-source':   getTrafficSource,
  'unanswered':       getUnansweredQueries,
  'latency':          getLatencyStats,
  'funnel':           (botId, _from, _to) => getLeadFunnel(botId) as Promise<{ data: unknown; error: unknown }>,
  'guardrails':       getGuardrailStats,
  'satisfaction':     getSatisfactionCounts,
  'booking-funnel':   getBookingFunnel,
  'kpi':              getKpi,
}
