-- ============================================================
-- Migration 050: Link assignments (prompts) to sessions
-- Adds session_id FK to class_submission_prompts so that
-- assignments can be associated with a specific class session.
-- Multiple assignments can be linked to one session.
-- ============================================================

SET search_path TO bookflow, public;

ALTER TABLE bookflow.class_submission_prompts
  ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES bookflow.class_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_prompts_session
  ON bookflow.class_submission_prompts(session_id)
  WHERE session_id IS NOT NULL;
