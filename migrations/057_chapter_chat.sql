-- Migration 057: Chapter Chat
-- Adds chapter_id to club_chat_messages so messages can be scoped to a chapter.
-- Adds enable_chapter_chat to book_settings so authors can toggle the feature.

-- 1. Add chapter_id column to club_chat_messages
ALTER TABLE bookflow.club_chat_messages
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL;

-- Index for fast chapter-scoped queries
CREATE INDEX IF NOT EXISTS idx_club_chat_messages_chapter_id
  ON bookflow.club_chat_messages(chapter_id)
  WHERE chapter_id IS NOT NULL;

-- 2. Add enable_chapter_chat toggle to book_settings
ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS enable_chapter_chat BOOLEAN DEFAULT false;
