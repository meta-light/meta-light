import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { contacts, contactTags, tags } from '@/lib/db/schema';
import { eq, like, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search') ?? '';
  const db = getDb();

  const rows = await db.query.contacts.findMany({
    orderBy: [desc(contacts.updatedAt)],
    with: {
      contactTags: { with: { tag: true } },
    },
    where: search
      ? (c, { or }) => or(
          like(c.firstName, `%${search}%`),
          like(c.lastName, `%${search}%`),
          like(c.username, `%${search}%`),
          like(c.phone, `%${search}%`)
        )
      : undefined,
  });

  return NextResponse.json({ contacts: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const now = Date.now();
  const id = body.id ?? `manual-${nanoid()}`;

  await db.insert(contacts).values({
    id,
    telegramId: body.telegramId ?? 0,
    firstName: body.firstName ?? '',
    lastName: body.lastName ?? null,
    username: body.username ?? null,
    phone: body.phone ?? null,
    avatarColor: body.avatarColor ?? '#6366f1',
    pipelineStageId: body.pipelineStageId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id });
}
