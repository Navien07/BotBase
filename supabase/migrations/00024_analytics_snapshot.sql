-- Migration: Add get_analytics_snapshot RPC
-- Fixes: messages table has no `channel` column — channel is on conversations.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_analytics_snapshot(
  p_bot_id    UUID,
  p_from      TIMESTAMPTZ,
  p_to        TIMESTAMPTZ,
  p_prev_from TIMESTAMPTZ,
  p_prev_to   TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    -- Conversations
    'conversations',
      (SELECT COUNT(*) FROM conversations
       WHERE bot_id = p_bot_id AND created_at BETWEEN p_from AND p_to),
    'conversations_prev',
      (SELECT COUNT(*) FROM conversations
       WHERE bot_id = p_bot_id AND created_at BETWEEN p_prev_from AND p_prev_to),

    -- Leads collected (new contacts)
    'leads',
      (SELECT COUNT(*) FROM contacts
       WHERE bot_id = p_bot_id AND created_at BETWEEN p_from AND p_to),
    'leads_prev',
      (SELECT COUNT(*) FROM contacts
       WHERE bot_id = p_bot_id AND created_at BETWEEN p_prev_from AND p_prev_to),

    -- WhatsApp messages — JOIN to conversations for channel
    'wa_messages',
      (SELECT COUNT(*) FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.bot_id = p_bot_id AND c.channel = 'whatsapp'
         AND m.created_at BETWEEN p_from AND p_to),
    'wa_messages_prev',
      (SELECT COUNT(*) FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.bot_id = p_bot_id AND c.channel = 'whatsapp'
         AND m.created_at BETWEEN p_prev_from AND p_prev_to),

    -- Telegram messages — JOIN to conversations for channel
    'tg_messages',
      (SELECT COUNT(*) FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.bot_id = p_bot_id AND c.channel = 'telegram'
         AND m.created_at BETWEEN p_from AND p_to),
    'tg_messages_prev',
      (SELECT COUNT(*) FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.bot_id = p_bot_id AND c.channel = 'telegram'
         AND m.created_at BETWEEN p_prev_from AND p_prev_to),

    -- Confirmed bookings
    'confirmed_bookings',
      (SELECT COUNT(*) FROM bookings
       WHERE bot_id = p_bot_id AND status = 'confirmed'
         AND created_at BETWEEN p_from AND p_to),
    'confirmed_bookings_prev',
      (SELECT COUNT(*) FROM bookings
       WHERE bot_id = p_bot_id AND status = 'confirmed'
         AND created_at BETWEEN p_prev_from AND p_prev_to),

    -- Pending bookings
    'pending_bookings',
      (SELECT COUNT(*) FROM bookings
       WHERE bot_id = p_bot_id AND status = 'pending'
         AND created_at BETWEEN p_from AND p_to),
    'pending_bookings_prev',
      (SELECT COUNT(*) FROM bookings
       WHERE bot_id = p_bot_id AND status = 'pending'
         AND created_at BETWEEN p_prev_from AND p_prev_to),

    -- Followups sent
    'followups_done',
      (SELECT COUNT(*) FROM followup_queue
       WHERE bot_id = p_bot_id AND status = 'sent'
         AND next_attempt_at BETWEEN p_from AND p_to),
    'followups_done_prev',
      (SELECT COUNT(*) FROM followup_queue
       WHERE bot_id = p_bot_id AND status = 'sent'
         AND next_attempt_at BETWEEN p_prev_from AND p_prev_to),

    -- Bot/user message counts for response rate
    'bot_messages',
      (SELECT COUNT(*) FROM messages
       WHERE bot_id = p_bot_id AND role = 'assistant'
         AND created_at BETWEEN p_from AND p_to),
    'user_messages',
      (SELECT COUNT(*) FROM messages
       WHERE bot_id = p_bot_id AND role = 'user'
         AND created_at BETWEEN p_from AND p_to)
  );
END;
$$;
