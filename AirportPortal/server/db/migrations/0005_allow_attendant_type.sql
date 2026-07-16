-- Allow the 'attendant' user type (4th role: customer/admin/root/attendant).
-- SQLite cannot alter a CHECK constraint in place, so the users table is
-- rebuilt with an expanded CHECK. Foreign key enforcement is disabled by the
-- migration runner while this runs, so dropping/recreating the parent table
-- does not cascade-delete child rows; integrity is verified afterward via
-- PRAGMA foreign_key_check.

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('customer','admin','root','attendant')),
  title TEXT,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT,
  dob TEXT,
  gender TEXT,
  address1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  phone TEXT,
  email TEXT UNIQUE,
  login_disambiguator TEXT,
  password_hash TEXT NOT NULL,
  default_sort TEXT DEFAULT 'time',
  auto_logout_minutes INTEGER DEFAULT 15,
  must_complete_profile INTEGER DEFAULT 0,
  must_change_password INTEGER DEFAULT 0,
  last_login_ip TEXT,
  last_login_datetime TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_type TEXT NOT NULL DEFAULT 'guest',
  is_banned INTEGER NOT NULL DEFAULT 0,
  banned_reason TEXT,
  email_verified INTEGER NOT NULL DEFAULT 1,
  verification_token TEXT,
  verification_token_expires TEXT
);

INSERT INTO users_new (
  id, type, title, first_name, middle_name, last_name, suffix, dob, gender,
  address1, city, state, zip, country, phone, email, login_disambiguator,
  password_hash, default_sort, auto_logout_minutes, must_complete_profile,
  must_change_password, last_login_ip, last_login_datetime, created_at,
  user_type, is_banned, banned_reason, email_verified, verification_token,
  verification_token_expires
)
SELECT
  id, type, title, first_name, middle_name, last_name, suffix, dob, gender,
  address1, city, state, zip, country, phone, email, login_disambiguator,
  password_hash, default_sort, auto_logout_minutes, must_complete_profile,
  must_change_password, last_login_ip, last_login_datetime, created_at,
  user_type, is_banned, banned_reason, email_verified, verification_token,
  verification_token_expires
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX ux_users_name_disamb ON users(first_name, last_name, login_disambiguator);
CREATE INDEX idx_users_verification_token ON users(verification_token);
