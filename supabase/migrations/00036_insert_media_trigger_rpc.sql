-- Migration 00036: Atomic insert RPC for bot_media_triggers
--
-- Uses INSERT ... SELECT to compute COALESCE(MAX(display_order), 0) + 1
-- within the same statement. Narrower race window than a two-step SELECT + INSERT
-- from the application layer. For an admin UI (low concurrency) this is sufficient.
--
-- Returns the UUID of the newly created row.

CREATE OR REPLACE FUNCTION insert_media_trigger(
  p_bot_id          UUID,
  p_trigger_value   TEXT,
  p_storage_path    TEXT,
  p_mime_type       TEXT,
  p_file_size_bytes INTEGER,
  p_caption         TEXT,
  p_uploaded_by     UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO bot_media_triggers (
    bot_id,
    trigger_value,
    storage_path,
    mime_type,
    file_size_bytes,
    caption,
    display_order,
    uploaded_by
  )
  SELECT
    p_bot_id,
    p_trigger_value,
    p_storage_path,
    p_mime_type,
    p_file_size_bytes,
    p_caption,
    COALESCE(MAX(display_order), 0) + 1,
    p_uploaded_by
  FROM bot_media_triggers
  WHERE bot_id = p_bot_id
    AND trigger_value = p_trigger_value
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
