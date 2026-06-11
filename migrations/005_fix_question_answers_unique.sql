-- Fix: add missing unique constraint on question_answers so upsert works correctly
ALTER TABLE bookflow.question_answers
  ADD CONSTRAINT question_answers_inline_content_user_unique
  UNIQUE (inline_content_id, user_id);
