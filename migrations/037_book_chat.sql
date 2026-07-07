-- 037: Book-level chat + enable_listen toggle
-- Creates book_chat_messages, book_chat_read_receipts tables
-- Adds enable_listen, enable_book_chat, chat_share_reader_progress, chat_share_book_progress to book_settings
-- Adds share_my_progress to profiles

-- 1. book_settings — 4 new columns
ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS enable_listen                BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_book_chat             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_share_reader_progress   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_share_book_progress     BOOLEAN NOT NULL DEFAULT true;

-- 2. profiles — share_my_progress
ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS share_my_progress BOOLEAN NOT NULL DEFAULT true;

-- 3. book_chat_messages
CREATE TABLE IF NOT EXISTS bookflow.book_chat_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id        UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  sender_id      UUID REFERENCES bookflow.profiles(id) ON DELETE SET NULL,
  message_type   TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','system_status')),
  body           TEXT,
  status_payload JSONB,
  reply_to_id    UUID REFERENCES bookflow.book_chat_messages(id) ON DELETE SET NULL,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_chat_book_created
  ON bookflow.book_chat_messages(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_chat_sender
  ON bookflow.book_chat_messages(sender_id);

-- RLS for book_chat_messages
ALTER TABLE bookflow.book_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Book readers can read chat" ON bookflow.book_chat_messages;
CREATE POLICY "Book readers can read chat"
ON bookflow.book_chat_messages FOR SELECT
USING (
  book_id IN (
    SELECT book_id FROM bookflow.reading_progress WHERE user_id = auth.uid()
    UNION
    SELECT id FROM bookflow.books WHERE visibility = 'public'
  )
);

DROP POLICY IF EXISTS "Authenticated users insert book chat" ON bookflow.book_chat_messages;
CREATE POLICY "Authenticated users insert book chat"
ON bookflow.book_chat_messages FOR INSERT
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Senders update own messages" ON bookflow.book_chat_messages;
CREATE POLICY "Senders update own messages"
ON bookflow.book_chat_messages FOR UPDATE
USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Service role book chat" ON bookflow.book_chat_messages;
CREATE POLICY "Service role book chat"
ON bookflow.book_chat_messages FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON bookflow.book_chat_messages TO authenticated;
GRANT ALL ON bookflow.book_chat_messages TO service_role;

-- Enable Supabase Realtime on book_chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE bookflow.book_chat_messages;

-- 4. book_chat_read_receipts
CREATE TABLE IF NOT EXISTS bookflow.book_chat_read_receipts (
  book_id              UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES bookflow.book_chat_messages(id) ON DELETE SET NULL,
  last_read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, user_id)
);

ALTER TABLE bookflow.book_chat_read_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own receipts" ON bookflow.book_chat_read_receipts;
CREATE POLICY "Users manage own receipts"
ON bookflow.book_chat_read_receipts FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role receipts" ON bookflow.book_chat_read_receipts;
CREATE POLICY "Service role receipts"
ON bookflow.book_chat_read_receipts FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.book_chat_read_receipts TO authenticated;
GRANT ALL ON bookflow.book_chat_read_receipts TO service_role;

-- Blanket grants
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bookflow TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bookflow TO service_role;
