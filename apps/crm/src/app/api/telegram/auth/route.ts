import { NextRequest, NextResponse } from 'next/server';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import { saveSession, getClient } from '@/lib/telegram/client';
import { getDb } from '@/lib/db';
import { telegramSession } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Pending auth state (single-user, module-level — survives within one server process)
let pendingClient: TelegramClient | null = null;
let pendingPhone: string | null = null;
let pendingPhoneCodeHash: string | null = null;

async function resetPending() {
  try { await pendingClient?.disconnect(); } catch {}
  pendingClient = null;
  pendingPhone = null;
  pendingPhoneCodeHash = null;
}

async function startAuth(phone: string, apiId: number, apiHash: string) {
  await resetPending();
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();
  const result = await client.sendCode({ apiId, apiHash }, phone);
  pendingClient = client;
  pendingPhone = phone;
  pendingPhoneCodeHash = result.phoneCodeHash;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  const apiId = parseInt(process.env.TELEGRAM_API_ID ?? '0', 10);
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';

  if (!apiId || !apiHash) {
    return NextResponse.json({ error: 'API credentials not configured in .env.local' }, { status: 500 });
  }

  // Step 1: send code
  if (action === 'start' || action === 'resend') {
    const phone = body.phone ?? pendingPhone;
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 });

    try {
      await startAuth(phone, apiId, apiHash);
      return NextResponse.json({ status: 'code_sent' });
    } catch (e: unknown) {
      await resetPending();
      const msg = (e as { errorMessage?: string; message?: string }).errorMessage
        ?? (e as Error).message
        ?? String(e);
      // Surface flood wait clearly
      const floodMatch = msg.match(/FLOOD_WAIT_(\d+)/);
      if (floodMatch) {
        const secs = parseInt(floodMatch[1], 10);
        return NextResponse.json(
          { error: `Too many attempts — Telegram asks you to wait ${secs} seconds before requesting another code.` },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Reset pending state (called when user clicks "start over")
  if (action === 'reset') {
    await resetPending();
    return NextResponse.json({ status: 'reset' });
  }

  // Step 2: verify code
  if (action === 'verify_code') {
    const { code } = body;
    if (!pendingClient || !pendingPhone || !pendingPhoneCodeHash) {
      return NextResponse.json(
        { error: 'Session expired — please request a new code', needsRestart: true },
        { status: 400 }
      );
    }

    try {
      await pendingClient.invoke(
        new Api.auth.SignIn({
          phoneNumber: pendingPhone,
          phoneCodeHash: pendingPhoneCodeHash,
          phoneCode: code,
        })
      );

      await saveSession(pendingClient);
      const db = getDb();
      await db.update(telegramSession)
        .set({ phone: pendingPhone, updatedAt: Date.now() })
        .where(eq(telegramSession.id, 1));

      await resetPending();
      return NextResponse.json({ status: 'authenticated' });
    } catch (e: unknown) {
      const msg = (e as { errorMessage?: string; message?: string }).errorMessage
        ?? (e as Error).message
        ?? String(e);

      if (msg.includes('SESSION_PASSWORD_NEEDED')) {
        return NextResponse.json({ status: 'password_required' });
      }
      if (msg.includes('PHONE_CODE_INVALID')) {
        return NextResponse.json({ error: 'Invalid code — please check and try again.' }, { status: 400 });
      }
      if (msg.includes('PHONE_CODE_EXPIRED')) {
        await resetPending();
        return NextResponse.json(
          { error: 'Code expired — please request a new one.', needsRestart: true },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // Step 3 (optional): 2FA password
  if (action === 'verify_password') {
    const { password } = body;
    if (!pendingClient) {
      return NextResponse.json({ error: 'No pending session — please start over', needsRestart: true }, { status: 400 });
    }

    try {
      await pendingClient.signInWithPassword(
        { apiId, apiHash },
        {
          password: async () => password,
          onError: async (e) => { throw e; },
        }
      );

      await saveSession(pendingClient);
      await resetPending();
      return NextResponse.json({ status: 'authenticated' });
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? String(e);
      if (msg.includes('PASSWORD_HASH_INVALID')) {
        return NextResponse.json({ error: 'Wrong password — please try again.' }, { status: 400 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (action === 'logout') {
    try {
      const client = await getClient();
      await client.invoke(new Api.auth.LogOut());
    } catch {}
    const db = getDb();
    await db.update(telegramSession)
      .set({ sessionString: '', updatedAt: Date.now() })
      .where(eq(telegramSession.id, 1));
    return NextResponse.json({ status: 'logged_out' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function GET() {
  try {
    const client = await getClient();
    const authorized = await client.isUserAuthorized();
    return NextResponse.json({ authenticated: authorized });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
