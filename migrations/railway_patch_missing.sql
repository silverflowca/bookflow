-- ============================================================================
-- BookFlow: Production Patch — Migrations 004 through 011
-- Run once in Supabase SQL Editor on production.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================================


-- ============================================================================
-- 004a: Collaboration tables (book_collaborators, versions, comments, etc.)
-- ============================================================================

ALTER TABLE bookflow.books
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'none';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_review_status_check'
      AND conrelid = 'bookflow.books'::regclass
  ) THEN
    ALTER TABLE bookflow.books ADD CONSTRAINT books_review_status_check
      CHECK (review_status IN ('none', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

UPDATE bookflow.books SET share_token = gen_random_uuid()::text WHERE share_token IS NULL;

ALTER TABLE bookflow.chapters
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES bookflow.profiles(id);

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
    type TEXT NOT NULL,
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

-- Triggers
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

-- RLS
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
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()));

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
  FOR SELECT TO authenticated USING (bookflow.is_book_member(book_id, auth.uid()));

DROP POLICY IF EXISTS "Book members can create versions" ON bookflow.book_versions;
CREATE POLICY "Book members can create versions" ON bookflow.book_versions
  FOR INSERT TO authenticated WITH CHECK (bookflow.is_book_member(book_id, auth.uid()));

DROP POLICY IF EXISTS "Service role full access versions" ON bookflow.book_versions;
CREATE POLICY "Service role full access versions" ON bookflow.book_versions
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Book members can view comments" ON bookflow.book_comments;
CREATE POLICY "Book members can view comments" ON bookflow.book_comments
  FOR SELECT TO authenticated USING (bookflow.is_book_member(book_id, auth.uid()));

DROP POLICY IF EXISTS "Book members can create comments" ON bookflow.book_comments;
CREATE POLICY "Book members can create comments" ON bookflow.book_comments
  FOR INSERT TO authenticated
  WITH CHECK (bookflow.is_book_member(book_id, auth.uid()) AND author_id = auth.uid());

DROP POLICY IF EXISTS "Comment author or book owner can update" ON bookflow.book_comments;
CREATE POLICY "Comment author or book owner can update" ON bookflow.book_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()));

DROP POLICY IF EXISTS "Comment author or book owner can delete" ON bookflow.book_comments;
CREATE POLICY "Comment author or book owner can delete" ON bookflow.book_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()));

DROP POLICY IF EXISTS "Public comments on public books" ON bookflow.book_comments;
CREATE POLICY "Public comments on public books" ON bookflow.book_comments
  FOR SELECT USING (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND visibility = 'public'));

DROP POLICY IF EXISTS "Service role full access comments" ON bookflow.book_comments;
CREATE POLICY "Service role full access comments" ON bookflow.book_comments
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner and reviewers can view review requests" ON bookflow.review_requests;
CREATE POLICY "Owner and reviewers can view review requests" ON bookflow.review_requests
  FOR SELECT TO authenticated USING (bookflow.is_book_member(book_id, auth.uid()));

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
    OR EXISTS (SELECT 1 FROM bookflow.book_collaborators WHERE book_id = review_requests.book_id AND user_id = auth.uid() AND role = 'reviewer' AND invite_accepted_at IS NOT NULL)
  );

DROP POLICY IF EXISTS "Service role full access reviews" ON bookflow.review_requests;
CREATE POLICY "Service role full access reviews" ON bookflow.review_requests
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users see own notifications" ON bookflow.user_notifications;
CREATE POLICY "Users see own notifications" ON bookflow.user_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON bookflow.user_notifications;
CREATE POLICY "Users update own notifications" ON bookflow.user_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access notifications" ON bookflow.user_notifications;
CREATE POLICY "Service role full access notifications" ON bookflow.user_notifications
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Collaborators can view private books" ON bookflow.books;
CREATE POLICY "Collaborators can view private books" ON bookflow.books
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM bookflow.book_collaborators WHERE book_id = books.id AND user_id = auth.uid() AND invite_accepted_at IS NOT NULL)
  );

