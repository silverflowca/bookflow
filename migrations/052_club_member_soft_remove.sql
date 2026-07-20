-- Migration 052: Soft remove for club members
--
-- Instead of deleting a member row (which loses no data since all progress/
-- submissions reference user_id directly), we mark removed_at.
--
-- Removed members:
--   - Lose access to the club/class content (treated as not-a-member for auth)
--   - Can no longer post new comments or submissions
--   - Still see teacher responses/feedback already left on their work
--   - Their statistics remain intact and visible to the teacher
--
-- Re-adding a removed member: just clear removed_at — all data persists.

ALTER TABLE bookflow.club_members
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES bookflow.profiles(id) DEFAULT NULL;

-- Index for fast filtering of active vs removed members
CREATE INDEX IF NOT EXISTS idx_club_members_removed_at
  ON bookflow.club_members (club_id, removed_at)
  WHERE removed_at IS NULL;

COMMENT ON COLUMN bookflow.club_members.removed_at IS
  'When set, the member has been removed. Row is preserved for data continuity. Clear to restore access.';
COMMENT ON COLUMN bookflow.club_members.removed_by IS
  'Who performed the removal (teacher/admin user_id).';
