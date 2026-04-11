-- ─── Widget Configs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS widget_configs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id           uuid        NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  primary_color    text        NOT NULL DEFAULT '#6366f1',
  secondary_color  text        NOT NULL DEFAULT '#f1f5f9',
  font_family      text        NOT NULL DEFAULT 'Inter',
  bubble_style     text        NOT NULL DEFAULT 'rounded'
                               CHECK (bubble_style IN ('rounded', 'square')),
  position         text        NOT NULL DEFAULT 'bottom-right'
                               CHECK (position IN ('bottom-right', 'bottom-left')),
  welcome_message  text,
  quick_replies    text[]      NOT NULL DEFAULT '{}',
  show_branding    boolean     NOT NULL DEFAULT true,
  allowed_domains  text[]      NOT NULL DEFAULT '{}',
  custom_css       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id)
);

-- Updated_at trigger
CREATE OR REPLACE TRIGGER widget_configs_updated_at
  BEFORE UPDATE ON widget_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_widget_configs_bot_id ON widget_configs (bot_id);

-- RLS
ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage own widget configs"
  ON widget_configs
  FOR ALL
  USING (bot_id = ANY (accessible_bot_ids()))
  WITH CHECK (bot_id = ANY (accessible_bot_ids()));

-- ─── User rating on messages ────────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS user_rating text
  CHECK (user_rating IN ('positive', 'negative'));
