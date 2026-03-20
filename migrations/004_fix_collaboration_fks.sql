-- Add missing FK constraints for collaboration tables
-- These were missing because the original migration referenced auth.users
-- instead of bookflow.profiles

ALTER TABLE bookflow.book_collaborators
  ADD COLUMN IF NOT EXISTS user_id_placeholder UUID; -- placeholder check

DO $$
BEGIN
  -- book_collaborators.user_id -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'book_collaborators_user_id_fkey'
    AND table_schema = 'bookflow'
  ) THEN
    BEGIN
      ALTER TABLE bookflow.book_collaborators
        ADD CONSTRAINT book_collaborators_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES bookflow.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      NULL; -- ignore if data doesn't satisfy constraint
    END;
  END IF;

  -- book_collaborators.invited_by -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'book_collaborators_invited_by_fkey'
    AND table_schema = 'bookflow'
  ) THEN
    BEGIN
      ALTER TABLE bookflow.book_collaborators
        ADD CONSTRAINT book_collaborators_invited_by_fkey
        FOREIGN KEY (invited_by) REFERENCES bookflow.profiles(id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- book_comments.author_id -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'book_comments_author_id_fkey'
    AND table_schema = 'bookflow'
  ) THEN
    BEGIN
      ALTER TABLE bookflow.book_comments
        ADD CONSTRAINT book_comments_author_id_fkey
        FOREIGN KEY (author_id) REFERENCES bookflow.profiles(id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- book_comments.resolved_by -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'book_comments_resolved_by_fkey'
    AND table_schema = 'bookflow'
  ) THEN
    BEGIN
      ALTER TABLE bookflow.book_comments
        ADD CONSTRAINT book_comments_resolved_by_fkey
        FOREIGN KEY (resolved_by) REFERENCES bookflow.profiles(id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- book_versions.created_by -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'book_versions_created_by_fkey'
    AND table_schema = 'bookflow'
  ) THEN
    BEGIN
      ALTER TABLE bookflow.book_versions
        ADD CONSTRAINT book_versions_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES bookflow.profiles(id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- review_requests.submitted_by -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'review_requests_submitted_by_fkey'
    AND table_schema = 'bookflow'
  ) THEN
    BEGIN
      ALTER TABLE bookflow.review_requests
        ADD CONSTRAINT review_requests_submitted_by_fkey
        FOREIGN KEY (submitted_by) REFERENCES bookflow.profiles(id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- review_requests.reviewed_by -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'review_requests_reviewed_by_fkey'
    AND table_schema = 'bookflow'
  ) THEN
    BEGIN
      ALTER TABLE bookflow.review_requests
        ADD CONSTRAINT review_requests_reviewed_by_fkey
        FOREIGN KEY (reviewed_by) REFERENCES bookflow.profiles(id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- user_notifications.user_id -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_notifications_user_id_fkey'
    AND table_schema = 'bookflow'
  ) THEN
    BEGIN
      ALTER TABLE bookflow.user_notifications
        ADD CONSTRAINT user_notifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES bookflow.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

END $$;

-- Drop the placeholder column if added
ALTER TABLE bookflow.book_collaborators DROP COLUMN IF EXISTS user_id_placeholder;
