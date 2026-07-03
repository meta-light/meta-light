import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { pipelineStages, contacts } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const stages = await db.query.pipelineStages.findMany({
    orderBy: [asc(pipelineStages.position)],
  });

  const contactRows = await db.query.contacts.findMany({
    with: { contactTags: { with: { tag: true } } },
  });

  const board = stages.map((stage) => ({
    ...stage,
    contacts: contactRows.filter((c) => c.pipelineStageId === stage.id),
  }));

  return NextResponse.json({ board });
}

export async function POST(req: NextRequest) {
  const { action, contactId, stageId, name, color } = await req.json();
  const db = getDb();

  if (action === 'move') {
    if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    await db.update(contacts)
      .set({ pipelineStageId: stageId ?? null, updatedAt: Date.now() })
      .where(eq(contacts.id, contactId));
    return NextResponse.json({ status: 'moved' });
  }

  if (action === 'update_stage') {
    const updates: Partial<typeof pipelineStages.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    await db.update(pipelineStages).set(updates).where(eq(pipelineStages.id, stageId));
    return NextResponse.json({ status: 'updated' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
