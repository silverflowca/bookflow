-- ============================================================
-- Railway patch: migrations 036 → 039
-- Safe to run multiple times (all use IF NOT EXISTS / IF EXISTS)
-- Run in Supabase SQL Editor on the production database.
-- ============================================================

-- ─── 036: Response visibility ────────────────────────────────

-- 1. Allow 'shared' as a valid book visibility value
ALTER TABLE bookflow.books
  DROP CONSTRAINT IF EXISTS books_visibility_check;
ALTER TABLE bookflow.books
  ADD CONSTRAINT books_visibility_check
    CHECK (visibility IN ('private', 'shared', 'public'));

-- 2. book_shares table
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
DROP POLICY IF EXISTS "book_shares_author_all" ON bookflow.book_shares;
CREATE POLICY "book_shares_author_all" ON bookflow.book_shares
  FOR ALL USING (EXISTS (SELECT 1 FROM bookflow.books b WHERE b.id = book_id AND b.author_id = auth.uid()));
DROP POLICY IF EXISTS "book_shares_recipient_select" ON bookflow.book_shares;
CREATE POLICY "book_shares_recipient_select" ON bookflow.book_shares
  FOR SELECT USING (user_id = auth.uid());

-- 3. Add visibility column to response tables
ALTER TABLE bookflow.poll_responses
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('private', 'shared', 'public'));
ALTER TABLE bookflow.question_answers
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('private', 'shared', 'public'));
ALTER TABLE bookflow.form_responses
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('private', 'shared', 'public'));

-- 4. Helper functions
CREATE OR REPLACE FUNCTION bookflow.viewer_can_access_book(p_book_id UUID, p_viewer_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookflow.books b WHERE b.id = p_book_id AND (
      b.visibility = 'public'
      OR b.author_id = p_viewer_id
      OR EXISTS (SELECT 1 FROM bookflow.book_shares bs WHERE bs.book_id = p_book_id AND bs.user_id = p_viewer_id)
      OR EXISTS (SELECT 1 FROM bookflow.club_books cb JOIN bookflow.club_members cm ON cm.club_id = cb.club_id WHERE cb.book_id = p_book_id AND cm.user_id = p_viewer_id)
    )
  )
$$;

CREATE OR REPLACE FUNCTION bookflow.viewers_share_book_channel(p_book_id UUID, p_viewer_id UUID, p_respondent_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookflow.club_members cm_v
    JOIN bookflow.club_members cm_r ON cm_r.club_id = cm_v.club_id
    JOIN bookflow.club_books cb ON cb.club_id = cm_v.club_id
    WHERE cm_v.user_id = p_viewer_id AND cm_r.user_id = p_respondent_id AND cb.book_id = p_book_id
  ) OR EXISTS (
    SELECT 1 FROM bookflow.book_shares bs_v
    JOIN bookflow.book_shares bs_r ON bs_r.book_id = bs_v.book_id
    WHERE bs_v.user_id = p_viewer_id AND bs_r.user_id = p_respondent_id AND bs_v.book_id = p_book_id
  )
$$;

-- 5. Update RLS policies for poll_responses
DROP POLICY IF EXISTS "poll_responses_select" ON bookflow.poll_responses;
DROP POLICY IF EXISTS "poll_responses_manage" ON bookflow.poll_responses;
CREATE POLICY "poll_responses_select" ON bookflow.poll_responses FOR SELECT USING (
  user_id = auth.uid()
  OR (visibility != 'private' AND EXISTS (SELECT 1 FROM bookflow.inline_content ic JOIN bookflow.books b ON b.id = ic.book_id WHERE ic.id = inline_content_id AND b.author_id = auth.uid()))
  OR (visibility = 'shared' AND EXISTS (SELECT 1 FROM bookflow.inline_content ic WHERE ic.id = inline_content_id AND bookflow.viewers_share_book_channel(ic.book_id, auth.uid(), poll_responses.user_id)))
  OR (visibility = 'public' AND EXISTS (SELECT 1 FROM bookflow.inline_content ic WHERE ic.id = inline_content_id AND bookflow.viewer_can_access_book(ic.book_id, auth.uid())))
);
CREATE POLICY "poll_responses_insert" ON bookflow.poll_responses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "poll_responses_update" ON bookflow.poll_responses FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "poll_responses_delete" ON bookflow.poll_responses FOR DELETE USING (user_id = auth.uid());

-- 6. Update books RLS to allow 'shared' visibility
DROP POLICY IF EXISTS "books_select" ON bookflow.books;
CREATE POLICY "books_select" ON bookflow.books FOR SELECT USING (
  visibility = 'public'
  OR author_id = auth.uid()
  OR (visibility = 'shared' AND (
    EXISTS (SELECT 1 FROM bookflow.book_shares bs WHERE bs.book_id = books.id AND bs.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM bookflow.club_books cb JOIN bookflow.club_members cm ON cm.club_id = cb.club_id WHERE cb.book_id = books.id AND cm.user_id = auth.uid())
  ))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.book_shares TO authenticated;
GRANT ALL ON bookflow.book_shares TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.poll_responses TO authenticated;
GRANT ALL ON bookflow.poll_responses TO service_role;


-- ─── 037: E-Signatures ───────────────────────────────────────

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
ALTER TABLE bookflow.inline_content DROP CONSTRAINT IF EXISTS inline_content_content_type_check;
ALTER TABLE bookflow.inline_content ADD CONSTRAINT inline_content_content_type_check CHECK (
  content_type IN ('question','poll','highlight','note','link','audio','video','select','multiselect','textbox','textarea','radio','checkbox','code_block','scripture_block','image','drawing','media_response','signature')
);
ALTER TABLE bookflow.signature_responses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='signature_responses' AND policyname='Users see own signatures') THEN
    CREATE POLICY "Users see own signatures" ON bookflow.signature_responses FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='bookflow' AND tablename='signature_responses' AND policyname='Book authors see all signatures') THEN
    CREATE POLICY "Book authors see all signatures" ON bookflow.signature_responses FOR SELECT USING (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()));
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


-- ─── 037b: Book Chat ─────────────────────────────────────────

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS enable_listen              BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_book_chat           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_share_reader_progress BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_share_book_progress   BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS share_my_progress BOOLEAN NOT NULL DEFAULT true;

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
      book_id IN (SELECT book_id FROM bookflow.reading_progress WHERE user_id = auth.uid() UNION SELECT id FROM bookflow.books WHERE visibility = 'public')
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'book_chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookflow.book_chat_messages;
  END IF;
END $$;

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


-- ─── 038: Signature update policy ───────────────────────────

-- (already handled in 037 section above with IF NOT EXISTS guards)


-- ─── 039: Production sync (already covered above) ───────────

-- All done.
