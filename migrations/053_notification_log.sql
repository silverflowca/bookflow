-- Migration 053: Notification send log + notification config columns

-- ── Notification send log ────────────────────────────────────────────────────
-- Records every in-app + email notification dispatched by the system.
CREATE TABLE IF NOT EXISTS bookflow.notification_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES bookflow.profiles(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  -- email delivery info
  email_to     TEXT,
  email_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  email_error  TEXT,
  -- context references
  book_id      UUID,
  club_id      UUID,
  -- metadata
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_created
  ON bookflow.notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_type
  ON bookflow.notification_log(type);
CREATE INDEX IF NOT EXISTS idx_notification_log_user
  ON bookflow.notification_log(user_id);

ALTER TABLE bookflow.notification_log ENABLE ROW LEVEL SECURITY;

-- Super admins (via service_role) can read all; users cannot read this table directly
CREATE POLICY "service_role_full_access_notification_log"
  ON bookflow.notification_log TO service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON bookflow.notification_log TO service_role;

-- ── Notification config columns on app_settings ──────────────────────────────
-- Per-type enable/disable flags stored as JSONB
ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS notification_type_config JSONB NOT NULL DEFAULT '{}'::jsonb;
