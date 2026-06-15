-- ============================================================
-- Club Join Requests
-- Adds allow_join_requests toggle + is_join_request flag
-- ============================================================

-- Allow admins to toggle whether public-club members can request to join
ALTER TABLE bookflow.club_settings
  ADD COLUMN IF NOT EXISTS allow_join_requests BOOLEAN DEFAULT FALSE;

-- Mark a club_members row as a self-submitted join request (vs admin invite)
ALTER TABLE bookflow.club_members
  ADD COLUMN IF NOT EXISTS is_join_request BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS join_request_message TEXT;

-- Index for quick lookup of pending join requests per club
CREATE INDEX IF NOT EXISTS idx_club_members_join_request
  ON bookflow.club_members(club_id, is_join_request)
  WHERE is_join_request = TRUE AND invite_accepted_at IS NULL;
