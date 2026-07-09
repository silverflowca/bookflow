-- Migration 042: Add Resend API key to app_settings
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT NOT NULL DEFAULT '';
