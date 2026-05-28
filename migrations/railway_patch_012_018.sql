-- ============================================================================
-- BookFlow: Production Patch -- Migrations 012 through 018
-- Run once in Supabase SQL Editor on production.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS / ALTER COLUMN IF NOT EXISTS).
-- NOTE: Migration 016 (Bible seed data) is separate -- run it independently
--       if you need the John WEB bible data seeded.
-- ============================================================================

-- ============================================================================
-- 012: LiveFlow
-- ============================================================================

-- ═══════════════════════════════════════════════════════
-- LiveFlow — Live Show Module for BookFlow
-- Migration: 012_liveflow.sql
-- ═══════════════════════════════════════════════════════

-- Recurring show definitions
CREATE TABLE IF NOT EXISTS bookflow.live_shows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  book_id          UUID REFERENCES bookflow.books(id) ON DELETE SET NULL,
  host_user_id     UUID NOT NULL,
  restream_channel_id TEXT,
  guest_invite_url TEXT,
  recurrence       TEXT NOT NULL DEFAULT 'weekly',    -- weekly | biweekly | monthly | none
  recurrence_day   INTEGER,                            -- 0=Sun..6=Sat
  recurrence_time  TIME,
  timezone         TEXT NOT NULL DEFAULT 'America/Toronto',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual episode (one airing of a live show)
