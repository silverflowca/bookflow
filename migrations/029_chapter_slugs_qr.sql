-- ============================================================
-- BookFlow Migration 029: Chapter Slugs + QR Code Settings
-- ============================================================

-- Add slug to chapters (unique within a book)
ALTER TABLE bookflow.chapters
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chapters_book_slug
  ON bookflow.chapters(book_id, slug);

-- Add enable_chapter_qr_codes setting to book_settings
ALTER TABLE bookflow.book_settings
  ADD COLUMN IF NOT EXISTS enable_chapter_qr_codes BOOLEAN DEFAULT TRUE;

-- Back-fill slugs for existing published chapters from their title
UPDATE bookflow.chapters
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9\s\-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL AND title IS NOT NULL AND status = 'published';
