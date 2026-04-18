// IceBot database types — generated from schema in 00001_extensions_schema.sql

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'tenant_admin' | 'agent'
export type Language = 'en' | 'bm' | 'zh' | 'auto' | 'all'
export type Channel = 'whatsapp' | 'telegram' | 'web_widget' | 'instagram' | 'facebook' | 'api'
export type MessageRole = 'user' | 'assistant' | 'system'
export type Intent = 'browse_product' | 'health_issue' | 'book_session' | 'faq' | 'general' | 'booking_intent' | 'cancel_booking' | 'check_booking'
export type BookingStatus = 'pending' | 'trial_pending' | 'confirmed' | 'reminded' | 'completed' | 'no_show' | 'cancelled' | 'walk_in'
export type BookingType = 'appointment' | 'table' | 'property_viewing'
export type LeadStage = 'new' | 'engaged' | 'qualified' | 'booked' | 'converted' | 'churned'
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'frustrated'
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'
export type IngestMode = 'chunks' | 'qna'
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
export type RecipientStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'opted_out'
export type FollowupStatus = 'pending' | 'sent' | 'completed' | 'failed' | 'cancelled'
export type ScriptTriggerType = 'keyword' | 'intent' | 'always' | 'manual' | 'api'
export type DripTriggerEvent = 'contact_created' | 'lead_stage_change' | 'booking_confirmed' | 'no_reply' | 'manual'
export type BubbleStyle = 'rounded' | 'sharp' | 'pill'
export type WidgetPosition = 'bottom-right' | 'bottom-left'

// ─── Feature flags ────────────────────────────────────────────────────────────

export interface BotFeatureFlags {
  booking_enabled: boolean
  booking_type: BookingType
  crm_enabled: boolean
  broadcasts_enabled: boolean
  flow_builder_enabled: boolean
  pdf_delivery_enabled: boolean
  widget_enabled: boolean
  voice_enabled: boolean
}

// ─── Guardrail rules ──────────────────────────────────────────────────────────

export interface GuardrailRules {
  in_scope: string[]
  out_of_scope: string[]
  important: string[]
}

// ─── Operating hours ──────────────────────────────────────────────────────────

export interface DayHours {
  open: string   // "09:00"
  close: string  // "17:00"
  enabled: boolean
}

export interface OperatingHours {
  mon: DayHours
  tue: DayHours
  wed: DayHours
  thu: DayHours
  fri: DayHours
  sat: DayHours
  sun: DayHours
}

// ─── Flow builder types ───────────────────────────────────────────────────────

export interface FlowNodeData {
  label?: string
  message?: string
  condition?: string
  action?: string
  [key: string]: unknown
}

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: FlowNodeData
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

export interface FlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  tenant_id: string | null
  role: UserRole
  display_name: string | null
  language_preference: 'en' | 'bm'
  created_at: string
  updated_at: string
}