CREATE TABLE IF NOT EXISTS bookflow.live_episodes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id              UUID REFERENCES bookflow.live_shows(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  chapter_id           UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  scheduled_at         TIMESTAMPTZ NOT NULL,
  started_at           TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | ended | cancelled
  restream_session_id  TEXT,
  youtube_broadcast_id TEXT,
  recording_url        TEXT,
  guest_invite_url     TEXT,
  slide_deck           JSONB,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unified chat messages captured during live show (from Restream webhook)
CREATE TABLE IF NOT EXISTS bookflow.live_chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id    UUID NOT NULL REFERENCES bookflow.live_episodes(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL,   -- youtube | facebook | twitch | restream
  platform_user TEXT,
  body          TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Flagged prayer / discussion requests from chat
CREATE TABLE IF NOT EXISTS bookflow.live_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id        UUID NOT NULL REFERENCES bookflow.live_episodes(id) ON DELETE CASCADE,
  source_message_id UUID REFERENCES bookflow.live_chat_messages(id) ON DELETE SET NULL,
  body              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'prayer',   -- prayer | question | comment
  flagged_by        UUID,
  resolved          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_shows_host    ON bookflow.live_shows(host_user_id);
CREATE INDEX IF NOT EXISTS idx_live_shows_book    ON bookflow.live_shows(book_id);
CREATE INDEX IF NOT EXISTS idx_live_episodes_show ON bookflow.live_episodes(show_id);
CREATE INDEX IF NOT EXISTS idx_live_episodes_sched ON bookflow.live_episodes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_episodes_status ON bookflow.live_episodes(status);
CREATE INDEX IF NOT EXISTS idx_live_chat_episode  ON bookflow.live_chat_messages(episode_id);
CREATE INDEX IF NOT EXISTS idx_live_requests_ep   ON bookflow.live_requests(episode_id);

-- Auto updated_at triggers
CREATE OR REPLACE FUNCTION bookflow.update_live_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_live_shows_updated_at ON bookflow.live_shows;
CREATE TRIGGER trg_live_shows_updated_at
  BEFORE UPDATE ON bookflow.live_shows
  FOR EACH ROW EXECUTE FUNCTION bookflow.update_live_updated_at();

DROP TRIGGER IF EXISTS trg_live_episodes_updated_at ON bookflow.live_episodes;
CREATE TRIGGER trg_live_episodes_updated_at
  BEFORE UPDATE ON bookflow.live_episodes
  FOR EACH ROW EXECUTE FUNCTION bookflow.update_live_updated_at();

-- ============================================================================
-- 013: Restream settings
-- ============================================================================

-- Add Restream API key to app_settings (per-user)
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS restream_api_key TEXT NOT NULL DEFAULT '';

-- ============================================================================
-- 014: Restream OAuth
-- ============================================================================

-- Replace restream_api_key with full OAuth credentials per user
ALTER TABLE bookflow.app_settings
  DROP COLUMN IF EXISTS restream_api_key,
  ADD COLUMN IF NOT EXISTS restream_client_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restream_client_secret TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restream_access_token TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restream_refresh_token TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restream_token_expires_at TIMESTAMPTZ;

-- ============================================================================
-- 015: Live queue + Bible verses table
-- ============================================================================

-- ═══════════════════════════════════════════════════════
-- LiveFlow Queue + Bible Verses
-- Migration: 015_live_queue.sql
-- ═══════════════════════════════════════════════════════

-- Queue groups (optional grouping of queue items)
CREATE TABLE IF NOT EXISTS bookflow.live_queue_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id   UUID NOT NULL REFERENCES bookflow.live_episodes(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,           -- e.g. "Opening", "Step 4 Verses", "Closing"
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queue items (per episode, pre-queued or added live)
CREATE TABLE IF NOT EXISTS bookflow.live_queue_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id   UUID NOT NULL REFERENCES bookflow.live_episodes(id) ON DELETE CASCADE,
  group_id     UUID REFERENCES bookflow.live_queue_groups(id) ON DELETE SET NULL,
  type         TEXT NOT NULL DEFAULT 'verse',  -- verse | passage | custom
  label        TEXT NOT NULL,                  -- "John 3:16" / "Chapter excerpt"
  body         TEXT NOT NULL,                  -- full text to send
  book_ref     TEXT,                           -- "John"
  chapter_ref  INTEGER,                        -- 3
  verse_start  INTEGER,                        -- 16
  verse_end    INTEGER,                        -- null = single verse
  sort_order   INTEGER NOT NULL DEFAULT 0,
  sent_at      TIMESTAMPTZ,
  sent_targets TEXT[],                         -- ['chat','lower_third','caption']
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_episode ON bookflow.live_queue_items(episode_id);
CREATE INDEX IF NOT EXISTS idx_queue_group   ON bookflow.live_queue_items(group_id);
CREATE INDEX IF NOT EXISTS idx_queue_groups_episode ON bookflow.live_queue_groups(episode_id);

-- Bible verses (WEB translation — public domain)
CREATE TABLE IF NOT EXISTS bookflow.bible_verses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_name    TEXT NOT NULL,
  book_order   INTEGER NOT NULL,
  chapter      INTEGER NOT NULL,
  verse        INTEGER NOT NULL,
  text         TEXT NOT NULL,
  UNIQUE(book_name, chapter, verse)
);

CREATE INDEX IF NOT EXISTS idx_bible_lookup ON bookflow.bible_verses(book_name, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_bible_book   ON bookflow.bible_verses(book_name, chapter);

-- ============================================================================
-- 017: show_inline_form_preview flag
-- ============================================================================

-- Migration 017: Add show_inline_form_preview to book_settings
-- Adds a configurable flag to show/hide the inline form preview strip below the chapter editor

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS show_inline_form_preview BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================================
-- 018: Fix sidebar position
-- ============================================================================

-- Migration 018: Fix inline_content rows where position_in_chapter = 'sidebar'
-- 'sidebar' was incorrectly stored; these items should render inline
UPDATE bookflow.inline_content
SET position_in_chapter = 'inline'
WHERE position_in_chapter = 'sidebar';


-- ============================================================================
-- Storage: Create 'files' bucket for audio/video media uploads
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'files', 'files', true, 524288000,
  ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/webm','audio/m4a','audio/*','video/mp4','video/webm','video/ogg','video/*','application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 524288000;

-- Storage policies for 'files' bucket (service role uploads via server, public read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read files bucket' AND tablename = 'objects') THEN
    CREATE POLICY "Public read files bucket" ON storage.objects
      FOR SELECT USING (bucket_id = 'files');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role upload files bucket' AND tablename = 'objects') THEN
    CREATE POLICY "Service role upload files bucket" ON storage.objects
      FOR INSERT TO service_role WITH CHECK (bucket_id = 'files');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role update files bucket' AND tablename = 'objects') THEN
    CREATE POLICY "Service role update files bucket" ON storage.objects
      FOR UPDATE TO service_role USING (bucket_id = 'files');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role delete files bucket' AND tablename = 'objects') THEN
    CREATE POLICY "Service role delete files bucket" ON storage.objects
      FOR DELETE TO service_role USING (bucket_id = 'files');
  END IF;
END $$;

-- Final grants
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bookflow TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bookflow TO service_role;
