-- ============================================================================
-- BookFlow - Collaboration Migration for Railway/Supabase Cloud
-- Run this in the Supabase SQL Editor on your production project
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALTER EXISTING TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE bookflow.books
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'none';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_review_status_check' AND conrelid = 'bookflow.books'::regclass
  ) THEN
    ALTER TABLE bookflow.books ADD CONSTRAINT books_review_status_check
      CHECK (review_status IN ('none', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Backfill share_token for existing books that have NULL
UPDATE bookflow.books SET share_token = gen_random_uuid()::text WHERE share_token IS NULL;

ALTER TABLE bookflow.chapters
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES bookflow.profiles(id);

-- ----------------------------------------------------------------------------
-- 2. NEW TABLES (using bookflow.profiles for all user FKs)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bookflow.book_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    user_id UUID REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('author', 'editor', 'reviewer')),
    invited_by UUID NOT NULL REFERENCES bookflow.profiles(id),
    invited_email TEXT,
    invite_token TEXT UNIQUE,
    invite_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS book_collaborators_book_user_unique
  ON bookflow.book_collaborators(book_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bookflow.book_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    label TEXT,
    snapshot JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES bookflow.profiles(id),
    trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'submit_review', 'publish', 'auto')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_book_versions_book_id ON bookflow.book_versions(book_id, version_number);

CREATE TABLE IF NOT EXISTS bookflow.book_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES bookflow.chapters(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES bookflow.book_comments(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES bookflow.profiles(id),
    body TEXT NOT NULL,
    selection_start INTEGER,
    selection_end INTEGER,
    anchor_text TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
    resolved_by UUID REFERENCES bookflow.profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_book_comments_chapter ON bookflow.book_comments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_book_comments_book ON bookflow.book_comments(book_id);

CREATE TABLE IF NOT EXISTS bookflow.review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
    version_id UUID REFERENCES bookflow.book_versions(id),
    submitted_by UUID NOT NULL REFERENCES bookflow.profiles(id),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by UUID REFERENCES bookflow.profiles(id),
    reviewed_at TIMESTAMPTZ,
    reviewer_note TEXT,
    message TEXT
);
CREATE INDEX IF NOT EXISTS idx_review_requests_book ON bookflow.review_requests(book_id, status);

CREATE TABLE IF NOT EXISTS bookflow.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'invite', 'comment', 'comment_reply', 'review_submitted',
        'review_approved', 'review_rejected', 'mention'
    )),
    title TEXT NOT NULL,
    body TEXT,
    book_id UUID REFERENCES bookflow.books(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
    comment_id UUID REFERENCES bookflow.book_comments(id) ON DELETE SET NULL,
    review_request_id UUID REFERENCES bookflow.review_requests(id) ON DELETE CASCADE,
    invite_token TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON bookflow.user_notifications(user_id, read_at);

-- ----------------------------------------------------------------------------
-- 3. TRIGGERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bookflow.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_book_comments_updated_at') THEN
    CREATE TRIGGER trg_book_comments_updated_at
      BEFORE UPDATE ON bookflow.book_comments
      FOR EACH ROW EXECUTE FUNCTION bookflow.set_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION bookflow.next_version_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM bookflow.book_versions
  WHERE book_id = NEW.book_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_book_versions_number') THEN
    CREATE TRIGGER trg_book_versions_number
      BEFORE INSERT ON bookflow.book_versions
      FOR EACH ROW EXECUTE FUNCTION bookflow.next_version_number();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------

ALTER TABLE bookflow.book_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.book_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.book_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION bookflow.is_book_member(p_book_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookflow.books WHERE id = p_book_id AND author_id = p_user_id
    UNION ALL
    SELECT 1 FROM bookflow.book_collaborators
      WHERE book_id = p_book_id AND user_id = p_user_id AND invite_accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Owner or self can view collaborators" ON bookflow.book_collaborators;
CREATE POLICY "Owner or self can view collaborators" ON bookflow.book_collaborators
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owner can manage collaborators" ON bookflow.book_collaborators;
CREATE POLICY "Owner can manage collaborators" ON bookflow.book_collaborators
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access collaborators" ON bookflow.book_collaborators;
CREATE POLICY "Service role full access collaborators" ON bookflow.book_collaborators
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Book members can view versions" ON bookflow.book_versions;
CREATE POLICY "Book members can view versions" ON bookflow.book_versions
  FOR SELECT TO authenticated
  USING (bookflow.is_book_member(book_id, auth.uid()));

DROP POLICY IF EXISTS "Book members can create versions" ON bookflow.book_versions;
CREATE POLICY "Book members can create versions" ON bookflow.book_versions
  FOR INSERT TO authenticated
  WITH CHECK (bookflow.is_book_member(book_id, auth.uid()));

DROP POLICY IF EXISTS "Service role full access versions" ON bookflow.book_versions;
CREATE POLICY "Service role full access versions" ON bookflow.book_versions
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Book members can view comments" ON bookflow.book_comments;
CREATE POLICY "Book members can view comments" ON bookflow.book_comments
  FOR SELECT TO authenticated
  USING (bookflow.is_book_member(book_id, auth.uid()));

DROP POLICY IF EXISTS "Book members can create comments" ON bookflow.book_comments;
CREATE POLICY "Book members can create comments" ON bookflow.book_comments
  FOR INSERT TO authenticated
  WITH CHECK (bookflow.is_book_member(book_id, auth.uid()) AND author_id = auth.uid());

DROP POLICY IF EXISTS "Comment author or book owner can update" ON bookflow.book_comments;
CREATE POLICY "Comment author or book owner can update" ON bookflow.book_comments
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid())
  );

