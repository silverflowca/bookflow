-- ── 022: Profile privacy settings ────────────────────────────────────────────
-- Adds visibility controls to user profiles so members can choose
-- what's shown publicly vs kept private.

ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS profile_public        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_reading_progress BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_clubs            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_books_authored   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS website_url           TEXT,
  ADD COLUMN IF NOT EXISTS location              TEXT;
