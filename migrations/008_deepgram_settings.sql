-- Add Deepgram API key to app_settings
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS deepgram_api_key TEXT NOT NULL DEFAULT '';
