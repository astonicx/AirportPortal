-- V2 features schema expansion.
-- Keep this migration idempotent so it can run safely across environments.

PRAGMA foreign_keys = ON;

-- Users: add role/banning fields used by V2 auth and admin policy.
ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'guest';
ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN banned_reason TEXT;

-- Backfill user_type from legacy users.type values where possible.
UPDATE users
SET user_type = CASE
  WHEN type IN ('customer', 'admin', 'root') THEN type
  ELSE 'guest'
END
WHERE user_type IS NULL OR user_type = '' OR user_type = 'guest';

-- Airline-level booking restrictions.
CREATE TABLE IF NOT EXISTS airline_restrictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  airline TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_airline_restrictions_user ON airline_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_airline_restrictions_airline ON airline_restrictions(airline);

-- Frequent flier account balances and lifetime stats.
CREATE TABLE IF NOT EXISTS frequent_flier_accounts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ffm_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Extras purchased on a ticket.
CREATE TABLE IF NOT EXISTS ticket_extras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  extra_name TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  cost_ffm INTEGER NOT NULL DEFAULT 0,
  purchased_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_extras_ticket ON ticket_extras(ticket_id);

-- Attendant assignment by airline.
CREATE TABLE IF NOT EXISTS attendant_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  airline TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendant_assignments_attendant ON attendant_assignments(attendant_id);
CREATE INDEX IF NOT EXISTS idx_attendant_assignments_airline ON attendant_assignments(airline);

-- Check-in events for ticket lifecycle.
CREATE TABLE IF NOT EXISTS checkin_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  gate TEXT,
  status TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_checkin_records_ticket ON checkin_records(ticket_id);

-- Flight cache additions for V2 pricing and inventory details.
ALTER TABLE flight_cache ADD COLUMN seat_classes_json TEXT;
ALTER TABLE flight_cache ADD COLUMN baggage_fees_json TEXT;
ALTER TABLE flight_cache ADD COLUMN extras_json TEXT;
ALTER TABLE flight_cache ADD COLUMN ffm_credit INTEGER NOT NULL DEFAULT 0;
