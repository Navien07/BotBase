-- Run in Supabase SQL Editor
-- Migration 00029: Elken — add brochure_url column to documents table
-- Additive only — no ALTER or DROP on existing columns.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS brochure_url text;

COMMENT ON COLUMN documents.brochure_url IS
  'Public Supabase Storage URL for original uploaded file.
   Populated during ingestion for PDF/DOCX files.
   Null = text-only ingestion.';
