-- Migration 045: Add FK from book_collaborators to bookflow.profiles
-- PostgREST needs FKs pointing to bookflow.profiles (not auth.users) to resolve joins.
-- The existing FKs reference auth.users; we add new ones to profiles so the
-- !book_collaborators_user_id_fkey hint in the select query works.

ALTER TABLE bookflow.book_collaborators
  DROP CONSTRAINT IF EXISTS book_collaborators_user_id_fkey,
  DROP CONSTRAINT IF EXISTS book_collaborators_invited_by_fkey;

ALTER TABLE bookflow.book_collaborators
  ADD CONSTRAINT book_collaborators_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT book_collaborators_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES bookflow.profiles(id) ON DELETE CASCADE;
