-- Migration 041: Add notification_prefs to profiles
-- Per-user opt-out map for email notifications.
-- Structure: { "comment": false, "chat_message": false }
-- Absence of a key means opted IN (default behaviour).

ALTER TABLE bookflow.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}';
