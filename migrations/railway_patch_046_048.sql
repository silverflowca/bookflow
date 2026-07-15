-- ============================================================
-- Railway patch: migrations 046 → 048
-- Online Classes + Class Threads + Custom Registration Form
-- Safe to run multiple times (all use IF NOT EXISTS / DROP IF EXISTS)
-- Run in Supabase SQL Editor on the production database.
-- ============================================================

SET search_path TO bookflow, public;

-- ════════════════════════════════════════════════════════════
-- 046: Online Classes
-- ════════════════════════════════════════════════════════════

-- 1. Extend club_type constraint to include 'online_class'
ALTER TABLE bookflow.book_clubs
  DROP CONSTRAINT IF EXISTS book_clubs_club_type_check;

ALTER TABLE bookflow.book_clubs
  ADD CONSTRAINT book_clubs_club_type_check
  CHECK (club_type IN ('club', 'study_group', 'online_class'));


-- 2. class_sessions
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

DROP POLICY IF EXISTS "class_sessions_select" ON bookflow.class_sessions;
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

DROP POLICY IF EXISTS "class_sessions_teacher_write" ON bookflow.class_sessions;
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

DROP POLICY IF EXISTS "class_sessions_service_role" ON bookflow.class_sessions;
CREATE POLICY "class_sessions_service_role" ON bookflow.class_sessions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_sessions TO service_role, authenticated;
GRANT SELECT ON bookflow.class_sessions TO anon;


-- 3. class_submission_prompts
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

DROP POLICY IF EXISTS "class_prompts_select" ON bookflow.class_submission_prompts;
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

DROP POLICY IF EXISTS "class_prompts_teacher_write" ON bookflow.class_submission_prompts;
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

DROP POLICY IF EXISTS "class_prompts_service_role" ON bookflow.class_submission_prompts;
CREATE POLICY "class_prompts_service_role" ON bookflow.class_submission_prompts
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_submission_prompts TO service_role, authenticated;
GRANT SELECT ON bookflow.class_submission_prompts TO anon;


-- 4. class_submissions
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

DROP POLICY IF EXISTS "class_submissions_select" ON bookflow.class_submissions;
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

DROP POLICY IF EXISTS "class_submissions_insert" ON bookflow.class_submissions;
CREATE POLICY "class_submissions_insert" ON bookflow.class_submissions
  FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "class_submissions_update" ON bookflow.class_submissions;
CREATE POLICY "class_submissions_update" ON bookflow.class_submissions
  FOR UPDATE USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "class_submissions_delete" ON bookflow.class_submissions;
