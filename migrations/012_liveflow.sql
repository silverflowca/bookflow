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

CREATE TRIGGER trg_live_shows_updated_at
  BEFORE UPDATE ON bookflow.live_shows
  FOR EACH ROW EXECUTE FUNCTION bookflow.update_live_updated_at();

CREATE TRIGGER trg_live_episodes_updated_at
  BEFORE UPDATE ON bookflow.live_episodes
  FOR EACH ROW EXECUTE FUNCTION bookflow.update_live_updated_at();
