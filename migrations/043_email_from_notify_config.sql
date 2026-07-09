-- Migration 043: Email from address + notify config per context
-- Adds:
--   email_from TEXT to books, book_clubs, app_settings
--   notify_config JSONB to books, book_clubs
--   study_group_progress table (per-member per-chapter tracking for study_group type clubs)

-- ── books ─────────────────────────────────────────────────────────────────────
ALTER TABLE bookflow.books
  ADD COLUMN IF NOT EXISTS email_from       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notify_config    JSONB   NOT NULL DEFAULT '{}';

-- ── book_clubs ────────────────────────────────────────────────────────────────
ALTER TABLE bookflow.book_clubs
  ADD COLUMN IF NOT EXISTS email_from       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notify_config    JSONB   NOT NULL DEFAULT '{}';

-- ── app_settings ──────────────────────────────────────────────────────────────
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS email_from       TEXT    NOT NULL DEFAULT '';

-- ── study_group_progress ──────────────────────────────────────────────────────
-- Tracks per-member chapter completion inside study groups (club_type='study_group')
CREATE TABLE IF NOT EXISTS bookflow.study_group_progress (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID        NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES bookflow.profiles(id)   ON DELETE CASCADE,
  chapter_id    UUID        NOT NULL REFERENCES bookflow.chapters(id)   ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_study_progress_club   ON bookflow.study_group_progress(club_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_user   ON bookflow.study_group_progress(club_id, user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_chapter ON bookflow.study_group_progress(chapter_id);

-- RLS
ALTER TABLE bookflow.study_group_progress ENABLE ROW LEVEL SECURITY;

-- Members can see all progress in clubs they belong to
CREATE POLICY "study_progress_select" ON bookflow.study_group_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookflow.club_members cm
      WHERE cm.club_id = study_group_progress.club_id
        AND cm.user_id = auth.uid()
        AND cm.invite_accepted_at IS NOT NULL
    )
  );

-- Members can insert/delete their own progress rows
CREATE POLICY "study_progress_insert" ON bookflow.study_group_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_progress_delete" ON bookflow.study_group_progress
  FOR DELETE USING (user_id = auth.uid());

-- ── extend user_notifications CHECK for new study group types ─────────────────
ALTER TABLE bookflow.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_type_check;

ALTER TABLE bookflow.user_notifications
  ADD CONSTRAINT user_notifications_type_check CHECK (type IN (
    'comment', 'comment_reply',
    'invite',
    'review_submitted', 'review_approved', 'review_rejected',
    'feedback_reply',
    'club_invite', 'club_book_added', 'club_discussion', 'club_discussion_reply',
    'club_join_request', 'club_request_declined', 'club_invite_cancelled',
    'chat_message', 'chat_mention', 'status_update',
    'group_invite', 'group_book_added', 'group_session',
    'group_chapter_due', 'group_discussion', 'group_discussion_reply',
    'group_progress'
  ));
