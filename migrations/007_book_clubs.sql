-- ============================================================
-- Book Clubs
-- ============================================================

-- Main club record
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

-- Club members (includes owner)
CREATE TABLE IF NOT EXISTS bookflow.club_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by      UUID REFERENCES bookflow.profiles(id),
  invited_email   TEXT,
  invite_token    TEXT UNIQUE,
  invite_accepted_at TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_id, user_id),
  CONSTRAINT member_has_user_or_email CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

-- Books added to a club (club reading list)
CREATE TABLE IF NOT EXISTS bookflow.club_books (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  book_id         UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  added_by        UUID NOT NULL REFERENCES bookflow.profiles(id),
  is_current      BOOLEAN DEFAULT FALSE,  -- the active book being read now
  added_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_id, book_id)
);

-- Club discussions (top-level posts + threaded replies)
CREATE TABLE IF NOT EXISTS bookflow.club_discussions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  book_id         UUID REFERENCES bookflow.books(id) ON DELETE SET NULL,
  chapter_id      UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES bookflow.club_discussions(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES bookflow.profiles(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Club settings (visibility toggles per club)
CREATE TABLE IF NOT EXISTS bookflow.club_settings (
  club_id                     UUID PRIMARY KEY REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  show_member_reading_progress BOOLEAN DEFAULT TRUE,
  show_member_answers         BOOLEAN DEFAULT FALSE,  -- whether to reveal others' Q&A answers
  show_member_highlights      BOOLEAN DEFAULT TRUE,
  show_member_media           BOOLEAN DEFAULT TRUE,   -- audio/video inline content from members
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON bookflow.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON bookflow.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_invite_token ON bookflow.club_members(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_club_books_club_id ON bookflow.club_books(club_id);
CREATE INDEX IF NOT EXISTS idx_club_discussions_club_id ON bookflow.club_discussions(club_id);
CREATE INDEX IF NOT EXISTS idx_club_discussions_parent_id ON bookflow.club_discussions(parent_id);

-- ============================================================
-- Permissions
-- ============================================================
GRANT ALL PRIVILEGES ON bookflow.book_clubs TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.club_members TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.club_books TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.club_discussions TO service_role, authenticated;
GRANT ALL PRIVILEGES ON bookflow.club_settings TO service_role, authenticated;

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE bookflow.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.club_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.club_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.club_settings ENABLE ROW LEVEL SECURITY;

-- book_clubs: public clubs visible to all; private clubs visible to members
CREATE POLICY "View clubs" ON bookflow.book_clubs FOR SELECT USING (
  visibility = 'public'
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
);
CREATE POLICY "Create clubs" ON bookflow.book_clubs FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner updates club" ON bookflow.book_clubs FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
);
CREATE POLICY "Owner deletes club" ON bookflow.book_clubs FOR DELETE USING (created_by = auth.uid());
CREATE POLICY "Service role bypass clubs" ON bookflow.book_clubs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- club_members: members can see who else is in their club
CREATE POLICY "View club members" ON bookflow.club_members FOR SELECT USING (
  user_id = auth.uid()
  OR invited_email = (SELECT email FROM bookflow.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM bookflow.club_members m2 WHERE m2.club_id = club_id AND m2.user_id = auth.uid() AND m2.invite_accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
CREATE POLICY "Club admins manage members" ON bookflow.club_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
CREATE POLICY "Member can leave or admin can remove" ON bookflow.club_members FOR DELETE USING (
  user_id = auth.uid()
  OR invited_by = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
);
CREATE POLICY "Accept own invite" ON bookflow.club_members FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
);
CREATE POLICY "Service role bypass members" ON bookflow.club_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- club_books: members can view; admins can add/remove
CREATE POLICY "Members view club books" ON bookflow.club_books FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
CREATE POLICY "Admins manage club books" ON bookflow.club_books FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
CREATE POLICY "Admins remove club books" ON bookflow.club_books FOR DELETE USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
CREATE POLICY "Service role bypass books" ON bookflow.club_books FOR ALL TO service_role USING (true) WITH CHECK (true);

-- club_discussions: members can read and post
CREATE POLICY "Members view discussions" ON bookflow.club_discussions FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
CREATE POLICY "Members post discussions" ON bookflow.club_discussions FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
  )
);
CREATE POLICY "Author edits own discussion" ON bookflow.club_discussions FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Author or admin deletes discussion" ON bookflow.club_discussions FOR DELETE USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
);
CREATE POLICY "Service role bypass discussions" ON bookflow.club_discussions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- club_settings
CREATE POLICY "Members view club settings" ON bookflow.club_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.invite_accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
CREATE POLICY "Admins update club settings" ON bookflow.club_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM bookflow.club_members m WHERE m.club_id = club_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
  OR EXISTS (SELECT 1 FROM bookflow.book_clubs c WHERE c.id = club_id AND c.created_by = auth.uid())
);
CREATE POLICY "Service role bypass settings" ON bookflow.club_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Extend notifications for club events
-- ============================================================
-- The existing user_notifications table already supports arbitrary types;
-- we'll use: 'club_invite', 'club_discussion', 'club_discussion_reply'
-- No schema change needed — the type column is TEXT with no CHECK constraint in the original migration.
