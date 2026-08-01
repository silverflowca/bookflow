-- Migration 056: Add html_block to inline_content content_type check constraint
-- Allows storing raw HTML documents/snippets as inline content blocks

-- Drop and recreate the check constraint to include 'html_block'
ALTER TABLE bookflow.inline_content
  DROP CONSTRAINT IF EXISTS inline_content_content_type_check;

ALTER TABLE bookflow.inline_content
  ADD CONSTRAINT inline_content_content_type_check
  CHECK (content_type IN (
    'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
    'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
    'code_block', 'scripture_block', 'image', 'drawing', 'media_response',
    'signature', 'html_block', 'esignature'
  ));
