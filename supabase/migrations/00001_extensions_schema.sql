-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- Migration: Extensions + Full Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Core tables ──────────────────────────────────────────────────────────────

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  role TEXT NOT NULL DEFAULT 'tenant_admin'
    CHECK (role IN ('super_admin', 'tenant_admin', 'agent')),
  display_name TEXT,
  language_preference TEXT DEFAULT 'en' CHECK (language_preference IN ('en', 'bm')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  default_language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'Asia/Kuala_Lumpur',
  rag_threshold FLOAT DEFAULT 0.55,
  feature_flags JSONB DEFAULT '{
    "booking_enabled": false,
    "booking_type": "appointment",
    "crm_enabled": true,
    "broadcasts_enabled": true,
    "flow_builder_enabled": true,
    "pdf_delivery_enabled": true,
    "widget_enabled": true,
    "voice_enabled": false
  }',
  -- Personality
  bot_name TEXT DEFAULT 'Assistant',
  system_prompt TEXT,
  personality_preset TEXT DEFAULT 'friendly',
  tone_formal BOOLEAN DEFAULT FALSE,
  tone_verbose BOOLEAN DEFAULT FALSE,
  tone_emoji BOOLEAN DEFAULT TRUE,
  tone_lock_language BOOLEAN DEFAULT FALSE,
  greeting_en TEXT,
  greeting_bm TEXT,
  greeting_zh TEXT,
  fallback_message TEXT DEFAULT 'I''m not sure about that. Can I help you with something else?',
  -- Guardrails
  guardrail_rules JSONB DEFAULT '{"in_scope":[],"out_of_scope":[],"important":[]}',
  fact_grounding BOOLEAN DEFAULT TRUE,
  hallucination_guard BOOLEAN DEFAULT TRUE,
  response_min_words INTEGER DEFAULT 20,
  response_max_words INTEGER DEFAULT 300,
  keyword_blocklist TEXT[] DEFAULT '{}',
  -- Google Calendar
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  category TEXT DEFAULT 'General',
  ingest_mode TEXT DEFAULT 'chunks' CHECK (ingest_mode IN ('chunks', 'qna')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1024),
  token_count INTEGER,
  chunk_index INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'bm', 'zh', 'all')),
  embedding VECTOR(1024),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  key_features TEXT,
  benefits TEXT,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'MYR',
  usage_instructions TEXT,
  image_url TEXT,
  pdf_url TEXT,
  embedding VECTOR(1024),
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  contact_id UUID, -- FK added after contacts table
  external_user_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  language TEXT,
  rag_found BOOLEAN DEFAULT FALSE,
  source_chunks JSONB DEFAULT '[]',
  response_latency_ms INTEGER,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'frustrated')),
  sentiment_score FLOAT,
  pipeline_debug JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE response_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'bm', 'zh')),
  content TEXT NOT NULL,
  format TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, intent, language)
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  allowed_origins TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE channel_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'web_widget', 'instagram', 'facebook')),
  is_active BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{}',
  webhook_url TEXT,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, channel)
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  name TEXT,
  phone TEXT,
  email TEXT,
  language TEXT DEFAULT 'en',
  tags TEXT[] DEFAULT '{}',
  lead_stage TEXT DEFAULT 'new'
    CHECK (lead_stage IN ('new','engaged','qualified','booked','converted','churned')),
  lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  custom_fields JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  total_messages INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  notes TEXT,
  assigned_agent_id UUID REFERENCES auth.users(id),
  opt_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, external_id, channel)
);

ALTER TABLE conversations ADD CONSTRAINT fk_contact
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  booking_type TEXT DEFAULT 'appointment'
    CHECK (booking_type IN ('appointment', 'table', 'property_viewing')),
  service_name TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','reminded','completed','no_show','cancelled','walk_in')),
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  party_size INTEGER DEFAULT 1,
  special_requests TEXT,
  staff_notes TEXT,
  reminder_sent_at TIMESTAMPTZ,
  survey_sent_at TIMESTAMPTZ,
  google_event_id TEXT,
  audit_log JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE facilities_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'MYR',
  buffer_minutes INTEGER DEFAULT 0,
  max_simultaneous INTEGER DEFAULT 1,
  staff_name TEXT,
  operating_hours JSONB DEFAULT '{
    "mon": {"open": "09:00", "close": "17:00", "enabled": true},
    "tue": {"open": "09:00", "close": "17:00", "enabled": true},
    "wed": {"open": "09:00", "close": "17:00", "enabled": true},
    "thu": {"open": "09:00", "close": "17:00", "enabled": true},
    "fri": {"open": "09:00", "close": "17:00", "enabled": true},
    "sat": {"open": "09:00", "close": "13:00", "enabled": true},
    "sun": {"open": "09:00", "close": "17:00", "enabled": false}
  }',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bot_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT DEFAULT 'intent'
    CHECK (trigger_type IN ('keyword','intent','always','manual','api')),
  trigger_value TEXT,
  flow_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  is_active BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bot_script_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES bot_scripts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  flow_data JSONB NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_template JSONB NOT NULL DEFAULT '{"body":"","media_url":null,"buttons":[]}',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  audience_filter JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{"total":0,"sent":0,"delivered":0,"read":0,"replied":0,"failed":0}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','replied','failed','opted_out')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ
);

CREATE TABLE drip_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL
    CHECK (trigger_event IN ('contact_created','lead_stage_change','booking_confirmed','no_reply','manual')),
  trigger_value TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bot_id)
);

CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  bot_id UUID NOT NULL REFERENCES bots(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT
);

CREATE TABLE followup_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  trigger_hours INTEGER,
  message_template TEXT NOT NULL,
  max_attempts INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE followup_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES followup_rules(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id),
  attempt_count INTEGER DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','sent','completed','failed','cancelled')),
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE widget_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE UNIQUE,
  primary_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#ffffff',
  font_family TEXT DEFAULT 'Geist',
  bubble_style TEXT DEFAULT 'rounded'
    CHECK (bubble_style IN ('rounded','sharp','pill')),
  position TEXT DEFAULT 'bottom-right'
    CHECK (position IN ('bottom-right','bottom-left')),
  welcome_message TEXT DEFAULT 'Hi! How can I help you today?',
  placeholder_text TEXT DEFAULT 'Type a message...',
  quick_replies JSONB DEFAULT '[]',
  allowed_domains TEXT[] DEFAULT '{}',
  show_branding BOOLEAN DEFAULT TRUE,
  custom_css TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'tenant_admin'
    CHECK (role IN ('tenant_admin', 'agent')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  steps_completed JSONB DEFAULT '{
    "create_bot": false,
    "upload_doc": false,
    "configure_personality": false,
    "connect_channel": false,
    "test_bot": false
  }',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  bot_id UUID,
  tenant_id UUID,
  user_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