export interface Bot {
  id: string
  tenant_id: string
  name: string
  slug: string
  avatar_url: string | null
  is_active: boolean
  default_language: string
  timezone: string
  rag_threshold: number
  feature_flags: BotFeatureFlags
  // Personality
  bot_name: string
  system_prompt: string | null
  personality_preset: string
  tone_formal: boolean
  tone_verbose: boolean
  tone_emoji: boolean
  tone_lock_language: boolean
  greeting_en: string | null
  greeting_bm: string | null
  greeting_zh: string | null
  fallback_message: string
  // Guardrails
  guardrail_rules: GuardrailRules
  fact_grounding: boolean
  hallucination_guard: boolean
  response_min_words: number
  response_max_words: number
  keyword_blocklist: string[]
  // Google Calendar
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expiry: string | null
  google_calendar_id: string | null
  google_resource_calendars: Record<string, string> | null
  google_connected_email: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  bot_id: string
  filename: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  category: string
  folder: string | null
  ingest_mode: IngestMode
  status: DocumentStatus
  chunk_count: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface Chunk {
  id: string
  bot_id: string
  document_id: string
  content: string
  embedding: number[] | null
  token_count: number | null
  chunk_index: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface FAQ {
  id: string
  bot_id: string
  question: string
  answer: string
  language: Language
  embedding: number[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  bot_id: string
  name: string
  category: string | null
  description: string | null
  key_features: string | null
  benefits: string | null
  price: number | null
  currency: string
  usage_instructions: string | null
  image_url: string | null
  pdf_url: string | null
  embedding: number[] | null
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  bot_id: string
  contact_id: string | null
  external_user_id: string
  channel: Channel
  language: string
  metadata: Record<string, unknown>
  last_message_at: string | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  bot_id: string
  role: MessageRole
  content: string
  intent: string | null
  language: string | null
  rag_found: boolean
  source_chunks: unknown[]
  response_latency_ms: number | null
  sentiment: Sentiment | null
  sentiment_score: number | null
  pipeline_debug: Record<string, unknown>
  created_at: string
}

export interface Contact {
  id: string
  bot_id: string
  external_id: string
  channel: Channel
  name: string | null
  phone: string | null
  email: string | null
  language: string
  tags: string[]
  lead_stage: LeadStage
  lead_score: number
  custom_fields: Record<string, unknown>
  last_message_at: string | null
  total_messages: number
  total_bookings: number
  notes: string | null
  assigned_agent_id: string | null
  opt_out: boolean
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  bot_id: string
  contact_id: string | null
  conversation_id: string | null
  booking_type: BookingType
  service_id: string | null
  service_name: string | null
  channel: string | null
  location: string | null
  start_time: string
  end_time: string | null
  status: BookingStatus
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  party_size: number
  special_requests: string | null
  staff_notes: string | null
  reminder_sent_at: string | null
  survey_sent_at: string | null
  google_event_id: string | null
  audit_log: unknown[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
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
  day_of_week: number      // 0 = Sunday, 6 = Saturday
  is_open: boolean
  open_time: string        // 'HH:MM'
  close_time: string
  lunch_start: string | null
  lunch_end: string | null
}

export interface FacilitiesConfig {
  id: string
  bot_id: string
  service_name: string
  duration_minutes: number
  price: number | null
  currency: string
  buffer_minutes: number
  max_simultaneous: number
  staff_name: string | null
  operating_hours: OperatingHours
  is_active: boolean
  created_at: string
}

export interface ApiKey {
  id: string
  bot_id: string
  name: string
  key_hash: string
  key_prefix: string
  allowed_origins: string[]
  last_used_at: string | null
  request_count: number
  revoked_at: string | null
  created_at: string
}

export interface ChannelConfig {
  id: string
  bot_id: string
  channel: 'whatsapp' | 'telegram' | 'web_widget' | 'instagram' | 'facebook'
  is_active: boolean
  config: Record<string, unknown>
  webhook_url: string | null
  last_connected_at: string | null
  created_at: string
  updated_at: string
}

export interface ResponseTemplate {
  id: string
  bot_id: string
  intent: string
  language: 'en' | 'bm' | 'zh'
  content: string
  format: string
  created_at: string
  updated_at: string
}

export interface BotScript {
  id: string
  bot_id: string
  name: string
  description: string | null
  trigger_type: ScriptTriggerType
  trigger_value: string | null
  flow_data: FlowData
  is_active: boolean
  version: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface BotScriptVersion {
  id: string
  script_id: string
  version: number
  flow_data: FlowData
  note: string | null
  created_at: string
}

export interface BroadcastStats {
  total: number
  sent: number
  delivered: number
  read: number
  replied: number
  failed: number
}

export interface BroadcastCampaign {
  id: string
  bot_id: string
  name: string
  message_template: { body: string; media_url: string | null; buttons: unknown[] }
  channel: string
  audience_filter: Record<string, unknown>
  status: BroadcastStatus
  scheduled_at: string | null
  sent_at: string | null
  stats: BroadcastStats
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BroadcastRecipient {
  id: string
  campaign_id: string
  contact_id: string
  status: RecipientStatus
  error: string | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  replied_at: string | null
}

export interface DripSequence {
  id: string
  bot_id: string
  name: string
  trigger_event: DripTriggerEvent
  trigger_value: string | null
  steps: unknown[]
  is_active: boolean
  created_at: string
}

export interface AgentProfile {
  id: string
  user_id: string
  bot_id: string
  display_name: string | null
  avatar_url: string | null
  is_online: boolean
  last_seen_at: string | null
  created_at: string
}

export interface AgentSession {
  id: string
  conversation_id: string
  agent_id: string
  bot_id: string
  started_at: string
  ended_at: string | null
  is_active: boolean
  notes: string | null
}

export interface FollowupRule {
  id: string
  bot_id: string
  name: string
  trigger_condition: string
  trigger_hours: number | null
  message_template: string
  max_attempts: number
  is_active: boolean
  created_at: string
}

export interface FollowupQueue {
  id: string
  rule_id: string
  contact_id: string
  bot_id: string
  attempt_count: number
  next_attempt_at: string
  status: FollowupStatus
  context: Record<string, unknown>
  created_at: string
}

export interface WidgetConfig {
  id: string
  bot_id: string
  primary_color: string
  secondary_color: string
  font_family: string
  bubble_style: BubbleStyle
  position: WidgetPosition
  welcome_message: string
  placeholder_text: string
  quick_replies: unknown[]
  allowed_domains: string[]
  show_branding: boolean
  custom_css: string | null
  created_at: string
  updated_at: string
}

export interface TenantInvite {
  id: string
  token: string
  email: string
  tenant_id: string | null
  bot_id: string | null
  invited_by: string | null
  role: 'tenant_admin' | 'agent'
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface OnboardingProgress {
  id: string
  tenant_id: string
  steps_completed: {
    create_bot: boolean
    upload_doc: boolean
    configure_personality: boolean
    connect_channel: boolean
    test_bot: boolean
  }
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  action: string
  bot_id: string | null
  tenant_id: string | null
  user_id: string
  metadata: Record<string, unknown>
  created_at: string
}
