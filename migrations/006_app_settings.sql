-- App settings per user (FileFlow integration key, etc.)
CREATE TABLE IF NOT EXISTS bookflow.app_settings (
  user_id           UUID PRIMARY KEY REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  fileflow_url      TEXT NOT NULL DEFAULT 'http://localhost:8680',
  fileflow_access_key TEXT NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL PRIVILEGES ON bookflow.app_settings TO service_role, authenticated;

ALTER TABLE bookflow.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own settings"
  ON bookflow.app_settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role bypass"
  ON bookflow.app_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
