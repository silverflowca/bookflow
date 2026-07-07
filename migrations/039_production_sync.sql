-- ============================================================
-- Migration 039: Production sync
-- Combines 037_esignature_feature + 037_book_chat + 038_signature_update_policy
-- Safe to run on a fresh production DB (all statements use IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- ─── 1. E-Signature table ───────────────────────────────────

CREATE TABLE IF NOT EXISTS bookflow.signature_responses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inline_content_id UUID        NOT NULL REFERENCES bookflow.inline_content(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id           UUID        NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  signer_name       TEXT,
  signature_type    TEXT        NOT NULL CHECK (signature_type IN ('drawn','typed','checkbox')),
  signature_data    TEXT,
  agreed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        TEXT,
  user_agent        TEXT,
  visibility        TEXT        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared','public')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inline_content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_signature_responses_book    ON bookflow.signature_responses(book_id);
CREATE INDEX IF NOT EXISTS idx_signature_responses_content ON bookflow.signature_responses(inline_content_id);

-- Update inline_content content_type constraint to include 'signature'
ALTER TABLE bookflow.inline_content DROP CONSTRAINT IF EXISTS inline_content_content_type_check;
ALTER TABLE bookflow.inline_content ADD CONSTRAINT inline_content_content_type_check CHECK (
  content_type IN (
    'question','poll','highlight','note','link','audio','video',
    'select','multiselect','textbox','textarea','radio','checkbox',
    'code_block','scripture_block','image','drawing','media_response','signature'
  )
);

-- RLS
ALTER TABLE bookflow.signature_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='signature_responses' AND policyname='Users see own signatures') THEN
    CREATE POLICY "Users see own signatures" ON bookflow.signature_responses FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='signature_responses' AND policyname='Book authors see all signatures') THEN
    CREATE POLICY "Book authors see all signatures" ON bookflow.signature_responses FOR SELECT
      USING (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='signature_responses' AND policyname='Collaborators see all signatures') THEN
    CREATE POLICY "Collaborators see all signatures" ON bookflow.signature_responses FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM bookflow.book_collaborators
        WHERE book_id = signature_responses.book_id AND user_id = auth.uid()
          AND invite_accepted_at IS NOT NULL AND role IN ('author','editor','reviewer')
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='signature_responses' AND policyname='Users insert own signatures') THEN
    CREATE POLICY "Users insert own signatures" ON bookflow.signature_responses FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='signature_responses' AND policyname='Users update own signatures') THEN
    CREATE POLICY "Users update own signatures" ON bookflow.signature_responses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='signature_responses' AND policyname='Users delete own signatures') THEN
    CREATE POLICY "Users delete own signatures" ON bookflow.signature_responses FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.signature_responses TO authenticated;
GRANT ALL ON bookflow.signature_responses TO service_role;


-- ─── 2. Book settings — Listen & Chat columns ───────────────

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS enable_listen              BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_book_chat           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_share_reader_progress BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_share_book_progress   BOOLEAN NOT NULL DEFAULT true;


-- ─── 3. Profiles — share_my_progress ────────────────────────

ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS share_my_progress BOOLEAN NOT NULL DEFAULT true;


-- ─── 4. Book chat messages ───────────────────────────────────

CREATE TABLE IF NOT EXISTS bookflow.book_chat_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id        UUID        NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  sender_id      UUID        REFERENCES bookflow.profiles(id) ON DELETE SET NULL,
  message_type   TEXT        NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','system_status')),
  body           TEXT,
  status_payload JSONB,
  reply_to_id    UUID        REFERENCES bookflow.book_chat_messages(id) ON DELETE SET NULL,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_chat_book_created ON bookflow.book_chat_messages(book_id, created_at DESC);

ALTER TABLE bookflow.book_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='book_chat_messages' AND policyname='Book readers can read chat') THEN
    CREATE POLICY "Book readers can read chat" ON bookflow.book_chat_messages FOR SELECT USING (
      book_id IN (
        SELECT book_id FROM bookflow.reading_progress WHERE user_id = auth.uid()
        UNION
        SELECT id FROM bookflow.books WHERE visibility = 'public'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='book_chat_messages' AND policyname='Authenticated users insert book chat') THEN
    CREATE POLICY "Authenticated users insert book chat" ON bookflow.book_chat_messages FOR INSERT WITH CHECK (sender_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='book_chat_messages' AND policyname='Senders update own messages') THEN
    CREATE POLICY "Senders update own messages" ON bookflow.book_chat_messages FOR UPDATE USING (sender_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='book_chat_messages' AND policyname='Service role book chat') THEN
    CREATE POLICY "Service role book chat" ON bookflow.book_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON bookflow.book_chat_messages TO authenticated;
GRANT ALL ON bookflow.book_chat_messages TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE bookflow.book_chat_messages;


-- ─── 5. Book chat read receipts ─────────────────────────────

CREATE TABLE IF NOT EXISTS bookflow.book_chat_read_receipts (
  book_id              UUID        NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID        REFERENCES bookflow.book_chat_messages(id) ON DELETE SET NULL,
  last_read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, user_id)
);

ALTER TABLE bookflow.book_chat_read_receipts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='book_chat_read_receipts' AND policyname='Users manage own receipts') THEN
    CREATE POLICY "Users manage own receipts" ON bookflow.book_chat_read_receipts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='book_chat_read_receipts' AND policyname='Service role receipts') THEN
    CREATE POLICY "Service role receipts" ON bookflow.book_chat_read_receipts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.book_chat_read_receipts TO authenticated;
GRANT ALL ON bookflow.book_chat_read_receipts TO service_role;
