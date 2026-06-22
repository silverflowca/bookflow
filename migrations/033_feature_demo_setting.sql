-- Migration 033: Feature Demo Book setting
-- Adds feature_demo_book_id to app_settings so admins can pick the home-page demo book
-- from the Settings panel rather than hard-coding it in client config.

ALTER TABLE bookflow.app_settings
  ADD COLUMN IF NOT EXISTS feature_demo_book_id UUID REFERENCES bookflow.books(id) ON DELETE SET NULL;
