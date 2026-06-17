-- Migration 026: Add home_tagline to app_settings
-- Allows super admins to configure the homepage hero subtitle text

ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS home_tagline TEXT NOT NULL DEFAULT '';
