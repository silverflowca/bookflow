-- ============================================================================
-- BookFlow: Production Patch — Migrations 019 through 022
-- Run once in Supabase SQL Editor on production.
-- Safe to re-run (ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
-- ============================================================================


-- ============================================================================
-- 019: allow_public_tts on book_settings
-- ============================================================================

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS allow_public_tts BOOLEAN NOT NULL DEFAULT false;


-- ============================================================================
-- 020: Chapter progress tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookflow.chapter_item_completions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  chapter_id    UUID NOT NULL REFERENCES bookflow.chapters(id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,
  item_type     TEXT NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_cic_user_chapter
  ON bookflow.chapter_item_completions(user_id, chapter_id);

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS enable_progress_tracking BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bookflow.club_settings
  ADD COLUMN IF NOT EXISTS enable_progress_tracking BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bookflow.chapter_item_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own completions" ON bookflow.chapter_item_completions;
CREATE POLICY "Users manage own completions" ON bookflow.chapter_item_completions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Book author reads completions" ON bookflow.chapter_item_completions;
CREATE POLICY "Book author reads completions" ON bookflow.chapter_item_completions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bookflow.chapters ch
    JOIN bookflow.books b ON b.id = ch.book_id
    WHERE ch.id = chapter_id AND b.author_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Service role full access completions" ON bookflow.chapter_item_completions;
CREATE POLICY "Service role full access completions" ON bookflow.chapter_item_completions
  TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON bookflow.chapter_item_completions TO service_role, authenticated;


-- ============================================================================
-- 021: Image component + order_index for inline content
-- ============================================================================

ALTER TABLE bookflow.inline_content
  DROP CONSTRAINT IF EXISTS inline_content_content_type_check;

ALTER TABLE bookflow.inline_content
  ADD CONSTRAINT inline_content_content_type_check
  CHECK (content_type IN (
    'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
    'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
    'code_block', 'scripture_block', 'image'
  ));

ALTER TABLE bookflow.inline_content
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

UPDATE bookflow.inline_content ic
SET order_index = sub.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY chapter_id, position_in_chapter
           ORDER BY start_offset, created_at
         ) - 1 AS rn
  FROM bookflow.inline_content
) sub
WHERE ic.id = sub.id;

CREATE INDEX IF NOT EXISTS idx_inline_content_order
  ON bookflow.inline_content(chapter_id, position_in_chapter, order_index);


-- ============================================================================
-- 022: Profile privacy settings
-- ============================================================================

ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS profile_public        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_reading_progress BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_clubs            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_books_authored   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS website_url           TEXT,
  ADD COLUMN IF NOT EXISTS location              TEXT;


-- ============================================================================
-- Final grants
-- ============================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bookflow TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bookflow TO service_role;
