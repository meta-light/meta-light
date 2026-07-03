import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tags, contactTags } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const all = await db.query.tags.findMany();
  return NextResponse.json({ tags: all });
}

export async function POST(req: NextRequest) {
  const { action, name, color, contactId, tagId } = await req.json();
  const db = getDb();

  if (action === 'create') {
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const id = nanoid();
    await db.insert(tags).values({ id, name, color: color ?? '#6366f1' });
    return NextResponse.json({ id });
  }

  if (action === 'add_to_contact') {
    if (!contactId || !tagId) return NextResponse.json({ error: 'contactId and tagId required' }, { status: 400 });
    try {
      await db.insert(contactTags).values({ contactId, tagId });
    } catch {} // ignore duplicate
    return NextResponse.json({ status: 'added' });
  }

  if (action === 'remove_from_contact') {
    if (!contactId || !tagId) return NextResponse.json({ error: 'contactId and tagId required' }, { status: 400 });
    await db.delete(contactTags).where(
      and(eq(contactTags.contactId, contactId), eq(contactTags.tagId, tagId))
    );
    return NextResponse.json({ status: 'removed' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
