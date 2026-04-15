-- Migration: Missing analytics RPCs
-- Run in Supabase SQL Editor.

-- ─── get_conversations_by_channel ────────────────────────────────────────────
-- Daily conversation counts split by channel (for stacked bar chart)

CREATE OR REPLACE FUNCTION get_conversations_by_channel(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(date DATE, whatsapp BIGINT, telegram BIGINT, web BIGINT, api BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at AT TIME ZONE 'UTC')                              AS date,
    COUNT(*) FILTER (WHERE channel = 'whatsapp')::BIGINT             AS whatsapp,
    COUNT(*) FILTER (WHERE channel = 'telegram')::BIGINT             AS telegram,
    COUNT(*) FILTER (WHERE channel = 'web_widget')::BIGINT           AS web,
    COUNT(*) FILTER (WHERE channel NOT IN ('whatsapp','telegram','web_widget'))::BIGINT AS api
  FROM conversations
  WHERE bot_id     = p_bot_id
    AND created_at >= p_from
    AND created_at <= p_to
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- ─── get_channel_breakdown ────────────────────────────────────────────────────
-- Total conversation count per channel (for donut chart)

CREATE OR REPLACE FUNCTION get_channel_breakdown(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(channel TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.channel,
    COUNT(*)::BIGINT AS count
  FROM conversations c
  WHERE c.bot_id     = p_bot_id
    AND c.created_at >= p_from
    AND c.created_at <= p_to
  GROUP BY 1
  ORDER BY 2 DESC;
END;
$$;

-- ─── get_booking_status_breakdown ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_booking_status_breakdown(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(status TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.status,
    COUNT(*)::BIGINT AS count
  FROM bookings b
  WHERE b.bot_id     = p_bot_id
    AND b.created_at >= p_from
    AND b.created_at <= p_to
  GROUP BY 1
  ORDER BY 2 DESC;
END;
$$;

-- ─── get_followup_completion ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_followup_completion(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(status TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fq.status,
    COUNT(*)::BIGINT AS count
  FROM followup_queue fq
  WHERE fq.bot_id          = p_bot_id
    AND fq.next_attempt_at >= p_from
    AND fq.next_attempt_at <= p_to
  GROUP BY 1
  ORDER BY 2 DESC;
END;
$$;

-- ─── get_leads_by_stage ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_leads_by_stage(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(stage TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.lead_stage        AS stage,
    COUNT(*)::BIGINT    AS count
  FROM contacts c
  WHERE c.bot_id     = p_bot_id
    AND c.created_at >= p_from
    AND c.created_at <= p_to
  GROUP BY c.lead_stage
  ORDER BY
    CASE c.lead_stage
      WHEN 'new'       THEN 1
      WHEN 'engaged'   THEN 2
      WHEN 'qualified' THEN 3
      WHEN 'booked'    THEN 4
      WHEN 'converted' THEN 5
      WHEN 'churned'   THEN 6
      ELSE 7
    END;
END;
$$;

-- ─── get_channel_message_volume ───────────────────────────────────────────────
-- Daily sent/received counts for a specific channel
-- JOINs messages → conversations to filter by channel (messages has no channel column)

CREATE OR REPLACE FUNCTION get_channel_message_volume(
  p_bot_id  UUID,
  p_channel TEXT,
  p_from    TIMESTAMPTZ,
  p_to      TIMESTAMPTZ
)
RETURNS TABLE(date DATE, sent BIGINT, received BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(m.created_at AT TIME ZONE 'UTC')                         AS date,
    COUNT(*) FILTER (WHERE m.role = 'assistant')::BIGINT          AS sent,
    COUNT(*) FILTER (WHERE m.role = 'user')::BIGINT               AS received
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.bot_id     = p_bot_id
    AND c.channel    = p_channel
    AND m.created_at >= p_from
    AND m.created_at <= p_to
  GROUP BY 1
  ORDER BY 1;
END;
$$;
