import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import {
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_DATABASE_ID,
  CLOUDFLARE_D1_TOKEN,
} from '../env';
import { ensureSchema } from './ensure';
import * as schema from './schema';

export type Database = SqliteRemoteDatabase<typeof schema>;

interface D1Error {
  message?: string;
}

interface D1Response {
  success?: boolean;
  errors?: D1Error[];
  result?: {
    success?: boolean;
    results?:
      { columns?: string[]; rows?: unknown[][] } | Record<string, unknown>[];
  }[];
}

const MISSING_CREDENTIALS =
  'Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_D1_TOKEN in Doppler or apps/backend/.env. The account id is on the Workers overview. The database id is on the D1 database page. Create an API token with D1 Edit permission.';

let database: Database | null = null;
let connecting: Promise<void> | null = null;
let credentials: {
  accountId: string;
  databaseId: string;
  token: string;
} | null = null;

export function isDatabaseConnected(): boolean {
  return database !== null;
}

export function getDb(): Database {
  if (!database) throw new Error('D1 is not connected');
  return database;
}

function requireCredentials(): {
  accountId: string;
  databaseId: string;
  token: string;
} {
  if (
    !CLOUDFLARE_ACCOUNT_ID ||
    !CLOUDFLARE_DATABASE_ID ||
    !CLOUDFLARE_D1_TOKEN
  ) {
    throw new Error(MISSING_CREDENTIALS);
  }
  return {
    accountId: CLOUDFLARE_ACCOUNT_ID,
    databaseId: CLOUDFLARE_DATABASE_ID,
    token: CLOUDFLARE_D1_TOKEN,
  };
}

async function postD1(
  path: 'raw' | 'query',
  sql: string,
  params: unknown[],
): Promise<NonNullable<D1Response['result']>[number]> {
  const active = credentials ?? requireCredentials();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${active.accountId}/d1/database/${active.databaseId}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${active.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = (await response.json().catch(() => null)) as D1Response | null;
  if (!body || !response.ok || body.success === false) {
    const message = body?.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join('; ');
    throw new Error(message || `D1 ${path} failed (${response.status})`);
  }
  const statement = body.result?.[0];
  if (!statement || statement.success === false) {
    throw new Error('D1 query failed');
  }
  return statement;
}

async function d1Raw(sql: string, params: unknown[]): Promise<unknown[][]> {
  const statement = await postD1('raw', sql, params);
  const results = statement.results;
  if (!results || Array.isArray(results) || !results.rows) return [];
  return results.rows;
}

export async function queryObjects<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const statement = await postD1('query', sql, params);
  return Array.isArray(statement.results) ? (statement.results as T[]) : [];
}

async function remoteQuery(
  sql: string,
  params: unknown[],
  method: 'run' | 'all' | 'values' | 'get',
): Promise<{ rows: any[] }> {
  const rows = await d1Raw(sql, params);
  if (method === 'get') return { rows: (rows[0] ?? null) as any };
  return { rows: rows as any[] };
}

export async function connectDatabase(): Promise<void> {
  if (database) return;
  if (connecting) return connecting;
  connecting = openDatabase();
  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

async function openDatabase(): Promise<void> {
  credentials = requireCredentials();
  try {
    await d1Raw('select 1', []);
    await ensureSchema(async (statement) => {
      await d1Raw(statement, []);
    });
    database = drizzle(remoteQuery, { schema });
  } catch (error) {
    credentials = null;
    database = null;
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  database = null;
  credentials = null;
}
