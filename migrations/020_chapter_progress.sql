-- Migration 020: Chapter progress tracking
-- Tracks per-user completion of interactive elements within chapters

-- Per-item completion tracking
CREATE TABLE IF NOT EXISTS bookflow.chapter_item_completions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  chapter_id    UUID NOT NULL REFERENCES bookflow.chapters(id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,  -- "ic:{uuid}" for inline-content rows, "media:{chapterId}-{index}" for embedded media nodes
  item_type     TEXT NOT NULL,  -- 'form' | 'audio' | 'video'
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_cic_user_chapter
  ON bookflow.chapter_item_completions(user_id, chapter_id);

-- Book-level flag: author enables/disables tracking per book
ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS enable_progress_tracking BOOLEAN NOT NULL DEFAULT false;

-- Club-level flags: club owner controls tracking + dashboard visibility
ALTER TABLE bookflow.club_settings
  ADD COLUMN IF NOT EXISTS enable_progress_tracking BOOLEAN NOT NULL DEFAULT false;
-- show_member_reading_progress already exists from migration 007
-- reused to gate full dashboard visibility (all members vs. owner/admin only)
