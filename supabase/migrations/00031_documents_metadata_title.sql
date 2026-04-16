-- Migration 00031: Add metadata JSONB and title TEXT to documents table
-- Run in Supabase SQL Editor.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN documents.metadata IS
  'Arbitrary JSONB metadata for tenant plugins.
   Elken: { product_name, language, category } parsed from filename.';

COMMENT ON COLUMN documents.title IS
  'Human-readable document title (derived from filename on ingestion).
   Used as the PDF caption when sending brochures to customers.';

-- Index for Elken product_name metadata lookups
CREATE INDEX IF NOT EXISTS idx_documents_metadata_product_name
  ON documents USING gin (metadata);
