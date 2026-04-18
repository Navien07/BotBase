-- Migration 00035: bot_media_triggers table + fire-once RPC

CREATE TABLE bot_media_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  trigger_value TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_triggers_lookup
  ON bot_media_triggers(bot_id, trigger_value, display_order)
  WHERE is_active = TRUE;

ALTER TABLE bot_media_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_bot_media_triggers"
  ON bot_media_triggers FOR ALL
  USING (
    bot_id IN (
      SELECT b.id FROM bots b
      JOIN tenants t ON b.tenant_id = t.id
      JOIN profiles p ON t.id = p.tenant_id
      WHERE p.id = auth.uid()
      UNION
      SELECT b.id FROM bots b
      WHERE (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    )
  );

CREATE OR REPLACE FUNCTION mark_media_triggers_fired(
  p_conversation_id UUID,
  p_bot_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE conversations
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{media_triggers_fired}',
    'true'::jsonb
  )
  WHERE id = p_conversation_id
    AND bot_id = p_bot_id
    AND NOT COALESCE((metadata->>'media_triggers_fired')::boolean, false);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
