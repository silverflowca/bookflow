-- Migration 036: Add auto_play_media to book_settings

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS auto_play_media BOOLEAN DEFAULT FALSE;
