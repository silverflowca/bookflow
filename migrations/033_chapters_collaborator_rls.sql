-- ============================================================================
-- Migration 033: Allow accepted collaborators to update chapters
-- ============================================================================

SET search_path = bookflow, public;

-- Drop the old owner-only UPDATE policy
DROP POLICY IF EXISTS "chapters_update" ON bookflow.chapters;

-- New policy: owner OR accepted collaborator can update
CREATE POLICY "chapters_update" ON bookflow.chapters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookflow.books
      WHERE books.id = book_id AND books.author_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM bookflow.book_collaborators
      WHERE book_collaborators.book_id = chapters.book_id
        AND book_collaborators.user_id = auth.uid()
        AND book_collaborators.invite_accepted_at IS NOT NULL
    )
  );

-- Also fix INSERT policy so collaborators can add chapters
DROP POLICY IF EXISTS "chapters_insert" ON bookflow.chapters;

CREATE POLICY "chapters_insert" ON bookflow.chapters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookflow.books
      WHERE books.id = book_id AND books.author_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM bookflow.book_collaborators
      WHERE book_collaborators.book_id = chapters.book_id
        AND book_collaborators.user_id = auth.uid()
        AND book_collaborators.invite_accepted_at IS NOT NULL
    )
  );
