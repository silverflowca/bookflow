/**
 * Demo Book Config
 * ─────────────────
 * The demo book ID is managed via Admin → Settings → Feature Demo Settings.
 * Run `node server/seed-feature-demo.mjs` to create the demo book, then select
 * it from the Settings dropdown.
 *
 * IMPORTANT: Chapter IDs are loaded dynamically from the API at runtime.
 * The DEMO_CHAPTER_IDS below are only used as a last-resort offline fallback.
 * They must match the currently seeded demo book (DEMO_BOOK_ID).
 */

export const DEMO_BOOK_ID = '12bca78b-55e0-455a-8a40-5bd474fe4cee';

/** Feature ID → order index (0-based). Stable regardless of which book is seeded. */
export const FEATURE_ORDER: Record<string, number> = {
  'rich-text':        0,
  'inline-questions': 1,
  'polls':            2,
  'audio':            3,
  'video':            4,
  'images':           5,
  'highlights':       6,
  'progress':         7,
  'forms':            8,
  'clubs':            9,
  'collaborate':      10,
  'publish':          11,
};

// Fallback only — overridden at runtime by chapters fetched from the API
export const DEMO_CHAPTER_IDS: Record<string, string> = {
  'rich-text':        '3f515139-0066-479a-884d-2f7de4b6807e',
  'inline-questions': 'eb56563e-654b-4040-a03f-6cef6ca42c06',
  'polls':            '384beba4-7183-414f-8d29-f7f59be3ec14',
  'audio':            '2ca4be46-c6fc-4a68-a004-8adf29f7b50e',
  'video':            '8a28f565-4fa5-4302-8d87-3f579150a506',
  'images':           '57ff96cb-be56-47b4-a627-eca9b7cb2a74',
  'highlights':       '71d80cdc-cf94-44af-883d-eae1393cbb08',
  'progress':         '9b86b948-d958-4479-b98f-e04b6a4810b0',
  'forms':            '35b76b09-e874-4e87-80fb-2f0e861aef95',
  'clubs':            '2e0b1860-b34a-49b5-8239-44c7c253f4b1',
  'collaborate':      'd347c6ec-056c-489f-9fe2-93cd25724275',
  'publish':          'b8269414-ba91-47de-a037-abd9c46f8add',
};
