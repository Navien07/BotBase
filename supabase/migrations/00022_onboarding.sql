-- Migration: onboarding_progress table
-- Tracks per-tenant onboarding wizard state

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id        uuid REFERENCES bots(id),
  steps_completed jsonb NOT NULL DEFAULT '[]',
  current_step  text NOT NULL DEFAULT 'create_bot',
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS: tenant can manage their own onboarding progress
-- Use inline subquery (NOT set-returning function) per project conventions
CREATE POLICY "Tenant can manage own onboarding progress"
  ON onboarding_progress
  FOR ALL
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()
    )
  );
