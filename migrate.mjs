#!/usr/bin/env node
/**
 * BookFlow Migration Runner
 * Uses the Supabase Management API — no DB password needed.
 *
 * USAGE:
 *   node migrate.mjs                           — run all pending
 *   node migrate.mjs 029_chapter_slugs_qr.sql  — run one file
 *   node migrate.mjs --list                    — show status of all files
 *   node migrate.mjs --force 029_...sql        — re-run even if already ran
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const PROJECT_REF = 'mladgojbfyofgauiylxw';

// ── Load .env.migrate ─────────────────────────────────────────────────────────
const envFile = path.join(__dirname, '.env.migrate');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.trim().match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2];
  }
}
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error('\n  ERROR: SUPABASE_ACCESS_TOKEN not set in .env.migrate\n');
  process.exit(1);
}
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

// ── Run SQL via Management API ────────────────────────────────────────────────
async function runSQL(query) {
  const r = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`API ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ── Tracking table ────────────────────────────────────────────────────────────
async function ensureTrackingTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS bookflow.schema_migrations (
      filename  TEXT PRIMARY KEY,
      ran_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      success   BOOLEAN NOT NULL DEFAULT TRUE,
      error_msg TEXT
    );
  `).catch(() => {}); // ignore if already exists
}

async function getRanMigrations() {
  try {
    const rows = await runSQL(
      `SELECT filename FROM bookflow.schema_migrations WHERE success = TRUE`
    );
    return new Set(rows.map(r => r.filename));
  } catch {
    return new Set();
  }
}

async function recordResult(filename, success, errorMsg = null) {
  await runSQL(
    `INSERT INTO bookflow.schema_migrations (filename, success, error_msg)
     VALUES ('${filename.replace(/'/g, "''")}', ${success}, ${errorMsg ? `'${errorMsg.replace(/'/g, "''").slice(0, 500)}'` : 'NULL'})
     ON CONFLICT (filename) DO UPDATE SET success=${success}, ran_at=NOW(), error_msg=EXCLUDED.error_msg`
  ).catch(() => {});
}

// ── Files ─────────────────────────────────────────────────────────────────────
function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
}

// ── Run one file ──────────────────────────────────────────────────────────────
async function runFile(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`  ✗ Not found: ${filename}`);
    return false;
  }
  const sql = fs.readFileSync(filepath, 'utf8');
  process.stdout.write(`  ${filename} ... `);
  try {
    await runSQL(sql);
    await recordResult(filename, true);
    console.log('✓');
    return true;
  } catch (err) {
    console.log(`✗\n    ${err.message}`);
    await recordResult(filename, false, err.message);
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const files = getMigrationFiles();

  // Verify connection
  await runSQL('SELECT 1').catch(err => {
    console.error(`\n  Connection failed: ${err.message}\n`);
    process.exit(1);
  });

  await ensureTrackingTable();

  // --list
  if (args.includes('--list')) {
    let rows = [];
    try { rows = await runSQL(`SELECT filename, ran_at, success, error_msg FROM bookflow.schema_migrations`); } catch {}
    const byFile = Object.fromEntries(rows.map(r => [r.filename, r]));
    console.log(`\nBookFlow migrations (${files.length} total):\n`);
    for (const f of files) {
      const row = byFile[f];
      const icon  = !row ? '○' : row.success ? '✓' : '✗';
      const label = !row ? 'pending'
        : row.success ? `ran ${new Date(row.ran_at).toLocaleString()}`
        : `error: ${row.error_msg}`;
      console.log(`  ${icon}  ${f}  —  ${label}`);
    }
    console.log('');
    return;
  }

  // Run specific file
  const target = args.filter(a => !a.startsWith('--'))[0];
  if (target) {
    console.log(`\nBookFlow migration runner\n`);
    if (!force) {
      const ran = await getRanMigrations();
      if (ran.has(target)) {
        console.log(`  Already ran: ${target}\n  Use --force to re-run.\n`);
        return;
      }
    }
    const ok = await runFile(target);
    console.log('');
    process.exit(ok ? 0 : 1);
  }

  // Run all pending
  console.log(`\nBookFlow migration runner\n`);
  const ran = force ? new Set() : await getRanMigrations();
  const pending = files.filter(f => !ran.has(f));

  if (pending.length === 0) {
    console.log('  Everything is up to date.\n');
    return;
  }

  console.log(`  ${pending.length} pending:\n`);
  let ok = 0, failed = 0;
  for (const f of pending) {
    const success = await runFile(f);
    success ? ok++ : failed++;
  }
  console.log(`\n  Done — ${ok} succeeded, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
