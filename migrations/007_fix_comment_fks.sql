-- Fix book_comments FK constraints to point to bookflow.profiles instead of auth.users
-- This enables PostgREST relationship joins and fixes schema cache errors
-- Safe to run multiple times

DO $$
BEGIN
  -- Drop old FK to auth.users for author_id (if it exists pointing to auth.users)
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class r ON r.oid = c.confrelid
    JOIN pg_namespace rn ON rn.oid = r.relnamespace
    WHERE c.conname = 'book_comments_author_id_fkey'
    AND n.nspname = 'bookflow'
    AND rn.nspname = 'auth'
  ) THEN
    ALTER TABLE bookflow.book_comments DROP CONSTRAINT book_comments_author_id_fkey;
  END IF;

  -- Add FK to bookflow.profiles for author_id (if not already there)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'book_comments_author_id_fkey'
    AND n.nspname = 'bookflow'
  ) THEN
    ALTER TABLE bookflow.book_comments
      ADD CONSTRAINT book_comments_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES bookflow.profiles(id);
  END IF;

  -- Drop old FK to auth.users for resolved_by (if it exists pointing to auth.users)
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class r ON r.oid = c.confrelid
    JOIN pg_namespace rn ON rn.oid = r.relnamespace
    WHERE c.conname = 'book_comments_resolved_by_fkey'
    AND n.nspname = 'bookflow'
    AND rn.nspname = 'auth'
  ) THEN
    ALTER TABLE bookflow.book_comments DROP CONSTRAINT book_comments_resolved_by_fkey;
  END IF;

  -- Add FK to bookflow.profiles for resolved_by (if not already there)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'book_comments_resolved_by_fkey'
    AND n.nspname = 'bookflow'
  ) THEN
    ALTER TABLE bookflow.book_comments
      ADD CONSTRAINT book_comments_resolved_by_fkey
      FOREIGN KEY (resolved_by) REFERENCES bookflow.profiles(id);
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
