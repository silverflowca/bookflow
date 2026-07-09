-- Migration 040: Add enable_insert_panel to profiles
-- Controls whether the right-click "Insert Component" panel is shown in the chapter editor.
-- Disabled by default so authors must opt in.

ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS enable_insert_panel BOOLEAN NOT NULL DEFAULT FALSE;