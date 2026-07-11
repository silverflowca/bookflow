-- ============================================================
-- 046_online_classes.sql
-- Adds Online Classes feature to BookFlow.
-- Extends book_clubs (club_type = 'online_class') and adds
-- 5 new tables: class_sessions, class_submission_prompts,
-- class_submissions, class_answer_feedback, class_submission_feedback
-- ============================================================

-- ── 1. Extend club_type CHECK constraint ─────────────────────────────────────
-- Drop the existing constraint added in 034_club_type.sql and recreate it
-- with 'online_class' included.

ALTER TABLE bookflow.book_clubs
  DROP CONSTRAINT IF EXISTS book_clubs_club_type_check;

ALTER TABLE bookflow.book_clubs
  ADD CONSTRAINT book_clubs_club_type_check
  CHECK (club_type IN ('club', 'study_group', 'online_class'));


-- ── 2. class_sessions ────────────────────────────────────────────────────────
-- Scheduled class meetings (lectures, live sessions, etc.)

CREATE TABLE IF NOT EXISTS bookflow.class_sessions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          UUID         NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  description      TEXT,
  session_date     TIMESTAMPTZ  NOT NULL,
  duration_minutes INTEGER      NOT NULL DEFAULT 60,
  meeting_url      TEXT,
  notes            TEXT,
  is_published     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by       UUID         NOT NULL REFERENCES bookflow.profiles(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_club_id
  ON bookflow.class_sessions(club_id);

CREATE INDEX IF NOT EXISTS idx_class_sessions_club_date
  ON bookflow.class_sessions(club_id, session_date);

ALTER TABLE bookflow.class_sessions ENABLE ROW LEVEL SECURITY;

-- Members can read published sessions (students) or all sessions (teacher)
CREATE POLICY "class_sessions_select" ON bookflow.class_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_sessions.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_sessions.club_id
        AND m.user_id = auth.uid()
        AND m.invite_accepted_at IS NOT NULL
        AND m.role IN ('admin')
    )
    OR (
      class_sessions.is_published = TRUE
      AND EXISTS (
        SELECT 1 FROM bookflow.club_members m2
        WHERE m2.club_id = class_sessions.club_id
          AND m2.user_id = auth.uid()
          AND m2.invite_accepted_at IS NOT NULL
      )
    )
  );

-- Only owners/admins manage sessions
CREATE POLICY "class_sessions_teacher_write" ON bookflow.class_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_sessions.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_sessions.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_sessions.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_sessions.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  );

CREATE POLICY "class_sessions_service_role" ON bookflow.class_sessions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_sessions TO service_role, authenticated;
GRANT SELECT ON bookflow.class_sessions TO anon;


-- ── 3. class_submission_prompts ──────────────────────────────────────────────
-- Teacher-defined writing prompts (journal, essay, assignment, scribe)

CREATE TABLE IF NOT EXISTS bookflow.class_submission_prompts (
  id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID              NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  chapter_id   UUID              REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  title        TEXT              NOT NULL,
  body         TEXT,
  prompt_type  TEXT              NOT NULL DEFAULT 'journal'
               CHECK (prompt_type IN ('journal', 'essay', 'assignment', 'scribe')),
  is_required  BOOLEAN           NOT NULL DEFAULT FALSE,
  due_date     TIMESTAMPTZ,
  sort_order   INTEGER           NOT NULL DEFAULT 0,
  created_by   UUID              NOT NULL REFERENCES bookflow.profiles(id),
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_prompts_club_id
  ON bookflow.class_submission_prompts(club_id);

CREATE INDEX IF NOT EXISTS idx_class_prompts_chapter
  ON bookflow.class_submission_prompts(chapter_id)
  WHERE chapter_id IS NOT NULL;

ALTER TABLE bookflow.class_submission_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_prompts_select" ON bookflow.class_submission_prompts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_submission_prompts.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_submission_prompts.club_id
        AND m.user_id = auth.uid()
        AND m.invite_accepted_at IS NOT NULL
    )
  );

CREATE POLICY "class_prompts_teacher_write" ON bookflow.class_submission_prompts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_submission_prompts.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_submission_prompts.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_submission_prompts.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_submission_prompts.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  );

CREATE POLICY "class_prompts_service_role" ON bookflow.class_submission_prompts
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_submission_prompts TO service_role, authenticated;
GRANT SELECT ON bookflow.class_submission_prompts TO anon;


-- ── 4. class_submissions ─────────────────────────────────────────────────────
-- Student journals, essays, and assignment submissions

CREATE TABLE IF NOT EXISTS bookflow.class_submissions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID         NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  prompt_id    UUID         REFERENCES bookflow.class_submission_prompts(id) ON DELETE SET NULL,
  chapter_id   UUID         REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  student_id   UUID         NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  title        TEXT,
  body         TEXT         NOT NULL,
  status       TEXT         NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'submitted', 'graded')),
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_submissions_club_id
  ON bookflow.class_submissions(club_id);

