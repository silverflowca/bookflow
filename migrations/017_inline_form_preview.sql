-- Migration 017: Add show_inline_form_preview to book_settings
-- Adds a configurable flag to show/hide the inline form preview strip below the chapter editor

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS show_inline_form_preview BOOLEAN NOT NULL DEFAULT TRUE;
