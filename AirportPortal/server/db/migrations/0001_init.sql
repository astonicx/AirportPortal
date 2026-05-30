CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('customer','admin','root')),
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX ux_users_name_disamb ON users(first_name, last_name, login_disambiguator);

CREATE TABLE user_login_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  ip TEXT,
  ua TEXT,
  success INTEGER,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_lockouts (
  user_id INTEGER PRIMARY KEY,
  locked_until TEXT,
  failed_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE security_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_hash TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  remember_me INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE saved_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last4 TEXT,
  brand TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  cardholder_name TEXT,
  billing_address TEXT,
  billing_zip TEXT,
  token_fake TEXT
);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  confirmation_code TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  flight_id TEXT NOT NULL,
  passenger_first TEXT,
  passenger_middle TEXT,
  passenger_last TEXT,
  passenger_dob TEXT,
  passenger_gender TEXT,
  passenger_email TEXT,
  passenger_phone TEXT,
  seat TEXT,
  carry_on_count INTEGER,
  checked_count INTEGER,
  subtotal_cents INTEGER,
  fees_cents INTEGER,
  total_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  booked_at TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at TEXT
);

CREATE TABLE seat_locks (
  flight_id TEXT NOT NULL,
  seat TEXT NOT NULL,
  session_id TEXT NOT NULL,
  locked_until TEXT NOT NULL,
  PRIMARY KEY (flight_id, seat)
);

CREATE TABLE airline_bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_or_passenger_identity TEXT NOT NULL,
  airline TEXT NOT NULL
);

CREATE TABLE flight_cache (
  flight_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT,
  target_type TEXT,
  target_id TEXT,
  payload_json TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
