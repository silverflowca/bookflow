-- Migration 034: Add club_type to book_clubs
-- Distinguishes 'club' (casual reading community) from 'study_group' (structured program)

ALTER TABLE bookflow.book_clubs
  ADD COLUMN IF NOT EXISTS club_type TEXT NOT NULL DEFAULT 'club'
  CHECK (club_type IN ('club', 'study_group'));

-- Back-fill any existing rows (all existing clubs remain 'club')
UPDATE bookflow.book_clubs SET club_type = 'club' WHERE club_type IS NULL;

-- Index for fast type-filtered queries
CREATE INDEX IF NOT EXISTS idx_book_clubs_type ON bookflow.book_clubs(club_type);
