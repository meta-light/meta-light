import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { contacts, notes, contactTags, tags } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, id),
    with: {
      contactTags: { with: { tag: true } },
      notes: { orderBy: (n, { desc }) => [desc(n.createdAt)] },
    },
  });

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ contact });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const allowed = ['firstName', 'lastName', 'username', 'phone', 'pipelineStageId', 'avatarColor'];
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const key of allowed) {
    if (key in body) update[key === 'firstName' ? 'firstName' : key] = body[key];
  }

  // Map camelCase to snake_case for drizzle
  const mapped: Partial<typeof contacts.$inferInsert> = {
    updatedAt: Date.now(),
  };
  if ('firstName' in body) mapped.firstName = body.firstName;
  if ('lastName' in body) mapped.lastName = body.lastName;
  if ('username' in body) mapped.username = body.username;
  if ('phone' in body) mapped.phone = body.phone;
  if ('pipelineStageId' in body) mapped.pipelineStageId = body.pipelineStageId;
  if ('avatarColor' in body) mapped.avatarColor = body.avatarColor;
  if ('lastContactedAt' in body) mapped.lastContactedAt = body.lastContactedAt;

  await db.update(contacts).set(mapped).where(eq(contacts.id, id));
  return NextResponse.json({ status: 'updated' });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  await db.delete(contacts).where(eq(contacts.id, id));
  return NextResponse.json({ status: 'deleted' });
}
