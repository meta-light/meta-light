import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { notes } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const { contactId, body: noteBody } = await req.json();
  if (!contactId || !noteBody?.trim()) {
    return NextResponse.json({ error: 'contactId and body required' }, { status: 400 });
  }

  const db = getDb();
  const id = nanoid();
  await db.insert(notes).values({ id, contactId, body: noteBody, createdAt: Date.now() });
  return NextResponse.json({ id });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  await db.delete(notes).where(eq(notes.id, id));
  return NextResponse.json({ status: 'deleted' });
}
