-- Persist booking FFM economics and seat class so cancellation can fully reverse
-- account state and ticket details can reflect chosen cabin.

ALTER TABLE tickets ADD COLUMN seat_class TEXT;
ALTER TABLE tickets ADD COLUMN ffm_spent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN ffm_earned INTEGER NOT NULL DEFAULT 0;
