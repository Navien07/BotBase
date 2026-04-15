-- Run in Supabase SQL Editor
-- Migration 00028: Elken — add pic_contacts JSONB column to bots table
-- Additive only — no ALTER or DROP on existing columns.

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS pic_contacts jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN bots.pic_contacts IS
  'Per-location PIC WhatsApp numbers. Keys: "okr", "subang".
   Values: international format e.g. "+60122208396".
   Empty {} = notifications disabled.';
