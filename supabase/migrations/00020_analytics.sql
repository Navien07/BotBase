-- Phase 11: Analytics — columns, indexes, and SECURITY DEFINER RPCs
-- Run this in Supabase SQL Editor BEFORE deploying Phase 11

-- ─── Add missing columns to messages ─────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS guardrail_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS used_google_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_rating TEXT CHECK (user_rating IN ('thumbs_up', 'thumbs_down'));

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_guardrail
  ON messages(bot_id, created_at) WHERE guardrail_triggered = TRUE;

CREATE INDEX IF NOT EXISTS idx_messages_google_fallback
  ON messages(bot_id, created_at) WHERE used_google_fallback = TRUE;

CREATE INDEX IF NOT EXISTS idx_messages_user_rating
  ON messages(bot_id, user_rating) WHERE user_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_rag_found
  ON messages(bot_id, rag_found, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_intent_time
  ON messages(bot_id, intent, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_language_time
  ON messages(bot_id, language, created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_channel_time
  ON conversations(bot_id, channel, created_at);

-- ─── RPC 1: Message volume over time ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_message_volume(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(day DATE, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at AT TIME ZONE 'UTC') AS day,
    COUNT(*)::BIGINT                    AS count
  FROM messages
  WHERE bot_id    = p_bot_id
    AND role      = 'user'
    AND created_at >= p_from
    AND created_at <= p_to
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- ─── RPC 2: Intent breakdown ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_intent_breakdown(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(intent TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(m.intent, 'unknown') AS intent,
    COUNT(*)::BIGINT              AS count
  FROM messages m
  WHERE m.bot_id     = p_bot_id
    AND m.role       = 'user'
    AND m.intent     IS NOT NULL
    AND m.created_at >= p_from
    AND m.created_at <= p_to
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT 10;
END;
$$;

-- ─── RPC 3: Language distribution ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_language_dist(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(language TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(m.language, 'unknown') AS language,
    COUNT(*)::BIGINT                AS count
  FROM messages m
  WHERE m.bot_id     = p_bot_id
    AND m.role       = 'user'
    AND m.created_at >= p_from
    AND m.created_at <= p_to
  GROUP BY 1
  ORDER BY 2 DESC;
END;
$$;

-- ─── RPC 4: Traffic by channel (source) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION get_traffic_source(
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

-- ─── RPC 5: Latency statistics ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_latency_stats(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(avg_ms NUMERIC, p50_ms NUMERIC, p95_ms NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(response_latency_ms))::NUMERIC AS avg_ms,
    ROUND(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY response_latency_ms))::NUMERIC AS p50_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_latency_ms))::NUMERIC AS p95_ms
  FROM messages
  WHERE bot_id              = p_bot_id
    AND role                = 'assistant'
    AND response_latency_ms IS NOT NULL
    AND created_at          >= p_from
    AND created_at          <= p_to;
END;
$$;

-- ─── RPC 6: Guardrail stats ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_guardrail_stats(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(total_triggered BIGINT, top_blocked JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total      BIGINT;
  v_top_blocked JSONB;
BEGIN
  SELECT COUNT(*)::BIGINT INTO v_total
  FROM messages
  WHERE bot_id              = p_bot_id
    AND guardrail_triggered = TRUE
    AND created_at          >= p_from
    AND created_at          <= p_to;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('query', t.content, 'count', t.cnt)
      ORDER BY t.cnt DESC
    ),
    '[]'::jsonb
  ) INTO v_top_blocked
  FROM (
    SELECT content, COUNT(*)::BIGINT AS cnt
    FROM messages
    WHERE bot_id              = p_bot_id
      AND guardrail_triggered = TRUE
      AND role                = 'user'
      AND created_at          >= p_from
      AND created_at          <= p_to
    GROUP BY content
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) t;

  RETURN QUERY SELECT v_total, v_top_blocked;
END;
$$;

-- ─── RPC 7: Lead funnel ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_lead_funnel(
  p_bot_id UUID
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
  WHERE c.bot_id = p_bot_id
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

-- ─── RPC 8: User satisfaction counts ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_satisfaction_counts(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(thumbs_up BIGINT, thumbs_down BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE user_rating = 'thumbs_up')::BIGINT   AS thumbs_up,
    COUNT(*) FILTER (WHERE user_rating = 'thumbs_down')::BIGINT AS thumbs_down
  FROM messages
  WHERE bot_id     = p_bot_id
    AND user_rating IS NOT NULL
    AND created_at  >= p_from
    AND created_at  <= p_to;
END;
$$;

-- ─── RPC 9: Booking funnel ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_booking_funnel(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(enquiries BIGINT, submitted BIGINT, confirmed BIGINT, attended BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Enquiries: distinct conversations with a booking-related intent
    (SELECT COUNT(DISTINCT conversation_id)
     FROM messages
     WHERE bot_id     = p_bot_id
       AND intent     ILIKE '%book%'
       AND created_at >= p_from
       AND created_at <= p_to)::BIGINT AS enquiries,
    -- Submitted: all bookings created in period
    (SELECT COUNT(*)
     FROM bookings
     WHERE bot_id     = p_bot_id
       AND created_at >= p_from
       AND created_at <= p_to)::BIGINT AS submitted,
    -- Confirmed: confirmed or beyond
    (SELECT COUNT(*)
     FROM bookings
     WHERE bot_id     = p_bot_id
       AND status     IN ('confirmed', 'reminded', 'completed', 'no_show')
       AND created_at >= p_from
       AND created_at <= p_to)::BIGINT AS confirmed,
    -- Attended: completed bookings
    (SELECT COUNT(*)
     FROM bookings
     WHERE bot_id     = p_bot_id
       AND status     = 'completed'
       AND created_at >= p_from
       AND created_at <= p_to)::BIGINT AS attended;
END;
$$;

-- ─── RPC 10: Unanswered queries (rag_found = false) ──────────────────────────

CREATE OR REPLACE FUNCTION get_unanswered_queries(
  p_bot_id UUID,
  p_from   TIMESTAMPTZ,
  p_to     TIMESTAMPTZ
)
RETURNS TABLE(content TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.content,
    COUNT(*)::BIGINT AS count
  FROM messages m
  WHERE m.bot_id     = p_bot_id
    AND m.role       = 'user'
    AND m.rag_found  = FALSE
    AND m.created_at >= p_from
    AND m.created_at <= p_to
  GROUP BY m.content
  ORDER BY COUNT(*) DESC
  LIMIT 10;
END;
$$;
