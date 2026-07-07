-- Migration 037: E-Signature feature
-- Adds signature_responses table and updates inline_content content_type constraint

-- 1. Signature responses table
CREATE TABLE IF NOT EXISTS bookflow.signature_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inline_content_id UUID NOT NULL REFERENCES bookflow.inline_content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES bookflow.books(id) ON DELETE CASCADE,
  signer_name TEXT,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('drawn', 'typed', 'checkbox')),
  signature_data TEXT,
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inline_content_id, user_id)
);

-- 2. Update inline_content content_type check constraint to include 'signature'
ALTER TABLE bookflow.inline_content
  DROP CONSTRAINT IF EXISTS inline_content_content_type_check;

ALTER TABLE bookflow.inline_content
  ADD CONSTRAINT inline_content_content_type_check CHECK (
    content_type IN (
      'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
      'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
      'code_block', 'scripture_block', 'image', 'drawing', 'media_response', 'signature'
    )
  );

-- 3. Index for fast lookup by book
CREATE INDEX IF NOT EXISTS idx_signature_responses_book
  ON bookflow.signature_responses(book_id);

CREATE INDEX IF NOT EXISTS idx_signature_responses_content
  ON bookflow.signature_responses(inline_content_id);

-- 4. RLS
ALTER TABLE bookflow.signature_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own signatures"
  ON bookflow.signature_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Book authors see all signatures"
  ON bookflow.signature_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookflow.books
      WHERE id = book_id AND author_id = auth.uid()
    )
  );

CREATE POLICY "Collaborators see all signatures"
  ON bookflow.signature_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookflow.book_collaborators
      WHERE book_id = signature_responses.book_id
        AND user_id = auth.uid()
        AND invite_accepted_at IS NOT NULL
        AND role IN ('author', 'editor', 'reviewer')
    )
  );

CREATE POLICY "Users insert own signatures"
  ON bookflow.signature_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own signatures"
  ON bookflow.signature_responses FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION bookflow.update_signature_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = OLD.created_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
