-- Replace restream_api_key with full OAuth credentials per user
ALTER TABLE bookflow.app_settings
  DROP COLUMN IF EXISTS restream_api_key,
  ADD COLUMN IF NOT EXISTS restream_client_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restream_client_secret TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restream_access_token TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restream_refresh_token TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restream_token_expires_at TIMESTAMPTZ;
