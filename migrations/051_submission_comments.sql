-- ============================================================
-- Migration 051: Submission comments + student reply to feedback
--
-- Two additions:
--
-- 1. class_submission_comments
--    A threaded comment system on assignments (submissions),
--    mirroring class_response_comments for Q&A answers.
--    Allows teacher ↔ student back-and-forth on written work.
--    Optionally linked to a book chapter (chapter_id) so the
--    thread is contextualised within the reading journey.
--
-- 2. student_note on class_submission_feedback
--    A single reply field students can fill after receiving
--    a grade — e.g. "Thank you, I've revised and resubmitted."
--    teacher_follow_up allows one more round from the teacher.
-- ============================================================

SET search_path TO bookflow, public;

-- ── 1. Submission comments table ─────────────────────────────

CREATE TABLE IF NOT EXISTS bookflow.class_submission_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES bookflow.book_clubs(id)         ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES bookflow.class_submissions(id) ON DELETE CASCADE,
  -- Optional: link to a specific book chapter for context
  chapter_id  UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  -- Optional: link to a specific inline Q&A response for context
  response_id UUID REFERENCES bookflow.form_responses(id) ON DELETE SET NULL,
  author_id   UUID NOT NULL REFERENCES bookflow.profiles(id)           ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_comments_submission
  ON bookflow.class_submission_comments(submission_id);

CREATE INDEX IF NOT EXISTS idx_sub_comments_club
  ON bookflow.class_submission_comments(club_id);

CREATE INDEX IF NOT EXISTS idx_sub_comments_chapter
  ON bookflow.class_submission_comments(chapter_id)
  WHERE chapter_id IS NOT NULL;

-- RLS
ALTER TABLE bookflow.class_submission_comments ENABLE ROW LEVEL SECURITY;

-- Club members can view comments on submissions in their club
CREATE POLICY "club_members_read_sub_comments"
  ON bookflow.class_submission_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookflow.club_members cm
      WHERE cm.club_id = class_submission_comments.club_id
        AND cm.user_id = auth.uid()
        AND cm.invite_accepted_at IS NOT NULL
    )
  );

-- Club members can insert comments (server enforces role rules)
CREATE POLICY "club_members_insert_sub_comments"
  ON bookflow.class_submission_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bookflow.club_members cm
      WHERE cm.club_id = class_submission_comments.club_id
        AND cm.user_id = auth.uid()
        AND cm.invite_accepted_at IS NOT NULL
    )
  );

-- Authors can delete their own comments
CREATE POLICY "author_delete_sub_comments"
  ON bookflow.class_submission_comments FOR DELETE
  USING (author_id = auth.uid());

-- ── 2. Student reply + teacher follow-up on feedback ─────────

ALTER TABLE bookflow.class_submission_feedback
  ADD COLUMN IF NOT EXISTS student_note       TEXT CHECK (char_length(student_note) <= 2000),
  ADD COLUMN IF NOT EXISTS student_noted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS teacher_follow_up  TEXT CHECK (char_length(teacher_follow_up) <= 2000),
  ADD COLUMN IF NOT EXISTS follow_up_at       TIMESTAMPTZ;

-- ── 3. Trigger: keep updated_at current ──────────────────────

CREATE OR REPLACE FUNCTION bookflow.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sub_comments_updated_at
  ON bookflow.class_submission_comments;

CREATE TRIGGER trg_sub_comments_updated_at
  BEFORE UPDATE ON bookflow.class_submission_comments
  FOR EACH ROW EXECUTE FUNCTION bookflow.set_updated_at();
