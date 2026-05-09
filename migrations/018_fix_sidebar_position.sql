-- Migration 018: Fix inline_content rows where position_in_chapter = 'sidebar'
-- 'sidebar' was incorrectly stored; these items should render inline
UPDATE bookflow.inline_content
SET position_in_chapter = 'inline'
WHERE position_in_chapter = 'sidebar';
