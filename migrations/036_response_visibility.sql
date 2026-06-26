-- 036: Response visibility — private / shared / public
-- Strategy:
--   private = only the reader who answered
--   shared  = anyone who accesses the book through the same channel (club, study group, or direct share)
--   public  = anyone who can reach the book
--   Author always sees all responses on their book.
--   Default: shared (for books in clubs/groups), private (for private/public-only books) — enforced client-side at submit.

-- ─────────────────────────────────────────────
-- 1. Book visibility: add 'shared' as valid value
-- ─────────────────────────────────────────────

ALTER TABLE bookflow.books
  DROP CONSTRAINT IF EXISTS books_visibility_check;

ALTER TABLE bookflow.books
  ADD CONSTRAINT books_visibility_check
    CHECK (visibility IN ('private', 'shared', 'public'));

-- ─────────────────────────────────────────────
-- 2. New table: book_shares (book ↔ individual user)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookflow.book_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  shared_by   UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  shared_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_book_shares_book ON bookflow.book_shares(book_id);
CREATE INDEX IF NOT EXISTS idx_book_shares_user ON bookflow.book_shares(user_id);

ALTER TABLE bookflow.book_shares ENABLE ROW LEVEL SECURITY;

-- Author can manage shares on their books
DROP POLICY IF EXISTS "book_shares_author_all" ON bookflow.book_shares;
CREATE POLICY "book_shares_author_all" ON bookflow.book_shares
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookflow.books b
      WHERE b.id = book_id AND b.author_id = auth.uid()
    )
  );

-- A user can see that a book was shared with them
DROP POLICY IF EXISTS "book_shares_recipient_select" ON bookflow.book_shares;
CREATE POLICY "book_shares_recipient_select" ON bookflow.book_shares
  FOR SELECT USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 3. Add visibility to all three response tables
-- ─────────────────────────────────────────────

ALTER TABLE bookflow.form_responses
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('private', 'shared', 'public'));

ALTER TABLE bookflow.poll_responses
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('private', 'shared', 'public'));

ALTER TABLE bookflow.question_answers
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('private', 'shared', 'public'));

-- ─────────────────────────────────────────────
-- 4. Helper: can viewer access this book?
-- ─────────────────────────────────────────────
-- Used in RLS policies below to avoid repetition.

CREATE OR REPLACE FUNCTION bookflow.viewer_can_access_book(p_book_id UUID, p_viewer_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookflow.books b
    WHERE b.id = p_book_id
      AND (
        b.visibility = 'public'
        OR b.author_id = p_viewer_id
        OR EXISTS (
          SELECT 1 FROM bookflow.book_shares bs
          WHERE bs.book_id = p_book_id AND bs.user_id = p_viewer_id
        )
        OR EXISTS (
          SELECT 1 FROM bookflow.club_books cb
          JOIN bookflow.club_members cm ON cm.club_id = cb.club_id
          WHERE cb.book_id = p_book_id AND cm.user_id = p_viewer_id
        )
      )
  )
$$;

-- ─────────────────────────────────────────────
-- 5. Helper: do viewer and respondent share a channel for this book?
-- ─────────────────────────────────────────────
-- Shared channel = same club/study group that has the book,
--                  OR both individually shared on the book.

CREATE OR REPLACE FUNCTION bookflow.viewers_share_book_channel(
  p_book_id     UUID,
  p_viewer_id   UUID,
  p_respondent_id UUID
)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    -- same club/study group that has the book
    SELECT 1 FROM bookflow.club_members cm_v
    JOIN bookflow.club_members cm_r ON cm_r.club_id = cm_v.club_id
    JOIN bookflow.club_books cb ON cb.club_id = cm_v.club_id
    WHERE cm_v.user_id = p_viewer_id
      AND cm_r.user_id = p_respondent_id
      AND cb.book_id = p_book_id
  )
  OR EXISTS (
    -- both directly shared on the book
    SELECT 1 FROM bookflow.book_shares bs_v
    JOIN bookflow.book_shares bs_r ON bs_r.book_id = bs_v.book_id
    WHERE bs_v.user_id = p_viewer_id
      AND bs_r.user_id = p_respondent_id
      AND bs_v.book_id = p_book_id
  )
$$;

-- ─────────────────────────────────────────────
-- 6. RLS policies — form_responses
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS "form_responses_select" ON bookflow.form_responses;

CREATE POLICY "form_responses_select" ON bookflow.form_responses
FOR SELECT USING (
  -- own answer
  user_id = auth.uid()

  OR (
    -- book author sees all non-private
    visibility != 'private'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      JOIN bookflow.books b ON b.id = ic.book_id
      WHERE ic.id = inline_content_id
        AND b.author_id = auth.uid()
    )
  )

  OR (
    -- shared: viewer and respondent share a club/group/individual channel for this book
    visibility = 'shared'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      WHERE ic.id = inline_content_id
        AND bookflow.viewers_share_book_channel(ic.book_id, auth.uid(), form_responses.user_id)
    )
  )

  OR (
    -- public: viewer can access the book at all
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      WHERE ic.id = inline_content_id
        AND bookflow.viewer_can_access_book(ic.book_id, auth.uid())
    )
  )
);

-- ─────────────────────────────────────────────
-- 7. RLS policies — poll_responses
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS "poll_responses_select" ON bookflow.poll_responses;

CREATE POLICY "poll_responses_select" ON bookflow.poll_responses
FOR SELECT USING (
  user_id = auth.uid()

  OR (
    visibility != 'private'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      JOIN bookflow.books b ON b.id = ic.book_id
      WHERE ic.id = inline_content_id
        AND b.author_id = auth.uid()
    )
  )

  OR (
    visibility = 'shared'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      WHERE ic.id = inline_content_id
        AND bookflow.viewers_share_book_channel(ic.book_id, auth.uid(), poll_responses.user_id)
    )
  )

  OR (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      WHERE ic.id = inline_content_id
        AND bookflow.viewer_can_access_book(ic.book_id, auth.uid())
    )
  )
);

-- ─────────────────────────────────────────────
-- 8. RLS policies — question_answers
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS "question_answers_select" ON bookflow.question_answers;

CREATE POLICY "question_answers_select" ON bookflow.question_answers
FOR SELECT USING (
  user_id = auth.uid()

  OR (
    visibility != 'private'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      JOIN bookflow.books b ON b.id = ic.book_id
      WHERE ic.id = inline_content_id
        AND b.author_id = auth.uid()
    )
  )

  OR (
    visibility = 'shared'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      WHERE ic.id = inline_content_id
        AND bookflow.viewers_share_book_channel(ic.book_id, auth.uid(), question_answers.user_id)
    )
  )

  OR (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      WHERE ic.id = inline_content_id
        AND bookflow.viewer_can_access_book(ic.book_id, auth.uid())
    )
  )
);

-- ─────────────────────────────────────────────
-- 9. Update books RLS to allow 'shared' visibility
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS "books_select" ON bookflow.books;

CREATE POLICY "books_select" ON bookflow.books
FOR SELECT USING (
  visibility = 'public'
  OR author_id = auth.uid()
  OR (
    visibility = 'shared'
    AND (
      EXISTS (
        SELECT 1 FROM bookflow.book_shares bs
        WHERE bs.book_id = books.id AND bs.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM bookflow.club_books cb
        JOIN bookflow.club_members cm ON cm.club_id = cb.club_id
        WHERE cb.book_id = books.id AND cm.user_id = auth.uid()
      )
    )
  )
);
