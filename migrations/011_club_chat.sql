-- ============================================================================
-- BookFlow Migration 011 — Club Chat
-- Adds real-time group chat to book clubs: text, audio (FileFlow), snippets,
-- system status updates, per-member notification prefs, read receipts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add chat audio folder column to book_clubs
-- ----------------------------------------------------------------------------
ALTER TABLE bookflow.book_clubs
  ADD COLUMN IF NOT EXISTS chat_audio_fileflow_folder_id TEXT;

-- ----------------------------------------------------------------------------
-- 2. club_chat_settings — per-club configuration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookflow.club_chat_settings (
  club_id                        UUID PRIMARY KEY
                                   REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  chat_enabled                   BOOLEAN NOT NULL DEFAULT true,
  allow_audio_messages           BOOLEAN NOT NULL DEFAULT true,
  allow_snippet_sharing          BOOLEAN NOT NULL DEFAULT true,

  -- Status update automation
  weekly_status_updates          BOOLEAN NOT NULL DEFAULT true,
  chapter_completion_updates     BOOLEAN NOT NULL DEFAULT true,
  show_answers_in_completion     BOOLEAN NOT NULL DEFAULT true,

  -- Cron schedule (IANA cron expression, default = every Monday at 9am)
  weekly_cron_schedule           TEXT NOT NULL DEFAULT '0 9 * * 1',
  -- Human label stored separately so UI can display it nicely
  weekly_cron_label              TEXT NOT NULL DEFAULT 'Every Monday at 9:00 AM',

  -- Notification defaults (members can override via club_chat_member_prefs)
  default_notification_mode      TEXT NOT NULL DEFAULT 'all'
                                   CHECK (default_notification_mode IN ('all','mentions','none')),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookflow.club_chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can read chat settings" ON bookflow.club_chat_settings;
CREATE POLICY "Club members can read chat settings"
ON bookflow.club_chat_settings FOR SELECT
USING (
  club_id IN (
    SELECT club_id FROM bookflow.club_members
    WHERE user_id = auth.uid() AND invite_accepted_at IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Club admins can update chat settings" ON bookflow.club_chat_settings;
CREATE POLICY "Club admins can update chat settings"
ON bookflow.club_chat_settings FOR UPDATE
USING (
  club_id IN (
    SELECT club_id FROM bookflow.club_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin') AND invite_accepted_at IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Service role full access chat settings" ON bookflow.club_chat_settings;
CREATE POLICY "Service role full access chat settings"
ON bookflow.club_chat_settings FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON bookflow.club_chat_settings TO authenticated;
GRANT ALL ON bookflow.club_chat_settings TO service_role;

-- ----------------------------------------------------------------------------
-- 3. club_chat_member_prefs — per-member notification override
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookflow.club_chat_member_prefs (
  club_id           UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  notification_mode TEXT NOT NULL DEFAULT 'inherit'
                      CHECK (notification_mode IN ('inherit','all','mentions','none')),
  PRIMARY KEY (club_id, user_id)
);

ALTER TABLE bookflow.club_chat_member_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage own chat prefs" ON bookflow.club_chat_member_prefs;
CREATE POLICY "Members manage own chat prefs"
ON bookflow.club_chat_member_prefs FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access chat prefs" ON bookflow.club_chat_member_prefs;
CREATE POLICY "Service role full access chat prefs"
ON bookflow.club_chat_member_prefs FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.club_chat_member_prefs TO authenticated;
GRANT ALL ON bookflow.club_chat_member_prefs TO service_role;

-- ----------------------------------------------------------------------------
-- 4. club_chat_messages — main messages table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookflow.club_chat_messages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  book_id                UUID REFERENCES bookflow.books(id) ON DELETE SET NULL,
  sender_id              UUID REFERENCES bookflow.profiles(id) ON DELETE SET NULL,
  -- NULL sender_id = system message (status updates, completion notices)

  message_type           TEXT NOT NULL DEFAULT 'text'
                           CHECK (message_type IN ('text','audio','chapter_snippet','system_status')),

  body                   TEXT,

  -- Audio (message_type = 'audio')
  audio_fileflow_file_id TEXT,
  audio_fileflow_url     TEXT,
  audio_url_refreshed_at TIMESTAMPTZ,
  audio_duration_seconds INTEGER,
  audio_mime_type        TEXT,

  -- Chapter snippet (message_type = 'chapter_snippet')
  snippet_chapter_id     UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  snippet_comment_id     UUID REFERENCES bookflow.book_comments(id) ON DELETE SET NULL,
  snippet_text           TEXT,
  snippet_offset_start   INTEGER,
  snippet_offset_end     INTEGER,

  -- System status (message_type = 'system_status')
  status_payload         JSONB,
  -- { event: 'completion'|'progress'|'weekly_summary', member_id, chapter_title,
  --   percent, answers: [{question, answer}], members: [{...}] }

  reply_to_id            UUID REFERENCES bookflow.club_chat_messages(id) ON DELETE SET NULL,
  edited_at              TIMESTAMPTZ,
  deleted_at             TIMESTAMPTZ,   -- soft delete
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_chat_club_created
  ON bookflow.club_chat_messages(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_chat_sender
  ON bookflow.club_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_club_chat_snippet_chapter
  ON bookflow.club_chat_messages(snippet_chapter_id)
  WHERE snippet_chapter_id IS NOT NULL;

ALTER TABLE bookflow.club_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can read messages" ON bookflow.club_chat_messages;
CREATE POLICY "Club members can read messages"
ON bookflow.club_chat_messages FOR SELECT
USING (
  club_id IN (
    SELECT club_id FROM bookflow.club_members
    WHERE user_id = auth.uid() AND invite_accepted_at IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Club members can insert messages" ON bookflow.club_chat_messages;
CREATE POLICY "Club members can insert messages"
ON bookflow.club_chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND club_id IN (
    SELECT club_id FROM bookflow.club_members
    WHERE user_id = auth.uid() AND invite_accepted_at IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Senders can update own messages" ON bookflow.club_chat_messages;
CREATE POLICY "Senders can update own messages"
ON bookflow.club_chat_messages FOR UPDATE
USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access chat messages" ON bookflow.club_chat_messages;
CREATE POLICY "Service role full access chat messages"
ON bookflow.club_chat_messages FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON bookflow.club_chat_messages TO authenticated;
GRANT ALL ON bookflow.club_chat_messages TO service_role;

-- Enable Supabase Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE bookflow.club_chat_messages;

-- ----------------------------------------------------------------------------
-- 5. club_chat_read_receipts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookflow.club_chat_read_receipts (
  club_id              UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES bookflow.club_chat_messages(id) ON DELETE SET NULL,
  last_read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

ALTER TABLE bookflow.club_chat_read_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage own read receipts" ON bookflow.club_chat_read_receipts;
CREATE POLICY "Members manage own read receipts"
ON bookflow.club_chat_read_receipts FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access read receipts" ON bookflow.club_chat_read_receipts;
CREATE POLICY "Service role full access read receipts"
ON bookflow.club_chat_read_receipts FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.club_chat_read_receipts TO authenticated;
GRANT ALL ON bookflow.club_chat_read_receipts TO service_role;

-- ----------------------------------------------------------------------------
-- 6. Extend user_notifications type CHECK to include chat types
-- ----------------------------------------------------------------------------
ALTER TABLE bookflow.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_type_check;

ALTER TABLE bookflow.user_notifications
  ADD CONSTRAINT user_notifications_type_check CHECK (type IN (
    'invite',
    'comment',
    'comment_reply',
    'review_submitted',
    'review_approved',
    'review_rejected',
    'mention',
    'chat_message',
    'chat_mention',
    'status_update'
  ));

-- ----------------------------------------------------------------------------
-- 7. Add club_id / chat_message_id context columns to user_notifications
-- (nullable — only set for chat-related notifications)
-- ----------------------------------------------------------------------------
ALTER TABLE bookflow.user_notifications
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS chat_message_id UUID REFERENCES bookflow.club_chat_messages(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 8. Seed club_chat_settings for any existing clubs
-- ----------------------------------------------------------------------------
INSERT INTO bookflow.club_chat_settings (club_id)
SELECT id FROM bookflow.book_clubs
ON CONFLICT (club_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9. Grants
-- ----------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bookflow TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bookflow TO service_role;
