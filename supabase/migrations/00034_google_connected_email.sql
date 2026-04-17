-- Migration: 00034_google_connected_email
-- Adds google_connected_email to bots table.
-- Stores the Google account email captured during OAuth callback for display in Settings UI.

-- ── Up ────────────────────────────────────────────────────────────────────────

alter table bots
  add column if not exists google_connected_email text;

-- ── Down ──────────────────────────────────────────────────────────────────────

alter table bots
  drop column if exists google_connected_email;
