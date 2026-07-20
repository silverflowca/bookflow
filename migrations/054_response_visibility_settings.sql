-- Migration 054: Per-club response visibility settings
--
-- allow_students_set_visibility:
--   When true, students see a "Share with classmates" toggle on each of their
--   responses. Their choice is stored per-response in form_responses.visibility.
--   Defaults to false — responses are private unless teacher enables this.
--
-- responses_visible_to_all:
--   When true, ALL member responses are visible to all classmates regardless
--   of individual per-response visibility settings. Teacher-forced open sharing.
--   Defaults to false.

ALTER TABLE bookflow.club_settings
  ADD COLUMN IF NOT EXISTS allow_students_set_visibility BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS responses_visible_to_all      BOOLEAN NOT NULL DEFAULT FALSE;