DROP POLICY IF EXISTS "Comment author or book owner can delete" ON bookflow.book_comments;
CREATE POLICY "Comment author or book owner can delete" ON bookflow.book_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public comments on public books" ON bookflow.book_comments;
CREATE POLICY "Public comments on public books" ON bookflow.book_comments
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND visibility = 'public'));

DROP POLICY IF EXISTS "Service role full access comments" ON bookflow.book_comments;
CREATE POLICY "Service role full access comments" ON bookflow.book_comments
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner and reviewers can view review requests" ON bookflow.review_requests;
CREATE POLICY "Owner and reviewers can view review requests" ON bookflow.review_requests
  FOR SELECT TO authenticated
  USING (bookflow.is_book_member(book_id, auth.uid()));

DROP POLICY IF EXISTS "Owner and authors can submit reviews" ON bookflow.review_requests;
CREATE POLICY "Owner and authors can submit reviews" ON bookflow.review_requests
  FOR INSERT TO authenticated
  WITH CHECK (bookflow.is_book_member(book_id, auth.uid()) AND submitted_by = auth.uid());

DROP POLICY IF EXISTS "Reviewer or owner can update review" ON bookflow.review_requests;
CREATE POLICY "Reviewer or owner can update review" ON bookflow.review_requests
  FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM bookflow.book_collaborators
      WHERE book_id = review_requests.book_id AND user_id = auth.uid() AND role = 'reviewer'
        AND invite_accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Service role full access reviews" ON bookflow.review_requests;
CREATE POLICY "Service role full access reviews" ON bookflow.review_requests
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users see own notifications" ON bookflow.user_notifications;
CREATE POLICY "Users see own notifications" ON bookflow.user_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON bookflow.user_notifications;
CREATE POLICY "Users update own notifications" ON bookflow.user_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access notifications" ON bookflow.user_notifications;
CREATE POLICY "Service role full access notifications" ON bookflow.user_notifications
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Collaborators can view private books" ON bookflow.books;
CREATE POLICY "Collaborators can view private books" ON bookflow.books
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM bookflow.book_collaborators
      WHERE book_id = books.id AND user_id = auth.uid() AND invite_accepted_at IS NOT NULL
    )
  );

-- ----------------------------------------------------------------------------
-- 5. GRANTS
-- ----------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON bookflow.book_collaborators TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.book_versions TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.book_comments TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.review_requests TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.user_notifications TO service_role, authenticated;
GRANT SELECT ON bookflow.book_collaborators TO anon;
GRANT SELECT ON bookflow.book_comments TO anon;
GRANT EXECUTE ON FUNCTION bookflow.is_book_member TO service_role, authenticated;
