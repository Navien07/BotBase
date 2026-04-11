-- Phase 06: Add status + agent tracking to conversations, metadata to messages
-- Run this in Supabase SQL Editor before deploying Phase 06

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES auth.users(id);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_conversations_status
  ON conversations(bot_id, status);

CREATE INDEX IF NOT EXISTS idx_conversations_agent
  ON conversations(bot_id, agent_id)
  WHERE agent_id IS NOT NULL;
