-- Run AFTER 00002_indexes.sql
-- Migration: Row Level Security

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_script_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: returns bot IDs the current user can access
CREATE OR REPLACE FUNCTION accessible_bot_ids()
RETURNS SETOF UUID AS $$
  SELECT b.id FROM bots b
  JOIN tenants t ON b.tenant_id = t.id
  JOIN profiles p ON t.id = p.tenant_id
  WHERE p.id = auth.uid()
  UNION
  SELECT b.id FROM bots b
  WHERE (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── Profiles ─────────────────────────────────────────────────────────────────
CREATE POLICY "profile_access" ON profiles FOR ALL
  USING (
    id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- ─── Tenants ──────────────────────────────────────────────────────────────────
CREATE POLICY "tenant_access" ON tenants FOR ALL
  USING (
    id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- ─── Bots ─────────────────────────────────────────────────────────────────────
CREATE POLICY "bot_access" ON bots FOR ALL
  USING (id IN (SELECT accessible_bot_ids()));

-- ─── Bot-scoped tables (all use same pattern) ─────────────────────────────────
CREATE POLICY "bot_access" ON documents FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON chunks FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON faqs FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON products FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON conversations FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON messages FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON contacts FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON bookings FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON api_keys FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON channel_configs FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON bot_scripts FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON bot_script_versions FOR ALL
  USING (script_id IN (
    SELECT id FROM bot_scripts WHERE bot_id IN (SELECT accessible_bot_ids())
  ));

CREATE POLICY "bot_access" ON broadcast_campaigns FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON broadcast_recipients FOR ALL
  USING (campaign_id IN (
    SELECT id FROM broadcast_campaigns WHERE bot_id IN (SELECT accessible_bot_ids())
  ));

CREATE POLICY "bot_access" ON drip_sequences FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON widget_configs FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON followup_rules FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON followup_queue FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON response_templates FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON facilities_config FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON agent_profiles FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

CREATE POLICY "bot_access" ON agent_sessions FOR ALL
  USING (bot_id IN (SELECT accessible_bot_ids()));

-- ─── Audit logs ───────────────────────────────────────────────────────────────
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "audit_read" ON audit_logs FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'tenant_admin'));

-- ─── Tenant invites ───────────────────────────────────────────────────────────
CREATE POLICY "invite_super_admin" ON tenant_invites FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');

-- ─── Onboarding progress ──────────────────────────────────────────────────────
CREATE POLICY "onboarding_access" ON onboarding_progress FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );
