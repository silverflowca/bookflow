-- ============================================================================
-- Migration 048: Custom Registration Form for Clubs / Study Groups / Classes
-- ============================================================================

SET search_path = bookflow, public;

-- 1. Extend club_settings with registration columns
ALTER TABLE bookflow.club_settings
  ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_fields JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS registration_bg_url TEXT,
  ADD COLUMN IF NOT EXISTS welcome_heading TEXT DEFAULT 'Welcome!',
  ADD COLUMN IF NOT EXISTS welcome_body TEXT,
  ADD COLUMN IF NOT EXISTS welcome_cta_label TEXT DEFAULT 'Go to Class';

-- 2. New table: club_member_responses — stores submitted form answers per member
CREATE TABLE IF NOT EXISTS bookflow.club_member_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_member_responses_club ON bookflow.club_member_responses(club_id);
CREATE INDEX IF NOT EXISTS idx_club_member_responses_user ON bookflow.club_member_responses(user_id);

ALTER TABLE bookflow.club_member_responses ENABLE ROW LEVEL SECURITY;

-- User sees their own responses
DROP POLICY IF EXISTS "member_sees_own_responses" ON bookflow.club_member_responses;
CREATE POLICY "member_sees_own_responses" ON bookflow.club_member_responses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin/teacher sees all responses in their club
DROP POLICY IF EXISTS "admin_sees_club_responses" ON bookflow.club_member_responses;
CREATE POLICY "admin_sees_club_responses" ON bookflow.club_member_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookflow.club_members
      WHERE club_id = club_member_responses.club_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'teacher')
        AND invite_accepted_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM bookflow.book_clubs
      WHERE id = club_member_responses.club_id
        AND created_by = auth.uid()
    )
  );

-- Members can insert their own response
DROP POLICY IF EXISTS "member_inserts_own_response" ON bookflow.club_member_responses;
CREATE POLICY "member_inserts_own_response" ON bookflow.club_member_responses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "service_role_full_access_responses" ON bookflow.club_member_responses;
CREATE POLICY "service_role_full_access_responses" ON bookflow.club_member_responses
  TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON bookflow.club_member_responses TO service_role, authenticated;
