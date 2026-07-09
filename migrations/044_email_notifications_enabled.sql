-- Migration 044: Add system-level email notifications master toggle to app_settings
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
