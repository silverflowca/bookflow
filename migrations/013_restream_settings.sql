-- Add Restream API key to app_settings (per-user)
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS restream_api_key TEXT NOT NULL DEFAULT '';
