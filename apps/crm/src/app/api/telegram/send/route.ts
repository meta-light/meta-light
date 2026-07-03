import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/telegram/client';

export async function POST(req: NextRequest) {
  const { chatId, message } = await req.json();

  if (!chatId || !message?.trim()) {
    return NextResponse.json({ error: 'chatId and message required' }, { status: 400 });
  }

  try {
    const client = await getClient();
    const authorized = await client.isUserAuthorized();
    if (!authorized) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const match = chatId.match(/^(user|chat|channel)-(\d+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid chatId' }, { status: 400 });

    const numericId = parseInt(match[2], 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = await client.getEntity(numericId as any);
    await client.sendMessage(entity, { message });

    return NextResponse.json({ status: 'sent' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
