-- Migration: Add folder support to documents
-- Run in Supabase SQL Editor.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_folder
  ON documents(bot_id, folder);
