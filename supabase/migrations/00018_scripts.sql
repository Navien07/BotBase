-- Run in Supabase SQL Editor
-- Migration 00018: Flow Builder — scripts + script_versions

-- ─── bot_scripts table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_scripts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id          UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Untitled Script',
  description     TEXT,
  trigger_type    TEXT NOT NULL DEFAULT 'keyword'
                  CHECK (trigger_type IN ('keyword', 'intent', 'always', 'manual', 'api')),
  trigger_value   TEXT,
  flow_data       JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  version         INTEGER NOT NULL DEFAULT 1,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── script_versions table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_script_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id       UUID NOT NULL REFERENCES bot_scripts(id) ON DELETE CASCADE,
  bot_id          UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  flow_data       JSONB NOT NULL DEFAULT '{}',
  note            TEXT,
  published_by    UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bot_scripts_bot_id ON bot_scripts(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_scripts_bot_active ON bot_scripts(bot_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bot_script_versions_script_id ON bot_script_versions(script_id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_bot_scripts_updated_at
  BEFORE UPDATE ON bot_scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE bot_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_script_versions ENABLE ROW LEVEL SECURITY;

-- Tenant admins and agents can read scripts for their bots
CREATE POLICY "tenant_read_scripts" ON bot_scripts
  FOR SELECT USING (bot_id = ANY(accessible_bot_ids()));

-- Service role handles all writes (from API routes)
CREATE POLICY "service_all_scripts" ON bot_scripts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "tenant_read_script_versions" ON bot_script_versions
  FOR SELECT USING (bot_id = ANY(accessible_bot_ids()));

CREATE POLICY "service_all_script_versions" ON bot_script_versions
  FOR ALL USING (auth.role() = 'service_role');