CREATE POLICY "class_submissions_delete" ON bookflow.class_submissions
  FOR DELETE USING (student_id = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "class_submissions_service_role" ON bookflow.class_submissions;
CREATE POLICY "class_submissions_service_role" ON bookflow.class_submissions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_submissions TO service_role, authenticated;
GRANT SELECT ON bookflow.class_submissions TO anon;


-- 5. class_answer_feedback
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

DROP POLICY IF EXISTS "class_answer_feedback_select" ON bookflow.class_answer_feedback;
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

DROP POLICY IF EXISTS "class_answer_feedback_teacher_write" ON bookflow.class_answer_feedback;
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

DROP POLICY IF EXISTS "class_answer_feedback_service_role" ON bookflow.class_answer_feedback;
CREATE POLICY "class_answer_feedback_service_role" ON bookflow.class_answer_feedback
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_answer_feedback TO service_role, authenticated;
GRANT SELECT ON bookflow.class_answer_feedback TO anon;


-- 6. class_submission_feedback
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

DROP POLICY IF EXISTS "class_sub_feedback_select" ON bookflow.class_submission_feedback;
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

DROP POLICY IF EXISTS "class_sub_feedback_teacher_write" ON bookflow.class_submission_feedback;
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

DROP POLICY IF EXISTS "class_sub_feedback_service_role" ON bookflow.class_submission_feedback;
CREATE POLICY "class_sub_feedback_service_role" ON bookflow.class_submission_feedback
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON bookflow.class_submission_feedback TO service_role, authenticated;
GRANT SELECT ON bookflow.class_submission_feedback TO anon;


-- ════════════════════════════════════════════════════════════
-- 047: Class Threads (response comments + 1:1 DMs)
-- ════════════════════════════════════════════════════════════

-- 1. class_response_comments
CREATE TABLE IF NOT EXISTS bookflow.class_response_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  response_id UUID NOT NULL REFERENCES bookflow.form_responses(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_response_comments_response
  ON bookflow.class_response_comments(response_id);
CREATE INDEX IF NOT EXISTS idx_class_response_comments_club
  ON bookflow.class_response_comments(club_id);

ALTER TABLE bookflow.class_response_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_response_comments_select" ON bookflow.class_response_comments;
CREATE POLICY "class_response_comments_select" ON bookflow.class_response_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookflow.club_members cm
      WHERE cm.club_id = class_response_comments.club_id
        AND cm.user_id = auth.uid()
        AND cm.invite_accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "class_response_comments_insert" ON bookflow.class_response_comments;
CREATE POLICY "class_response_comments_insert" ON bookflow.class_response_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM bookflow.club_members cm
      WHERE cm.club_id = class_response_comments.club_id
        AND cm.user_id = auth.uid()
        AND cm.invite_accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "class_response_comments_delete" ON bookflow.class_response_comments;
CREATE POLICY "class_response_comments_delete" ON bookflow.class_response_comments
  FOR DELETE USING (author_id = auth.uid());

GRANT ALL ON bookflow.class_response_comments TO service_role, authenticated;


-- 2. class_direct_messages
CREATE TABLE IF NOT EXISTS bookflow.class_direct_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_a     UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  user_b     UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_dm_club
  ON bookflow.class_direct_messages(club_id);
CREATE INDEX IF NOT EXISTS idx_class_dm_pair
  ON bookflow.class_direct_messages(club_id, user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_class_dm_author
  ON bookflow.class_direct_messages(author_id);

ALTER TABLE bookflow.class_direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_dm_select" ON bookflow.class_direct_messages;
CREATE POLICY "class_dm_select" ON bookflow.class_direct_messages
  FOR SELECT USING (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "class_dm_insert" ON bookflow.class_direct_messages;
CREATE POLICY "class_dm_insert" ON bookflow.class_direct_messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    (user_a = auth.uid() OR user_b = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM bookflow.club_members cm
      WHERE cm.club_id = class_direct_messages.club_id
        AND cm.user_id = auth.uid()
        AND cm.invite_accepted_at IS NOT NULL
    )
  );

GRANT ALL ON bookflow.class_direct_messages TO service_role, authenticated;


-- ════════════════════════════════════════════════════════════
-- 048: Custom Registration Form
-- ════════════════════════════════════════════════════════════

-- 1. Extend club_settings with registration columns
ALTER TABLE bookflow.club_settings
  ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_fields   JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS registration_bg_url   TEXT,
  ADD COLUMN IF NOT EXISTS welcome_heading       TEXT    DEFAULT 'Welcome!',
  ADD COLUMN IF NOT EXISTS welcome_body          TEXT,
  ADD COLUMN IF NOT EXISTS welcome_cta_label     TEXT    DEFAULT 'Go to Class';

-- 2. club_member_responses — submitted form answers per member
CREATE TABLE IF NOT EXISTS bookflow.club_member_responses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID        NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  responses    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_member_responses_club
  ON bookflow.club_member_responses(club_id);
CREATE INDEX IF NOT EXISTS idx_club_member_responses_user
  ON bookflow.club_member_responses(user_id);

ALTER TABLE bookflow.club_member_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_sees_own_responses" ON bookflow.club_member_responses;
CREATE POLICY "member_sees_own_responses" ON bookflow.club_member_responses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_sees_club_responses" ON bookflow.club_member_responses;
CREATE POLICY "admin_sees_club_responses" ON bookflow.club_member_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookflow.club_members
      WHERE club_id = club_member_responses.club_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'teacher')
        AND invite_accepted_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.book_clubs
      WHERE id = club_member_responses.club_id
        AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "member_inserts_own_response" ON bookflow.club_member_responses;
CREATE POLICY "member_inserts_own_response" ON bookflow.club_member_responses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_full_access_responses" ON bookflow.club_member_responses;
CREATE POLICY "service_role_full_access_responses" ON bookflow.club_member_responses
  TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON bookflow.club_member_responses TO service_role, authenticated;
