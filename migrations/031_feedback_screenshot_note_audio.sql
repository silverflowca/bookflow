-- ============================================================================
-- Migration 031: Add note + per-screenshot audio to feedback_screenshots
-- ============================================================================

SET search_path = bookflow, public;

ALTER TABLE bookflow.feedback_screenshots
  ADD COLUMN IF NOT EXISTS note                TEXT,
  ADD COLUMN IF NOT EXISTS screenshot_audio_path TEXT;  -- public URL in bookflow-feedback-audio bucket
