import { NextResponse } from 'next/server';
import { syncContacts } from '@/crm/lib/telegram/sync';

export async function POST() {
  try {
    await syncContacts();
    return NextResponse.json({ status: 'synced' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
