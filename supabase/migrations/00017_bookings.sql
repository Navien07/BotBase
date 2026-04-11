-- Run in Supabase SQL Editor
-- Migration 00017: Booking System — services, operating_hours, bookings extensions

-- ─── services table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS services (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id              UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  duration_minutes    INTEGER NOT NULL DEFAULT 60,
  buffer_minutes      INTEGER NOT NULL DEFAULT 0,
  max_simultaneous    INTEGER NOT NULL DEFAULT 1,
  price               NUMERIC(10,2),
  currency            TEXT NOT NULL DEFAULT 'MYR',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── operating_hours table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operating_hours (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id        UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  is_open       BOOLEAN NOT NULL DEFAULT TRUE,
  open_time     TIME NOT NULL DEFAULT '09:00',
  close_time    TIME NOT NULL DEFAULT '18:00',
  lunch_start   TIME,
  lunch_end     TIME,
  UNIQUE (bot_id, day_of_week)
);

-- ─── extend bookings table ────────────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel    TEXT DEFAULT 'web';

-- ─── indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_services_bot_id
  ON services (bot_id);

CREATE INDEX IF NOT EXISTS idx_operating_hours_bot_id
  ON operating_hours (bot_id);

CREATE INDEX IF NOT EXISTS idx_bookings_bot_start
  ON bookings (bot_id, start_time);

CREATE INDEX IF NOT EXISTS idx_bookings_service_id
  ON bookings (service_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_hours ENABLE ROW LEVEL SECURITY;

-- service role bypasses RLS automatically (no policy needed for service client)

-- tenant-scoped SELECT for services
DROP POLICY IF EXISTS "Tenant can view own services" ON services;
CREATE POLICY "Tenant can view own services" ON services
  FOR SELECT USING (
    bot_id IN (SELECT accessible_bot_ids())
  );

-- tenant-scoped SELECT for operating_hours
DROP POLICY IF EXISTS "Tenant can view own hours" ON operating_hours;
CREATE POLICY "Tenant can view own hours" ON operating_hours
  FOR SELECT USING (
    bot_id IN (SELECT accessible_bot_ids())
  );
