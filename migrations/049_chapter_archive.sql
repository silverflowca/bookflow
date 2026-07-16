-- ============================================================
-- Migration 049: Soft-delete (archive) for chapters
-- Extends chapters.status to allow 'archived' value.
-- Archived chapters are hidden from the UI but stay in the DB.
-- ============================================================

SET search_path TO bookflow, public;

ALTER TABLE bookflow.chapters
  DROP CONSTRAINT IF EXISTS chapters_status_check;

ALTER TABLE bookflow.chapters
  ADD CONSTRAINT chapters_status_check
  CHECK (status IN ('draft', 'published', 'archived'));