CREATE INDEX IF NOT EXISTS idx_class_submissions_student
  ON bookflow.class_submissions(student_id);

CREATE INDEX IF NOT EXISTS idx_class_submissions_prompt
  ON bookflow.class_submissions(prompt_id)
  WHERE prompt_id IS NOT NULL;

ALTER TABLE bookflow.class_submissions ENABLE ROW LEVEL SECURITY;

-- Students see own; teachers see all in their class
CREATE POLICY "class_submissions_select" ON bookflow.class_submissions
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_submissions.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_submissions.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  );

-- Students insert their own submissions
CREATE POLICY "class_submissions_insert" ON bookflow.class_submissions
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- Students update their own drafts; teachers cannot edit body
CREATE POLICY "class_submissions_update" ON bookflow.class_submissions
  FOR UPDATE USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Students delete their own drafts only
CREATE POLICY "class_submissions_delete" ON bookflow.class_submissions
  FOR DELETE USING (student_id = auth.uid() AND status = 'draft');

CREATE POLICY "class_submissions_service_role" ON bookflow.class_submissions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_submissions TO service_role, authenticated;
GRANT SELECT ON bookflow.class_submissions TO anon;


-- ── 5. class_answer_feedback ─────────────────────────────────────────────────
-- Teacher feedback on reader inline Q&A answers (form_responses table)

CREATE TABLE IF NOT EXISTS bookflow.class_answer_feedback (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID        NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  response_id   UUID        NOT NULL REFERENCES bookflow.form_responses(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  created_by    UUID        NOT NULL REFERENCES bookflow.profiles(id),
  grade         SMALLINT    CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100)),
  feedback_text TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, response_id)
);

CREATE INDEX IF NOT EXISTS idx_class_answer_feedback_club
  ON bookflow.class_answer_feedback(club_id);

CREATE INDEX IF NOT EXISTS idx_class_answer_feedback_response
  ON bookflow.class_answer_feedback(response_id);

CREATE INDEX IF NOT EXISTS idx_class_answer_feedback_student
  ON bookflow.class_answer_feedback(student_id);

ALTER TABLE bookflow.class_answer_feedback ENABLE ROW LEVEL SECURITY;

-- Students see feedback on their own answers; teachers see all
CREATE POLICY "class_answer_feedback_select" ON bookflow.class_answer_feedback
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_answer_feedback.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_answer_feedback.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  );

-- Teachers write/update/delete feedback
CREATE POLICY "class_answer_feedback_teacher_write" ON bookflow.class_answer_feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_answer_feedback.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_answer_feedback.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_answer_feedback.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_answer_feedback.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  );

CREATE POLICY "class_answer_feedback_service_role" ON bookflow.class_answer_feedback
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_answer_feedback TO service_role, authenticated;
GRANT SELECT ON bookflow.class_answer_feedback TO anon;


-- ── 6. class_submission_feedback ─────────────────────────────────────────────
-- Teacher feedback (grade + comment) on journal/essay submissions

CREATE TABLE IF NOT EXISTS bookflow.class_submission_feedback (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID        NOT NULL REFERENCES bookflow.class_submissions(id) ON DELETE CASCADE,
  club_id       UUID        NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  created_by    UUID        NOT NULL REFERENCES bookflow.profiles(id),
  grade         SMALLINT    CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100)),
  feedback_text TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id)
);

CREATE INDEX IF NOT EXISTS idx_class_sub_feedback_submission
  ON bookflow.class_submission_feedback(submission_id);

CREATE INDEX IF NOT EXISTS idx_class_sub_feedback_club
  ON bookflow.class_submission_feedback(club_id);

ALTER TABLE bookflow.class_submission_feedback ENABLE ROW LEVEL SECURITY;

-- Students see feedback on their own submissions
CREATE POLICY "class_sub_feedback_select" ON bookflow.class_submission_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookflow.class_submissions s
      WHERE s.id = class_submission_feedback.submission_id
        AND s.student_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_submission_feedback.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_submission_feedback.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  );

-- Teachers write feedback
CREATE POLICY "class_sub_feedback_teacher_write" ON bookflow.class_submission_feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_submission_feedback.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_submission_feedback.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookflow.book_clubs c
      WHERE c.id = class_submission_feedback.club_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.club_members m
      WHERE m.club_id = class_submission_feedback.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.invite_accepted_at IS NOT NULL
    )
  );

CREATE POLICY "class_sub_feedback_service_role" ON bookflow.class_submission_feedback
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_submission_feedback TO service_role, authenticated;
GRANT SELECT ON bookflow.class_submission_feedback TO anon;
