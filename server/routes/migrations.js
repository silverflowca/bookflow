/**
 * Migration runner — super_admin only
 *
 * GET  /api/admin/migrations          — list all .sql files + run status
 * POST /api/admin/migrations/:name    — run a specific migration
 * POST /api/admin/migrations/run-all  — run all pending migrations in order
 */

import express from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const { Pool } = pg;
const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

// All migration routes require super_admin
router.use(authenticate, requireSuperAdmin);

// ── DB pool (direct postgres connection) ──────────────────────────────────────
function getPool() {
  const connStr = process.env.DATABASE_URL || process.env.DB_URL;
  if (!connStr) throw new Error('DATABASE_URL env var is required for migration runner');
  return new Pool({ connectionString: connStr, ssl: connStr.includes('supabase.co') ? { rejectUnauthorized: false } : false });
}

// ── Ensure tracking table exists ──────────────────────────────────────────────
async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS bookflow.schema_migrations (
      filename   TEXT PRIMARY KEY,
      ran_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      success    BOOLEAN NOT NULL DEFAULT TRUE,
      error_msg  TEXT
    );
  `);
}

// ── List all .sql files in migrations/ ───────────────────────────────────────
function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

// ── GET /api/admin/migrations ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const { rows } = await client.query('SELECT filename, ran_at, success, error_msg FROM bookflow.schema_migrations');
    const ran = Object.fromEntries(rows.map(r => [r.filename, r]));
    const files = getMigrationFiles().map(f => ({
      filename: f,
      status: ran[f] ? (ran[f].success ? 'ran' : 'error') : 'pending',
      ran_at: ran[f]?.ran_at || null,
      error_msg: ran[f]?.error_msg || null,
    }));
    res.json({ migrations: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
    await pool.end();
  }
});

// ── POST /api/admin/migrations/run-pending ────────────────────────────────────
router.post('/run-pending', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const { rows } = await client.query('SELECT filename FROM bookflow.schema_migrations WHERE success = TRUE');
    const alreadyRan = new Set(rows.map(r => r.filename));
    const pending = getMigrationFiles().filter(f => !alreadyRan.has(f));

    const results = [];
    for (const filename of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO bookflow.schema_migrations (filename, success) VALUES ($1, TRUE)
           ON CONFLICT (filename) DO UPDATE SET success = TRUE, ran_at = NOW(), error_msg = NULL`,
          [filename]
        );
        await client.query('COMMIT');
        results.push({ filename, status: 'ran' });
        console.log(`[migrations] ✓ ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        await client.query(
          `INSERT INTO bookflow.schema_migrations (filename, success, error_msg) VALUES ($1, FALSE, $2)
           ON CONFLICT (filename) DO UPDATE SET success = FALSE, ran_at = NOW(), error_msg = $2`,
          [filename, err.message]
        );
        results.push({ filename, status: 'error', error: err.message });
        console.error(`[migrations] ✗ ${filename}:`, err.message);
        // Continue with remaining migrations even if one fails
      }
    }
    res.json({ results, pending_count: pending.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
    await pool.end();
  }
});

// ── POST /api/admin/migrations/:filename ─────────────────────────────────────
router.post('/:filename', async (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(MIGRATIONS_DIR, filename);

  if (!filename.endsWith('.sql') || !fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Migration file not found' });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const sql = fs.readFileSync(filepath, 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      `INSERT INTO bookflow.schema_migrations (filename, success) VALUES ($1, TRUE)
       ON CONFLICT (filename) DO UPDATE SET success = TRUE, ran_at = NOW(), error_msg = NULL`,
      [filename]
    );
    await client.query('COMMIT');
    console.log(`[migrations] ✓ ${filename}`);
    res.json({ filename, status: 'ran' });
  } catch (err) {
    await client.query('ROLLBACK');
    try {
      await client.query(
        `INSERT INTO bookflow.schema_migrations (filename, success, error_msg) VALUES ($1, FALSE, $2)
         ON CONFLICT (filename) DO UPDATE SET success = FALSE, ran_at = NOW(), error_msg = $2`,
        [filename, err.message]
      );
    } catch (_) { /* ignore tracking error */ }
    console.error(`[migrations] ✗ ${filename}:`, err.message);
    res.status(500).json({ filename, status: 'error', error: err.message });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
