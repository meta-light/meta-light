import { getClient } from './client';
import { getDb } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { Api } from 'telegram';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#3b82f6', '#06b6d4',
];

function colorForId(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

export async function syncContacts() {
  const client = await getClient();
  const db = getDb();
  const now = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await client.invoke(new Api.contacts.GetContacts({ hash: 0 as any }));
  if (!(result instanceof Api.contacts.Contacts)) return;

  for (const user of result.users) {
    if (!(user instanceof Api.User) || !user.id) continue;
    const telegramId = Number(user.id);
    const id = `tg-${telegramId}`;

    const existing = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });

    const data = {
      telegramId,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? null,
      username: user.username ?? null,
      phone: user.phone ?? null,
      avatarColor: colorForId(telegramId),
      updatedAt: now,
    };

    if (existing) {
      await db.update(contacts).set(data).where(eq(contacts.id, id));
    } else {
      await db.insert(contacts).values({ id, createdAt: now, ...data });
    }
  }
}
