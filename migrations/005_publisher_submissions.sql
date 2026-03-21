-- ============================================================================
-- BookFlow Migration 005: Publisher submission history
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookflow.publisher_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id        UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL CHECK (platform IN ('draft2digital', 'smashwords', 'manual')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'submitted', 'processing', 'published', 'failed', 'cancelled')),
  submission_id  TEXT,
  publisher_url  TEXT,
  submitted_by   UUID NOT NULL REFERENCES bookflow.profiles(id),
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  metadata       JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_publisher_submissions_book
  ON bookflow.publisher_submissions(book_id, submitted_at DESC);

-- RLS
ALTER TABLE bookflow.publisher_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Book owner can manage submissions" ON bookflow.publisher_submissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bookflow.books WHERE id = book_id AND author_id = auth.uid()));

CREATE POLICY "Service role full access submissions" ON bookflow.publisher_submissions
  TO service_role USING (true) WITH CHECK (true);

GRANT ALL PRIVILEGES ON bookflow.publisher_submissions TO service_role, authenticated;
