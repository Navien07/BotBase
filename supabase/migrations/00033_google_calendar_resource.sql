-- Migration: 00033_google_calendar_resource
-- Adds google_calendar_id and google_resource_calendars to bots table.
-- google_access_token, google_refresh_token, google_token_expiry already exist (added prior to migration tracking).

-- ── Up ────────────────────────────────────────────────────────────────────────

alter table bots
  add column if not exists google_calendar_id text,
  add column if not exists google_resource_calendars jsonb default '{}'::jsonb;

comment on column bots.google_resource_calendars is
  'Maps bot resource/facility names to Google Calendar IDs.
   Keys should match service/facility identifiers from the services table.
   Example: {"female_bed_okr": "abc@group.calendar.google.com", "bes_device_1": "def@group.calendar.google.com"}';

-- ── Down ──────────────────────────────────────────────────────────────────────

alter table bots
  drop column if exists google_calendar_id,
  drop column if exists google_resource_calendars;