GRANT ALL PRIVILEGES ON bookflow.book_collaborators TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.book_versions TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.book_comments TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.review_requests TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.user_notifications TO service_role, authenticated;
GRANT SELECT ON bookflow.book_collaborators TO anon;
GRANT SELECT ON bookflow.book_comments TO anon;
GRANT EXECUTE ON FUNCTION bookflow.is_book_member TO service_role, authenticated;


-- ============================================================================
-- 004b: FileFlow folder references per book
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookflow.book_fileflow_folders (
  book_id           UUID PRIMARY KEY REFERENCES bookflow.books(id) ON DELETE CASCADE,
  root_folder_id    TEXT NOT NULL,
  images_folder_id  TEXT NOT NULL,
  videos_folder_id  TEXT NOT NULL,
  backups_folder_id TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL PRIVILEGES ON bookflow.book_fileflow_folders TO service_role, authenticated;


-- ============================================================================
-- 005a: Storage bucket for book covers
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('bookflow-covers', 'bookflow-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read bookflow covers" ON storage.objects;
CREATE POLICY "Public read bookflow covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'bookflow-covers');

DROP POLICY IF EXISTS "Auth upload bookflow covers" ON storage.objects;
CREATE POLICY "Auth upload bookflow covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bookflow-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth update bookflow covers" ON storage.objects;
CREATE POLICY "Auth update bookflow covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bookflow-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth delete bookflow covers" ON storage.objects;
CREATE POLICY "Auth delete bookflow covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bookflow-covers' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================================
-- 005b: Publisher submissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookflow.publisher_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id        UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL CHECK (platform IN ('draft2digital', 'smashwords', 'manual')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'submitted', 'processing', 'published', 'failed', 'cancelled')),
  submission_id  TEXT,
  publisher_url  TEXT,
  submitted_by   UUID NOT NULL REFERENCES bookflow.profiles(id),
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  metadata       JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_publisher_submissions_book
  ON bookflow.publisher_submissions(book_id, submitted_at DESC);
ALTER TABLE bookflow.publisher_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Book owner can manage submissions" ON bookflow.publisher_submissions;
CREATE POLICY "Book owner can manage submissions" ON bookflow.publisher_submissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access submissions" ON bookflow.publisher_submissions;
CREATE POLICY "Service role full access submissions" ON bookflow.publisher_submissions
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL PRIVILEGES ON bookflow.publisher_submissions TO service_role, authenticated;


-- ============================================================================
-- 006: App settings (+ 008: deepgram key)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookflow.app_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL UNIQUE DEFAULT 'default',
  settings_data   JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS deepgram_api_key TEXT;
GRANT ALL PRIVILEGES ON bookflow.app_settings TO service_role, authenticated;


-- ============================================================================
-- 009: Make fileflow_file_id nullable on file_references
-- ============================================================================

ALTER TABLE bookflow.file_references
  ALTER COLUMN fileflow_file_id DROP NOT NULL;


-- ============================================================================
-- 007: Book clubs, club members, club books, discussions, settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookflow.book_clubs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  created_by      UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  visibility      TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  max_members     INTEGER DEFAULT 50,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookflow.club_members (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id            UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  role               TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by         UUID REFERENCES bookflow.profiles(id),
  invited_email      TEXT,
  invite_token       TEXT UNIQUE,
  invite_accepted_at TIMESTAMPTZ,
  joined_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_id, user_id),
  CONSTRAINT member_has_user_or_email CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS bookflow.club_books (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  book_id    UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  added_by   UUID NOT NULL REFERENCES bookflow.profiles(id),
  is_current BOOLEAN DEFAULT FALSE,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_id, book_id)
);

