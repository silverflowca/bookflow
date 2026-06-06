-- Migration 019: Add allow_public_tts to book_settings
-- Controls whether the Listen (TTS) button is shown to unauthenticated readers

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS allow_public_tts BOOLEAN NOT NULL DEFAULT false;
