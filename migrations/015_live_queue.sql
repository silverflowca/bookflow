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
