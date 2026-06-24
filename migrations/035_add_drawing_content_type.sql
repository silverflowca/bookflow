-- Migration 035: Add 'drawing' to inline_content content_type check constraint

ALTER TABLE bookflow.inline_content
  DROP CONSTRAINT inline_content_content_type_check;

ALTER TABLE bookflow.inline_content
  ADD CONSTRAINT inline_content_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'question', 'poll', 'highlight', 'note', 'link',
    'audio', 'video', 'select', 'multiselect', 'textbox',
    'textarea', 'radio', 'checkbox', 'code_block', 'scripture_block',
    'image', 'drawing'
  ]));