CREATE TABLE IF NOT EXISTS bookflow.club_discussions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  book_id    UUID REFERENCES bookflow.books(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  parent_id  UUID REFERENCES bookflow.club_discussions(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES bookflow.profiles(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookflow.club_settings (
  club_id                      UUID PRIMARY KEY REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  show_member_reading_progress BOOLEAN DEFAULT TRUE,
  show_member_answers          BOOLEAN DEFAULT FALSE,
  show_member_highlights       BOOLEAN DEFAULT TRUE,
  show_member_media            BOOLEAN DEFAULT TRUE,
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON bookflow.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON bookflow.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_invite_token ON bookflow.club_members(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_club_books_club_id ON bookflow.club_books(club_id);
CREATE INDEX IF NOT EXISTS idx_club_discussions_club_id ON bookflow.club_discussions(club_id);
CREATE INDEX IF NOT EXISTS idx_club_discussions_parent_id ON bookflow.club_discussions(parent_id);

GRANT ALL PRIVILEGES ON bookflow.book_clubs TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.club_members TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.club_books TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.club_discussions TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.club_settings TO service_role, authenticated;

ALTER TABLE bookflow.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.club_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.club_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.club_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View clubs" ON bookflow.book_clubs;
CREATE POLICY "View clubs" ON bookflow.book_clubs FOR SELECT USING (
  visibility = 'public' OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
);
DROP POLICY IF EXISTS "Create clubs" ON bookflow.book_clubs;
CREATE POLICY "Create clubs" ON bookflow.book_clubs FOR INSERT WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Owner updates club" ON bookflow.book_clubs;
CREATE POLICY "Owner updates club" ON bookflow.book_clubs FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
);
DROP POLICY IF EXISTS "Owner deletes club" ON bookflow.book_clubs;
CREATE POLICY "Owner deletes club" ON bookflow.book_clubs FOR DELETE USING (created_by = auth.uid());
DROP POLICY IF EXISTS "Service role bypass clubs" ON bookflow.book_clubs;
CREATE POLICY "Service role bypass clubs" ON bookflow.book_clubs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "View club members" ON bookflow.club_members;
CREATE POLICY "View club members" ON bookflow.club_members FOR SELECT USING (
  user_id = auth.uid()
  OR invited_email = (SELECT email FROM bookflow.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM bookflow.club_members m2 WHERE m2.club_id = club_id AND m2.user_id = auth.uid() AND m2.invite_accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Club admins manage members" ON bookflow.club_members;
CREATE POLICY "Club admins manage members" ON bookflow.club_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Member can leave or admin can remove" ON bookflow.club_members;
CREATE POLICY "Member can leave or admin can remove" ON bookflow.club_members FOR DELETE USING (
  user_id = auth.uid() OR invited_by = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
);
DROP POLICY IF EXISTS "Accept own invite" ON bookflow.club_members;
CREATE POLICY "Accept own invite" ON bookflow.club_members FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
);
DROP POLICY IF EXISTS "Service role bypass members" ON bookflow.club_members;
CREATE POLICY "Service role bypass members" ON bookflow.club_members FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members view club books" ON bookflow.club_books;
CREATE POLICY "Members view club books" ON bookflow.club_books FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Admins manage club books" ON bookflow.club_books;
CREATE POLICY "Admins manage club books" ON bookflow.club_books FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Admins remove club books" ON bookflow.club_books;
CREATE POLICY "Admins remove club books" ON bookflow.club_books FOR DELETE USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Service role bypass books" ON bookflow.club_books;
CREATE POLICY "Service role bypass books" ON bookflow.club_books FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members view discussions" ON bookflow.club_discussions;
CREATE POLICY "Members view discussions" ON bookflow.club_discussions FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Members post discussions" ON bookflow.club_discussions;
CREATE POLICY "Members post discussions" ON bookflow.club_discussions FOR INSERT WITH CHECK (
  author_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
  )
);
DROP POLICY IF EXISTS "Author edits own discussion" ON bookflow.club_discussions;
CREATE POLICY "Author edits own discussion" ON bookflow.club_discussions FOR UPDATE USING (author_id = auth.uid());
DROP POLICY IF EXISTS "Author or admin deletes discussion" ON bookflow.club_discussions;
CREATE POLICY "Author or admin deletes discussion" ON bookflow.club_discussions FOR DELETE USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
);
DROP POLICY IF EXISTS "Service role bypass discussions" ON bookflow.club_discussions;
CREATE POLICY "Service role bypass discussions" ON bookflow.club_discussions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members view club settings" ON bookflow.club_settings;
CREATE POLICY "Members view club settings" ON bookflow.club_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Admins update club settings" ON bookflow.club_settings;
CREATE POLICY "Admins update club settings" ON bookflow.club_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Service role bypass settings" ON bookflow.club_settings;
CREATE POLICY "Service role bypass settings" ON bookflow.club_settings FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- 010: response_visibility on inline_content + updated form_responses RLS
-- ============================================================================

ALTER TABLE bookflow.inline_content
  ADD COLUMN IF NOT EXISTS response_visibility TEXT DEFAULT 'private'
    CHECK (response_visibility IN ('private', 'members_only', 'all_readers'));

DROP POLICY IF EXISTS "form_responses_select" ON bookflow.form_responses;
CREATE POLICY "form_responses_select" ON bookflow.form_responses FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      JOIN bookflow.books b ON b.id = ic.book_id
      WHERE ic.id = inline_content_id AND b.author_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      WHERE ic.id = inline_content_id AND ic.response_visibility = 'all_readers'
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.inline_content ic
      JOIN bookflow.club_books cb ON cb.book_id = ic.book_id
      JOIN bookflow.club_members cm1 ON cm1.club_id = cb.club_id
        AND cm1.user_id = auth.uid() AND cm1.invite_accepted_at IS NOT NULL
      JOIN bookflow.club_members cm2 ON cm2.club_id = cb.club_id
        AND cm2.user_id = bookflow.form_responses.user_id AND cm2.invite_accepted_at IS NOT NULL
      WHERE ic.id = inline_content_id AND ic.response_visibility = 'members_only'
    )
  );


-- ============================================================================
-- 011: Club chat (settings, member prefs, messages, read receipts)
-- ============================================================================

ALTER TABLE bookflow.book_clubs
  ADD COLUMN IF NOT EXISTS chat_audio_fileflow_folder_id TEXT;

CREATE TABLE IF NOT EXISTS bookflow.club_chat_settings (
  club_id                   UUID PRIMARY KEY REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  chat_enabled              BOOLEAN NOT NULL DEFAULT true,
  allow_audio_messages      BOOLEAN NOT NULL DEFAULT true,
  allow_snippet_sharing     BOOLEAN NOT NULL DEFAULT true,
  weekly_status_updates     BOOLEAN NOT NULL DEFAULT true,
  chapter_completion_updates BOOLEAN NOT NULL DEFAULT true,
  show_answers_in_completion BOOLEAN NOT NULL DEFAULT true,
  weekly_cron_schedule      TEXT NOT NULL DEFAULT '0 9 * * 1',
  weekly_cron_label         TEXT NOT NULL DEFAULT 'Every Monday at 9:00 AM',
  default_notification_mode TEXT NOT NULL DEFAULT 'all'
                              CHECK (default_notification_mode IN ('all','mentions','none')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookflow.club_chat_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club members can read chat settings" ON bookflow.club_chat_settings;
CREATE POLICY "Club members can read chat settings" ON bookflow.club_chat_settings FOR SELECT
  USING (club_id IN (SELECT club_id FROM bookflow.club_members WHERE user_id = auth.uid() AND invite_accepted_at IS NOT NULL));
DROP POLICY IF EXISTS "Club admins can update chat settings" ON bookflow.club_chat_settings;
CREATE POLICY "Club admins can update chat settings" ON bookflow.club_chat_settings FOR UPDATE
  USING (club_id IN (SELECT club_id FROM bookflow.club_members WHERE user_id = auth.uid() AND role IN ('owner','admin') AND invite_accepted_at IS NOT NULL));
DROP POLICY IF EXISTS "Service role full access chat settings" ON bookflow.club_chat_settings;
CREATE POLICY "Service role full access chat settings" ON bookflow.club_chat_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, UPDATE ON bookflow.club_chat_settings TO authenticated;
GRANT ALL ON bookflow.club_chat_settings TO service_role;

CREATE TABLE IF NOT EXISTS bookflow.club_chat_member_prefs (
  club_id           UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  notification_mode TEXT NOT NULL DEFAULT 'inherit'
                      CHECK (notification_mode IN ('inherit','all','mentions','none')),
  PRIMARY KEY (club_id, user_id)
);
ALTER TABLE bookflow.club_chat_member_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage own chat prefs" ON bookflow.club_chat_member_prefs;
CREATE POLICY "Members manage own chat prefs" ON bookflow.club_chat_member_prefs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access chat prefs" ON bookflow.club_chat_member_prefs;
CREATE POLICY "Service role full access chat prefs" ON bookflow.club_chat_member_prefs FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.club_chat_member_prefs TO authenticated;
GRANT ALL ON bookflow.club_chat_member_prefs TO service_role;

CREATE TABLE IF NOT EXISTS bookflow.club_chat_messages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  book_id                UUID REFERENCES bookflow.books(id) ON DELETE SET NULL,
  sender_id              UUID REFERENCES bookflow.profiles(id) ON DELETE SET NULL,
  message_type           TEXT NOT NULL DEFAULT 'text'
                           CHECK (message_type IN ('text','audio','chapter_snippet','system_status')),
  body                   TEXT,
  audio_fileflow_file_id TEXT,
  audio_fileflow_url     TEXT,
  audio_url_refreshed_at TIMESTAMPTZ,
  audio_duration_seconds INTEGER,
  audio_mime_type        TEXT,
  snippet_chapter_id     UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  snippet_comment_id     UUID REFERENCES bookflow.book_comments(id) ON DELETE SET NULL,
  snippet_text           TEXT,
  snippet_offset_start   INTEGER,
  snippet_offset_end     INTEGER,
  status_payload         JSONB,
  reply_to_id            UUID REFERENCES bookflow.club_chat_messages(id) ON DELETE SET NULL,
  edited_at              TIMESTAMPTZ,
  deleted_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_club_chat_club_created ON bookflow.club_chat_messages(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_chat_sender ON bookflow.club_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_club_chat_snippet_chapter ON bookflow.club_chat_messages(snippet_chapter_id) WHERE snippet_chapter_id IS NOT NULL;

ALTER TABLE bookflow.club_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club members can read messages" ON bookflow.club_chat_messages;
CREATE POLICY "Club members can read messages" ON bookflow.club_chat_messages FOR SELECT
  USING (club_id IN (SELECT club_id FROM bookflow.club_members WHERE user_id = auth.uid() AND invite_accepted_at IS NOT NULL));
DROP POLICY IF EXISTS "Club members can insert messages" ON bookflow.club_chat_messages;
CREATE POLICY "Club members can insert messages" ON bookflow.club_chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND club_id IN (SELECT club_id FROM bookflow.club_members WHERE user_id = auth.uid() AND invite_accepted_at IS NOT NULL));
DROP POLICY IF EXISTS "Senders can update own messages" ON bookflow.club_chat_messages;
CREATE POLICY "Senders can update own messages" ON bookflow.club_chat_messages FOR UPDATE USING (sender_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access chat messages" ON bookflow.club_chat_messages;
CREATE POLICY "Service role full access chat messages" ON bookflow.club_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON bookflow.club_chat_messages TO authenticated;
GRANT ALL ON bookflow.club_chat_messages TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE bookflow.club_chat_messages;

CREATE TABLE IF NOT EXISTS bookflow.club_chat_read_receipts (
  club_id              UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES bookflow.club_chat_messages(id) ON DELETE SET NULL,
  last_read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);
ALTER TABLE bookflow.club_chat_read_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage own read receipts" ON bookflow.club_chat_read_receipts;
CREATE POLICY "Members manage own read receipts" ON bookflow.club_chat_read_receipts FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Service role full access read receipts" ON bookflow.club_chat_read_receipts;
CREATE POLICY "Service role full access read receipts" ON bookflow.club_chat_read_receipts FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON bookflow.club_chat_read_receipts TO authenticated;
GRANT ALL ON bookflow.club_chat_read_receipts TO service_role;

-- Extend user_notifications type check to include chat types
ALTER TABLE bookflow.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_type_check;
ALTER TABLE bookflow.user_notifications
  ADD CONSTRAINT user_notifications_type_check CHECK (type IN (
    'invite','comment','comment_reply','review_submitted',
    'review_approved','review_rejected','mention',
    'chat_message','chat_mention','status_update'
  ));

ALTER TABLE bookflow.user_notifications
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS chat_message_id UUID REFERENCES bookflow.club_chat_messages(id) ON DELETE CASCADE;

INSERT INTO bookflow.club_chat_settings (club_id)
SELECT id FROM bookflow.book_clubs
ON CONFLICT (club_id) DO NOTHING;

-- Final grants
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bookflow TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bookflow TO service_role;
