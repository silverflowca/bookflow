-- Migration 034: API Keys + Book Import tracking
-- Enables machine-to-machine access via X-API-Key header
-- and tracks books created via the /api/import/books endpoint.

-- ── API Keys ──────────────────────────────────────────────────────────────────
-- Stores hashed API keys per user. Raw keys are shown once at creation time
-- and never stored. sha256(raw_key) is stored here.
CREATE TABLE IF NOT EXISTS bookflow.api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  key_hash     TEXT        NOT NULL UNIQUE,  -- sha256 hex of the raw key
  name         TEXT        NOT NULL,         -- human label e.g. "n8n integration"
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON bookflow.api_keys(user_id);

-- ── Book Import Tracking ───────────────────────────────────────────────────────
-- Maps caller-supplied external_id → book_id for idempotent upserts.
CREATE TABLE IF NOT EXISTS bookflow.api_book_imports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  external_id TEXT        NOT NULL,
  book_id     UUID        NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, external_id)
);

CREATE INDEX IF NOT EXISTS api_book_imports_user_id_idx ON bookflow.api_book_imports(user_id);
