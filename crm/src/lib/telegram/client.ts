import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { getDb } from '@/lib/db';
import { telegramSession } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

let _client: TelegramClient | null = null;
let _sseClients: Set<(data: string) => void> = new Set();

export function registerSseClient(send: (data: string) => void) {
  _sseClients.add(send);
  return () => _sseClients.delete(send);
}

function broadcastUpdate(event: object) {
  const data = JSON.stringify(event);
  _sseClients.forEach((send) => {
    try {
      send(data);
    } catch {
      _sseClients.delete(send);
    }
  });
}

export async function getClient(): Promise<TelegramClient> {
  if (_client?.connected) return _client;

  const apiId = parseInt(process.env.TELEGRAM_API_ID ?? '0', 10);
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';

  if (!apiId || !apiHash) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env.local');
  }

  const db = getDb();
  let sessionRow = await db.query.telegramSession.findFirst({
    where: eq(telegramSession.id, 1),
  });

  const sessionString = sessionRow?.sessionString ?? '';
  const session = new StringSession(sessionString);

  _client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await _client.connect();

  // Set up update handler for real-time SSE
  _client.addEventHandler((update: object) => {
    broadcastUpdate(update);
  });

  return _client;
}

export async function saveSession(client: TelegramClient) {
  const sessionString = client.session.save() as unknown as string;
  const db = getDb();
  const now = Date.now();

  const existing = await db.query.telegramSession.findFirst({
    where: eq(telegramSession.id, 1),
  });

  if (existing) {
    await db.update(telegramSession)
      .set({ sessionString, updatedAt: now })
      .where(eq(telegramSession.id, 1));
  } else {
    await db.insert(telegramSession).values({ id: 1, sessionString, updatedAt: now });
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const client = await getClient();
    return await client.isUserAuthorized();
  } catch {
    return false;
  }
}

export function getClientSync(): TelegramClient | null {
  return _client;
}
