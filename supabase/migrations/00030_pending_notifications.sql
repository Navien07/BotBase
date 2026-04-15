-- Run in Supabase SQL Editor
-- Migration 00030: pending_notifications table for scheduled outbound messaging
-- Polled daily by /api/notifications/dispatch (n8n Schedule node at 02:00 UTC = 10:00 AM MYT)

CREATE TABLE IF NOT EXISTS pending_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'telegram')),
  type text NOT NULL CHECK (type IN (
    'booking_reminder_24h',
    'post_session_survey',
    'nonmember_trial_followup'
  )),
  message text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  failed_at timestamptz,
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_notifications_due
  ON pending_notifications (scheduled_for, sent_at, failed_at)
  WHERE sent_at IS NULL AND failed_at IS NULL;

CREATE INDEX idx_pending_notifications_bot
  ON pending_notifications (bot_id);

COMMENT ON TABLE pending_notifications IS
  'Scheduled outbound notifications. Polled by /api/notifications/dispatch
   which is triggered by n8n Schedule node (daily 10am MYT = 02:00 UTC).';
