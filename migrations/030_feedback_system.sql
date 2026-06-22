-- ============================================================================
-- Migration 030: Feedback System
-- Schema: bookflow
-- Creates: feedback_config, feedback, feedback_screenshots,
--          feedback_audio, feedback_comments
-- ============================================================================

SET search_path = bookflow, public;

-- ── 1. Global feedback configuration (singleton row) ─────────────────────────
CREATE TABLE IF NOT EXISTS bookflow.feedback_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  -- { "disabled_user_ids": [...], "disabled_book_ids": [...], "disabled_club_ids": [...] }
  config      JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES bookflow.profiles(id) ON DELETE SET NULL
);

-- Ensure only one row ever exists
CREATE UNIQUE INDEX IF NOT EXISTS feedback_config_singleton
  ON bookflow.feedback_config ((TRUE));

-- Seed the default row
INSERT INTO bookflow.feedback_config (enabled)
VALUES (TRUE)
ON CONFLICT DO NOTHING;

-- ── 2. Main feedback records ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookflow.feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'question', 'comment')),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  page_url    TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx  ON bookflow.feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_status_idx   ON bookflow.feedback(status);
CREATE INDEX IF NOT EXISTS feedback_type_idx     ON bookflow.feedback(type);
CREATE INDEX IF NOT EXISTS feedback_created_idx  ON bookflow.feedback(created_at DESC);

-- ── 3. Screenshots ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookflow.feedback_screenshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id     UUID NOT NULL REFERENCES bookflow.feedback(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,  -- public URL in bookflow-feedback-screenshots bucket
  annotation_data JSONB NOT NULL DEFAULT '[]'::JSONB,  -- [{tool,color,points,...}]
  order_index     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_screenshots_fk_idx
  ON bookflow.feedback_screenshots(feedback_id);

-- ── 4. Audio recording (max one per feedback) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS bookflow.feedback_audio (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id      UUID NOT NULL REFERENCES bookflow.feedback(id) ON DELETE CASCADE,
  storage_path     TEXT NOT NULL,  -- public URL in bookflow-feedback-audio bucket
  duration_seconds NUMERIC(8, 2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS feedback_audio_one_per_feedback
  ON bookflow.feedback_audio(feedback_id);

-- ── 5. Discussion thread ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookflow.feedback_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES bookflow.feedback(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_comments_fk_idx
  ON bookflow.feedback_comments(feedback_id);

-- ── 6. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE bookflow.feedback_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.feedback            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.feedback_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.feedback_audio      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookflow.feedback_comments   ENABLE ROW LEVEL SECURITY;

-- Service role bypasses (server always uses service role key)
CREATE POLICY "service_role_all_feedback_config"
  ON bookflow.feedback_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_feedback"
  ON bookflow.feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_feedback_screenshots"
  ON bookflow.feedback_screenshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_feedback_audio"
  ON bookflow.feedback_audio FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_feedback_comments"
  ON bookflow.feedback_comments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users manage their own feedback rows
CREATE POLICY "users_own_feedback"
  ON bookflow.feedback FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can read screenshots/audio/comments for their own feedback
CREATE POLICY "users_read_own_feedback_screenshots"
  ON bookflow.feedback_screenshots FOR SELECT TO authenticated
  USING (feedback_id IN (
    SELECT id FROM bookflow.feedback WHERE user_id = auth.uid()
  ));

CREATE POLICY "users_read_own_feedback_audio"
  ON bookflow.feedback_audio FOR SELECT TO authenticated
  USING (feedback_id IN (
    SELECT id FROM bookflow.feedback WHERE user_id = auth.uid()
  ));

CREATE POLICY "users_read_own_feedback_comments"
  ON bookflow.feedback_comments FOR SELECT TO authenticated
  USING (feedback_id IN (
    SELECT id FROM bookflow.feedback WHERE user_id = auth.uid()
  ));
