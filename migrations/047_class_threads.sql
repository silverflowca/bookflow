-- ============================================================
-- 047_class_threads.sql
-- Teacher ↔ student dialogue on Q&A responses + 1:1 DMs
-- ============================================================

SET search_path TO bookflow, public;

-- ── 1. Response comments (dialogue on individual Q&A answers) ──────────────
CREATE TABLE IF NOT EXISTS bookflow.class_response_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  response_id   UUID NOT NULL REFERENCES bookflow.form_responses(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_class_response_comments_response ON bookflow.class_response_comments(response_id);
CREATE INDEX IF NOT EXISTS idx_class_response_comments_club ON bookflow.class_response_comments(club_id);

-- ── 2. 1:1 direct messages (teacher ↔ student private sessions) ────────────
CREATE TABLE IF NOT EXISTS bookflow.class_direct_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  -- Always ordered so user_a < user_b (alphabetically by UUID) to create a stable pair key
  user_a        UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  user_b        UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_class_dm_club ON bookflow.class_direct_messages(club_id);
CREATE INDEX IF NOT EXISTS idx_class_dm_pair ON bookflow.class_direct_messages(club_id, user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_class_dm_author ON bookflow.class_direct_messages(author_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE bookflow.class_response_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.class_direct_messages   ENABLE ROW LEVEL SECURITY;

-- response comments: club members can see/post comments on responses within their club
CREATE POLICY "class_response_comments_select" ON bookflow.class_response_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookflow.club_members cm
      WHERE cm.club_id = class_response_comments.club_id
        AND cm.user_id = auth.uid()
        AND cm.invite_accepted_at IS NOT NULL
    )
  );

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

CREATE POLICY "class_response_comments_delete" ON bookflow.class_response_comments
  FOR DELETE USING (author_id = auth.uid());

-- DMs: only the two participants can see their messages
CREATE POLICY "class_dm_select" ON bookflow.class_direct_messages
  FOR SELECT USING (user_a = auth.uid() OR user_b = auth.uid());

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

GRANT ALL ON bookflow.class_response_comments TO service_role, authenticated;
GRANT ALL ON bookflow.class_direct_messages   TO service_role, authenticated;
