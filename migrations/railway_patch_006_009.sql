-- ============================================================================
-- BookFlow Railway Patch: migrations 006 through 009
-- Run this in Supabase SQL Editor (Railway / production) if the full
-- migration was applied before these were added.
-- Safe to run multiple times (idempotent).
-- ============================================================================

-- 006: App settings per user
CREATE TABLE IF NOT EXISTS bookflow.app_settings (
  user_id             UUID PRIMARY KEY REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  fileflow_url        TEXT NOT NULL DEFAULT 'http://localhost:8680',
  fileflow_access_key TEXT NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL PRIVILEGES ON bookflow.app_settings TO service_role, authenticated;

ALTER TABLE bookflow.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='bookflow'
      AND tablename='app_settings' AND policyname='Users manage their own settings'
  ) THEN
    CREATE POLICY "Users manage their own settings"
      ON bookflow.app_settings FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='bookflow'
      AND tablename='app_settings' AND policyname='Service role bypass'
  ) THEN
    CREATE POLICY "Service role bypass"
      ON bookflow.app_settings FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 008: Add Deepgram API key to app_settings
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS deepgram_api_key TEXT NOT NULL DEFAULT '';

-- 009: Make fileflow_file_id nullable (supports Supabase Storage uploads)
ALTER TABLE bookflow.file_references
  ALTER COLUMN fileflow_file_id DROP NOT NULL;
