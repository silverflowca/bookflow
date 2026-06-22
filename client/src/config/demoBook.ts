/**
 * Demo Book Config
 * ─────────────────
 * The demo book ID is now managed via Admin → Settings → Feature Demo Settings.
 * Run `node server/seed-feature-demo.mjs` to create the demo book, then select
 * it from the Settings dropdown — no need to edit this file for the book ID.
 *
 * DEMO_BOOK_ID is kept here as a last-resort fallback only (unused by Home.tsx).
 * The chapter IDs below must be updated when the demo book is re-seeded.
 */

// Kept as reference only — book ID is loaded from app_settings via /api/settings/public
export const DEMO_BOOK_ID = '14760e3b-049a-4a1a-a524-a03c8c38d259';

// Map of feature ID → chapter ID in the demo book
export const DEMO_CHAPTER_IDS: Record<string, string> = {
  'rich-text':        '2a01afa4-f836-4c7c-a314-c380630831e1',
  'inline-questions': 'f0c5a2d9-b7d8-49fa-b1af-b6f129ded9e1',
  'polls':            'af2a28e8-1927-453e-91bc-cf6720e91819',
  'audio':            'af0fff0a-2dae-4b3d-957a-fad46c716edb',
  'video':            '77b8c80c-1de6-4603-91c1-3511849442a2',
  'images':           'b0c32dbe-f3a0-44aa-8d43-5a8768a7c6ee',
  'highlights':       'aa372a5e-11b2-4356-9374-b8772adb8a60',
  'progress':         '6d4432a1-0155-496c-ac38-e9e344e9c92c',
  'forms':            '6c504340-19e2-4c0c-aedb-909d962c44d2',
  'clubs':            'a2153e47-c4e6-4848-a5e2-36d68531907d',
  'collaborate':      'a546e3aa-2ef0-4cdf-bf3a-3104b3c0ee04',
  'publish':          '25d4ad6b-480c-4906-b9c5-2a1d504cfbc0',
};
