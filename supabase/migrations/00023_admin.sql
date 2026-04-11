-- Phase 15: Super Admin panel
-- Add is_active to tenants table

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
