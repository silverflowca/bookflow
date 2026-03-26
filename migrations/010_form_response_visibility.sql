-- 010: Add response_visibility to inline_content
-- Controls who can see form responses for each interactive element

ALTER TABLE bookflow.inline_content
  ADD COLUMN IF NOT EXISTS response_visibility TEXT DEFAULT 'private'
    CHECK (response_visibility IN ('private', 'members_only', 'all_readers'));

-- Update form_responses SELECT policy to support shared visibility
DROP POLICY IF EXISTS "form_responses_select" ON bookflow.form_responses;
CREATE POLICY "form_responses_select" ON bookflow.form_responses FOR SELECT
  USING (
    -- Own response is always visible
    user_id = auth.uid()
    -- Book author sees all responses for their content
    OR EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      JOIN bookflow.books b ON b.id = ic.book_id
      WHERE ic.id = inline_content_id AND b.author_id = auth.uid()
    )
    -- all_readers: anyone who can access the book can see responses
    OR EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      WHERE ic.id = inline_content_id AND ic.response_visibility = 'all_readers'
    )
    -- members_only: both the viewer and the respondent are active members
    -- of the same club that is reading the same book
    OR EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      JOIN bookflow.club_books cb ON cb.book_id = ic.book_id
      JOIN bookflow.club_members cm1 ON cm1.club_id = cb.club_id
        AND cm1.user_id = auth.uid()
        AND cm1.invite_accepted_at IS NOT NULL
      JOIN bookflow.club_members cm2 ON cm2.club_id = cb.club_id
        AND cm2.user_id = bookflow.form_responses.user_id
        AND cm2.invite_accepted_at IS NOT NULL
      WHERE ic.id = inline_content_id
        AND ic.response_visibility = 'members_only'
    )
  );
