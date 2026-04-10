-- Run AFTER 00003_rls.sql
-- Migration: Auth hook + RAG + Rate limit functions

-- ─── Auto-create profile on signup ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role)
  VALUES (NEW.id, 'tenant_admin')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── RAG: match chunks ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding VECTOR(1024),
  match_threshold FLOAT,
  match_count INT,
  filter_bot_id UUID
)
RETURNS TABLE(id UUID, content TEXT, similarity FLOAT, document_id UUID, metadata JSONB)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT id, content, 1 - (embedding <=> query_embedding) AS similarity,
         document_id, metadata
  FROM chunks
  WHERE bot_id = filter_bot_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── RAG: match FAQs ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_faqs(
  query_embedding VECTOR(1024),
  match_threshold FLOAT,
  match_count INT,
  filter_bot_id UUID
)
RETURNS TABLE(id UUID, question TEXT, answer TEXT, similarity FLOAT)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT id, question, answer, 1 - (embedding <=> query_embedding) AS similarity
  FROM faqs
  WHERE bot_id = filter_bot_id
    AND is_active = TRUE
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── Rate limit increment ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_rate_limit(p_key TEXT, p_window_ms BIGINT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch from NOW()) * 1000 / p_window_ms) * p_window_ms / 1000
  );
  INSERT INTO rate_limits (key, count, window_start)
  VALUES (p_key, 1, v_window_start)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN rate_limits.window_start < v_window_start THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < v_window_start THEN v_window_start
      ELSE rate_limits.window_start
    END,
    updated_at = NOW()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

-- ─── Analytics aggregate (SECURITY DEFINER bypasses RLS for read-only stats) ──
CREATE OR REPLACE FUNCTION get_bot_analytics(
  p_bot_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_conversations', (
      SELECT COUNT(*) FROM conversations
      WHERE bot_id = p_bot_id AND created_at BETWEEN p_from AND p_to
    ),
    'total_messages', (
      SELECT COUNT(*) FROM messages
      WHERE bot_id = p_bot_id AND created_at BETWEEN p_from AND p_to
    ),
    'rag_hit_rate', (
      SELECT ROUND(
        COUNT(*) FILTER (WHERE rag_found = TRUE)::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      )
      FROM messages
      WHERE bot_id = p_bot_id AND role = 'assistant'
        AND created_at BETWEEN p_from AND p_to
    ),
    'avg_response_ms', (
      SELECT ROUND(AVG(response_latency_ms))
      FROM messages
      WHERE bot_id = p_bot_id AND role = 'assistant'
        AND created_at BETWEEN p_from AND p_to
    ),
    'sentiment_breakdown', (
      SELECT json_object_agg(sentiment, cnt)
      FROM (
        SELECT sentiment, COUNT(*) as cnt
        FROM messages
        WHERE bot_id = p_bot_id AND created_at BETWEEN p_from AND p_to
          AND sentiment IS NOT NULL
        GROUP BY sentiment
      ) s
    )
  ) INTO result;
  RETURN result;
END;
$$;
