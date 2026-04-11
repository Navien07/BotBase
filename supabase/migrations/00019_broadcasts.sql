-- Migration 00019: Broadcasts + Follow-ups delta
-- Adds missing columns and drip_enrollments table
-- Run in Supabase SQL Editor AFTER 00018_scripts.sql

-- ─── followup_queue: add missing columns ─────────────────────────────────────
ALTER TABLE followup_queue
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- ─── drip_enrollments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drip_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES drip_sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  next_step_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_id, contact_id)
);

-- ─── RLS for drip_enrollments ─────────────────────────────────────────────────
ALTER TABLE drip_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_access" ON drip_enrollments FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_broadcasts_bot_status
  ON broadcast_campaigns(bot_id, status);

CREATE INDEX IF NOT EXISTS idx_followup_queue_pending
  ON followup_queue(bot_id, status, next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_drip_enrollments_active
  ON drip_enrollments(bot_id, status, next_step_at)
  WHERE status = 'active';
