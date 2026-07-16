-- Account verification for admin-created customers.
-- Idempotent-friendly: only runs once (tracked in _migrations), but defaults
-- are chosen so existing accounts remain usable (verified) and only newly
-- admin-created accounts start unverified.

PRAGMA foreign_keys = ON;

-- Default 1 so every existing/self-signup account stays verified and can log in.
-- Admin-created accounts explicitly set this to 0 until the customer confirms.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;

-- One-time token the customer uses to confirm their account.
ALTER TABLE users ADD COLUMN verification_token TEXT;
ALTER TABLE users ADD COLUMN verification_token_expires TEXT;

CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
