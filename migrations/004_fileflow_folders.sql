-- ============================================================================
-- BookFlow Migration 004: FileFlow folder references per book
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
