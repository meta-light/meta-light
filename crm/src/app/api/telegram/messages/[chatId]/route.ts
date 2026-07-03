import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/telegram/client';
import { Api } from 'telegram';
import type { TelegramMessage } from '@/lib/telegram/types';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function entitiesToHtml(text: string, entities: Api.TypeMessageEntity[]): string {
  if (!entities.length) return '';

  // Sort by offset ascending; on tie, longer entity first (outer wraps inner)
  const sorted = [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length);

  let html = '';
  let pos = 0;

  for (const entity of sorted) {
    if (entity.offset < pos) continue; // skip nested/overlapping (simplification)
    if (entity.offset > pos) html += escapeHtml(text.slice(pos, entity.offset));

    const chunk = text.slice(entity.offset, entity.offset + entity.length);

    if (entity instanceof Api.MessageEntityTextUrl) {
      const href = /^https?:\/\//.test(entity.url) ? entity.url : '';
      html += href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(chunk)}</a>`
        : escapeHtml(chunk);
    } else if (entity instanceof Api.MessageEntityUrl) {
      const href = /^https?:\/\//.test(chunk) ? chunk : '';
      html += href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(chunk)}</a>`
        : escapeHtml(chunk);
    } else if (entity instanceof Api.MessageEntityBold) {
      html += `<strong>${escapeHtml(chunk)}</strong>`;
    } else if (entity instanceof Api.MessageEntityItalic) {
      html += `<em>${escapeHtml(chunk)}</em>`;
    } else if (entity instanceof Api.MessageEntityCode) {
      html += `<code>${escapeHtml(chunk)}</code>`;
    } else if (entity instanceof Api.MessageEntityPre) {
      html += `<pre>${escapeHtml(chunk)}</pre>`;
    } else {
      html += escapeHtml(chunk);
    }

    pos = entity.offset + entity.length;
  }

  if (pos < text.length) html += escapeHtml(text.slice(pos));
  return html;
}

function parseEntityId(chatId: string): { type: 'user' | 'chat' | 'channel'; id: number } | null {
  const match = chatId.match(/^(user|chat|channel)-(\d+)$/);
  if (!match) return null;
  return { type: match[1] as 'user' | 'chat' | 'channel', id: parseInt(match[2], 10) };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;

  try {
    const client = await getClient();
    const authorized = await client.isUserAuthorized();
    if (!authorized) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const parsed = parseEntityId(chatId);
    if (!parsed) return NextResponse.json({ error: 'Invalid chatId' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = await client.getEntity(parsed.id as any);
    const me = await client.getMe();
    const myId = me instanceof Api.User ? Number(me.id) : -1;

    const rawMessages = await client.getMessages(entity, { limit: 50 });
    const messages: TelegramMessage[] = [];

    for (const msg of rawMessages) {
      if (!(msg instanceof Api.Message)) continue;

      let fromName: string | undefined;
      let fromId: string | undefined;

      if (msg.fromId instanceof Api.PeerUser) {
        const fromUserId = Number(msg.fromId.userId);
        fromId = `user-${fromUserId}`;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sender = await client.getEntity(fromUserId as any);
          if (sender instanceof Api.User) {
            fromName = [sender.firstName, sender.lastName].filter(Boolean).join(' ') || sender.username;
          }
        } catch {}
      }

      let mediaType: TelegramMessage['mediaType'];
      let mediaDescription: string | undefined;

      if (msg.media) {
        if (msg.media instanceof Api.MessageMediaPhoto) {
          mediaType = 'photo';
          mediaDescription = '📷 Photo';
        } else if (msg.media instanceof Api.MessageMediaDocument) {
          const doc = msg.media.document;
          if (doc instanceof Api.Document) {
            const isVideo = doc.attributes.some((a) => a instanceof Api.DocumentAttributeVideo);
            const isAudio = doc.attributes.some((a) => a instanceof Api.DocumentAttributeAudio);
            const isSticker = doc.attributes.some((a) => a instanceof Api.DocumentAttributeSticker);
            if (isSticker) { mediaType = 'sticker'; mediaDescription = '🎭 Sticker'; }
            else if (isVideo) { mediaType = 'video'; mediaDescription = '🎬 Video'; }
            else if (isAudio) { mediaType = 'audio'; mediaDescription = '🎵 Audio'; }
            else { mediaType = 'document'; mediaDescription = '📎 File'; }
          }
        }
      }

      const rawText = msg.message ?? '';
      const entities = msg.entities ?? [];
      const html = entities.length ? entitiesToHtml(rawText, entities) : undefined;

      messages.push({
        id: msg.id,
        text: rawText,
        html,
        date: msg.date,
        fromId,
        fromName,
        isOutgoing: msg.out ?? (msg.fromId instanceof Api.PeerUser && Number(msg.fromId.userId) === myId),
        mediaType,
        mediaDescription,
      });
    }

    messages.reverse();
    return NextResponse.json({ messages });
  } catch (e) {
    console.error('Messages error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
