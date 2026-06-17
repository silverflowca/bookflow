-- Migration 025: Add show_component_panel setting to book_settings
-- Default false: clicking a component icon scrolls to it without opening the right panel

ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS show_component_panel BOOLEAN NOT NULL DEFAULT false;
