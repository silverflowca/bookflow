-- Migration 021: Image component + order_index for inline content reordering

-- 1. Add 'image' to the content_type CHECK constraint
ALTER TABLE bookflow.inline_content
  DROP CONSTRAINT IF EXISTS inline_content_content_type_check;

ALTER TABLE bookflow.inline_content
  ADD CONSTRAINT inline_content_content_type_check
  CHECK (content_type IN (
    'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
    'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
    'code_block', 'scripture_block', 'image'
  ));

-- 2. Add order_index for manual reordering within a position zone
ALTER TABLE bookflow.inline_content
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

-- Back-fill order_index using existing start_offset ordering
UPDATE bookflow.inline_content ic
SET order_index = sub.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY chapter_id, position_in_chapter
           ORDER BY start_offset, created_at
         ) - 1 AS rn
  FROM bookflow.inline_content
) sub
WHERE ic.id = sub.id;

CREATE INDEX IF NOT EXISTS idx_inline_content_order
  ON bookflow.inline_content(chapter_id, position_in_chapter, order_index);
