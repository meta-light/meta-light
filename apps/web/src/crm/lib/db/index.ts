import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? './crm.db';
const dbUrl = `file:${path.resolve(process.cwd(), DB_PATH)}`;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: ReturnType<typeof createClient> | null = null;
let _initialized = false;
let _initPromise: Promise<void> | null = null;

export function getDb() {
  if (!_client) {
    _client = createClient({ url: dbUrl });
    _db = drizzle(_client, { schema });
  }
  // Kick off schema init if not already started (fire-and-forget is fine for DDL)
  if (!_initPromise) {
    _initPromise = initSchema(_client);
  }
  return _db!;
}

export async function ensureDb() {
  if (!_client) {
    _client = createClient({ url: dbUrl });
    _db = drizzle(_client, { schema });
  }
  if (!_initPromise) {
    _initPromise = initSchema(_client);
  }
  await _initPromise;
  return _db!;
}

async function initSchema(client: ReturnType<typeof createClient>) {
  await client.batch([
    { sql: `CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      position INTEGER NOT NULL DEFAULT 0
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      telegram_id INTEGER NOT NULL,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT,
      username TEXT,
      phone TEXT,
      avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      pipeline_stage_id TEXT REFERENCES pipeline_stages(id),
      last_contacted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1'
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS contact_tags (
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (contact_id, tag_id)
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS telegram_session (
      id INTEGER PRIMARY KEY,
      session_string TEXT NOT NULL DEFAULT '',
      phone TEXT,
      updated_at INTEGER NOT NULL
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS integration_configs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 0
    )`, args: [] },
  ], 'write');

  // Seed default pipeline stages
  const result = await client.execute('SELECT COUNT(*) as count FROM pipeline_stages');
  const count = Number(result.rows[0]?.count ?? 0);
  if (count === 0) {
    await client.batch([
      { sql: `INSERT OR IGNORE INTO pipeline_stages (id, name, color, position) VALUES ('stage-lead', 'Lead', '#6366f1', 0)`, args: [] },
      { sql: `INSERT OR IGNORE INTO pipeline_stages (id, name, color, position) VALUES ('stage-qualified', 'Qualified', '#f59e0b', 1)`, args: [] },
      { sql: `INSERT OR IGNORE INTO pipeline_stages (id, name, color, position) VALUES ('stage-proposal', 'Proposal', '#3b82f6', 2)`, args: [] },
      { sql: `INSERT OR IGNORE INTO pipeline_stages (id, name, color, position) VALUES ('stage-won', 'Won', '#10b981', 3)`, args: [] },
      { sql: `INSERT OR IGNORE INTO pipeline_stages (id, name, color, position) VALUES ('stage-lost', 'Lost', '#ef4444', 4)`, args: [] },
    ], 'write');
  }
}
