#!/usr/bin/env node
/**
 * BookFlow Migration Runner
 * Runs SQL migration files directly against Supabase production DB.
 *
 * SETUP (one time):
 *   Set DB_PASSWORD env var to your Supabase DB password:
 *     Windows:  set DB_PASSWORD=your-password-here
 *     PowerShell: $env:DB_PASSWORD="your-password-here"
 *
 *   Or create a .env.migrate file next to this script:
 *     DB_PASSWORD=your-password-here
 *
 *   Password location: Supabase Dashboard → Settings → Database → Database password → Reset
 *
 * USAGE:
 *   node migrate.mjs                           — run all pending
 *   node migrate.mjs 029_chapter_slugs_qr.sql  — run one file
 *   node migrate.mjs --list                    — show status of all files
 *   node migrate.mjs --force 029_...sql        — re-run even if already ran
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// ── Load .env.migrate if present ──────────────────────────────────────────────
const envFile = path.join(__dirname, '.env.migrate');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

// ── Connection ────────────────────────────────────────────────────────────────
const DB_PASSWORD = process.env.DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error(`
  ERROR: DB_PASSWORD not set.

  Get your password from:
    Supabase Dashboard → Settings → Database → Database password → Reset

  Then either:
    1. Create a file called .env.migrate next to migrate.mjs with:
         DB_PASSWORD=your-password-here

    2. Or set it inline:
         Windows cmd:   set DB_PASSWORD=your-password && node migrate.mjs
         PowerShell:    $env:DB_PASSWORD="your-password" ; node migrate.mjs
`);
  process.exit(1);
}

const pool = new Pool({
  connectionString: `postgresql://postgres.mladgojbfyofgauiylxw:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
});

// ── Ensure tracking table ─────────────────────────────────────────────────────
async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS bookflow.schema_migrations (
      filename  TEXT PRIMARY KEY,
      ran_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      success   BOOLEAN NOT NULL DEFAULT TRUE,
      error_msg TEXT
    );
  `);
}

// ── Get already-ran migrations ────────────────────────────────────────────────
async function getRanMigrations(client) {
  try {
    const { rows } = await client.query(
      `SELECT filename FROM bookflow.schema_migrations WHERE success = TRUE`
    );
    return new Set(rows.map(r => r.filename));
  } catch {
    return new Set();
  }
}

// ── Record result ─────────────────────────────────────────────────────────────
async function recordResult(client, filename, success, errorMsg = null) {
  await client.query(
    `INSERT INTO bookflow.schema_migrations (filename, success, error_msg)
     VALUES ($1, $2, $3)
     ON CONFLICT (filename) DO UPDATE SET success=$2, ran_at=NOW(), error_msg=$3`,
    [filename, success, errorMsg]
  );
}

// ── Sorted .sql files ─────────────────────────────────────────────────────────
function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

// ── Run one file ──────────────────────────────────────────────────────────────
async function runFile(client, filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`  ✗ Not found: ${filename}`);
    return false;
  }
  const sql = fs.readFileSync(filepath, 'utf8');
  process.stdout.write(`  ${filename} ... `);
  try {
    await client.query(sql);
    await recordResult(client, filename, true);
    console.log('✓');
    return true;
  } catch (err) {
    console.log(`✗\n    ${err.message}`);
    await recordResult(client, filename, false, err.message).catch(() => {});
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const files = getMigrationFiles();

  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);

    // --list
    if (args.includes('--list')) {
      const { rows } = await client.query(
        `SELECT filename, ran_at, success, error_msg FROM bookflow.schema_migrations`
      );
      const byFile = Object.fromEntries(rows.map(r => [r.filename, r]));
      console.log(`\nBookFlow migrations (${files.length} total):\n`);
      for (const f of files) {
        const row = byFile[f];
        const icon = !row ? '○' : row.success ? '✓' : '✗';
        const label = !row ? 'pending' : row.success ? `ran ${new Date(row.ran_at).toLocaleString()}` : `error: ${row.error_msg}`;
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
        const ran = await getRanMigrations(client);
        if (ran.has(target)) {
          console.log(`  Already ran: ${target}\n  Use --force to re-run.\n`);
          return;
        }
      }
      const ok = await runFile(client, target);
      console.log('');
      process.exit(ok ? 0 : 1);
    }

    // Run all pending
    console.log(`\nBookFlow migration runner\n`);
    const ran = force ? new Set() : await getRanMigrations(client);
    const pending = files.filter(f => !ran.has(f));

    if (pending.length === 0) {
      console.log('  Everything is up to date.\n');
      return;
    }

    console.log(`  ${pending.length} pending:\n`);
    let ok = 0, failed = 0;
    for (const f of pending) {
      const success = await runFile(client, f);
      success ? ok++ : failed++;
    }
    console.log(`\n  Done — ${ok} succeeded, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
