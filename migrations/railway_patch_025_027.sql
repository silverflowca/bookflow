-- ============================================================
-- BookFlow Railway Patch: 025 → 027
-- Covers migrations not yet applied to production:
--   025_component_panel_setting
--   026_home_tagline
--   027_saved_books
--   005_fix_question_answers_unique (missing from railway_full_migration)
--
-- Safe to re-run (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).
-- Run in Supabase Cloud SQL Editor or via psql.
-- ============================================================

-- ── 005 (fix): question_answers unique constraint ─────────────────────────────
-- Required for upsert onConflict to work. Was missing from railway_full_migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'question_answers_inline_content_user_unique'
  ) THEN
    ALTER TABLE bookflow.question_answers
      ADD CONSTRAINT question_answers_inline_content_user_unique
      UNIQUE (inline_content_id, user_id);
  END IF;
END $$;


-- ── 025: Component panel setting ──────────────────────────────────────────────
ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS show_component_panel BOOLEAN NOT NULL DEFAULT false;


-- ── 026: Home tagline ─────────────────────────────────────────────────────────
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS home_tagline TEXT NOT NULL DEFAULT '';


-- ── 027: Saved books ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookflow.saved_books (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  book_id     UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS saved_books_user_id_idx ON bookflow.saved_books(user_id);
CREATE INDEX IF NOT EXISTS saved_books_book_id_idx ON bookflow.saved_books(book_id);

ALTER TABLE bookflow.saved_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved books" ON bookflow.saved_books;
CREATE POLICY "Users manage own saved books"
  ON bookflow.saved_books
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
