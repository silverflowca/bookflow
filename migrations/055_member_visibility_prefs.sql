-- Migration 055: Per-member, per-club response sharing preference
--
-- Stores each student's opt-in decision to share their responses with
-- classmates within a specific club/class/study group.
-- Only meaningful when club_settings.allow_students_set_visibility = true.

CREATE TABLE IF NOT EXISTS bookflow.club_member_visibility_prefs (
  club_id       UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  share_responses BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

ALTER TABLE bookflow.club_member_visibility_prefs ENABLE ROW LEVEL SECURITY;

-- Member can read/write their own pref
CREATE POLICY "member_own_pref" ON bookflow.club_member_visibility_prefs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Teachers/admins/owners can read all prefs in their club
CREATE POLICY "teacher_read_club_prefs" ON bookflow.club_member_visibility_prefs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookflow.club_members cm
      WHERE cm.club_id = club_member_visibility_prefs.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'teacher')
        AND cm.invite_accepted_at IS NOT NULL
    )
  );

-- Service role full access
CREATE POLICY "service_role_full" ON bookflow.club_member_visibility_prefs
  TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON bookflow.club_member_visibility_prefs TO service_role, authenticated;
