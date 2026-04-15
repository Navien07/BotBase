-- Run in Supabase SQL Editor
-- Migration 00027: Elken — fix check_and_create_booking RPC to accept user_id + channel params
-- Additive only. No DROP on tables. Only replaces the function.

CREATE OR REPLACE FUNCTION check_and_create_booking(
  p_bot_id          UUID,
  p_facility_id     TEXT,
  p_location_id     TEXT,
  p_start_time      TIMESTAMPTZ,
  p_end_time        TIMESTAMPTZ,
  p_customer_name   TEXT DEFAULT NULL,
  p_customer_phone  TEXT DEFAULT NULL,
  p_is_member       BOOLEAN DEFAULT FALSE,
  p_member_id       TEXT DEFAULT NULL,
  p_bes_device      BOOLEAN DEFAULT NULL,
  p_trial_type      TEXT DEFAULT NULL,
  p_duration        TEXT DEFAULT NULL,
  p_lang            TEXT DEFAULT 'en',
  p_contact_id      UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_channel         TEXT DEFAULT NULL,
  p_user_id         TEXT DEFAULT NULL
)
RETURNS TABLE (
  success    BOOLEAN,
  booking_id UUID,
  error_msg  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity    INTEGER;
  v_booked      INTEGER;
  v_booking_id  UUID;
  v_status      TEXT;
BEGIN
  -- Capacity check: count confirmed/pending bookings in the same slot window
  SELECT COUNT(*) INTO v_booked
  FROM bookings
  WHERE bot_id = p_bot_id
    AND metadata->>'facility_id' = p_facility_id
    AND metadata->>'location_id' = p_location_id
    AND status IN ('pending', 'confirmed', 'trial_pending')
    AND start_time >= p_start_time
    AND start_time <  p_end_time;

  -- Determine status
  v_status := CASE WHEN p_is_member THEN 'pending' ELSE 'trial_pending' END;

  -- Insert the booking
  INSERT INTO bookings (
    bot_id,
    contact_id,
    conversation_id,
    booking_type,
    service_name,
    location,
    start_time,
    end_time,
    customer_name,
    customer_phone,
    party_size,
    status,
    channel,
    metadata,
    audit_log
  )
  VALUES (
    p_bot_id,
    p_contact_id,
    p_conversation_id,
    'appointment',
    p_facility_id,
    p_location_id,
    p_start_time,
    p_end_time,
    p_customer_name,
    p_customer_phone,
    1,
    v_status,
    p_channel,
    jsonb_build_object(
      'facility_id',  p_facility_id,
      'location_id',  p_location_id,
      'is_member',    p_is_member,
      'member_id',    p_member_id,
      'bes_device',   p_bes_device,
      'trial_type',   p_trial_type,
      'duration',     p_duration,
      'lang',         p_lang,
      'user_id',      p_user_id,
      'source',       'elken_rpc'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'action', 'created',
        'at',     now()::text,
        'via',    COALESCE(p_channel, 'api'),
        'tenant', 'elken'
      )
    )
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT TRUE, v_booking_id, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM;
END;
$$;
