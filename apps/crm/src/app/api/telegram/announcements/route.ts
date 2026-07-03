import { NextResponse } from 'next/server';
import { getClient } from '@/lib/telegram/client';
import { Api } from 'telegram';

export interface AnnouncementPost {
  id: string; // `${channelId}-${msgId}`
  channelId: string;
  channelName: string;
  channelColor: string;
  channelInitials: string;
  text: string;
  html?: string;
  date: number;
  mediaType?: 'photo' | 'video' | 'document' | 'audio';
  mediaDescription?: string;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#3b82f6', '#06b6d4',
];

function colorForId(id: number) {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function entitiesToHtml(text: string, entities: Api.TypeMessageEntity[]): string {
  if (!entities.length) return '';
  const sorted = [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length);
  let html = '';
  let pos = 0;
  for (const entity of sorted) {
    if (entity.offset < pos) continue;
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

export async function GET() {
  try {
    const client = await getClient();
    if (!await client.isUserAuthorized()) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const dialogs = await client.getDialogs({ limit: 100 });

    // Find all broadcast channels (not megagroups)
    const channels: { id: string; numId: number; name: string }[] = [];
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (
        entity instanceof Api.Channel &&
        !entity.megagroup &&
        entity.broadcast
      ) {
        const numId = Number(entity.id);
        channels.push({
          id: `channel-${numId}`,
          numId,
          name: entity.title ?? 'Channel',
        });
      }
    }

    // Fetch recent posts from each channel (up to 20 channels, 10 posts each)
    const posts: AnnouncementPost[] = [];

    await Promise.all(
      channels.slice(0, 20).map(async (ch) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entity = await client.getEntity(ch.numId as any);
          const rawMessages = await client.getMessages(entity, { limit: 10 });
          for (const msg of rawMessages) {
            if (!(msg instanceof Api.Message)) continue;
            const text = msg.message ?? '';
            const entities = msg.entities ?? [];
            const html = entities.length ? entitiesToHtml(text, entities) : undefined;

            let mediaType: AnnouncementPost['mediaType'];
            let mediaDescription: string | undefined;
            if (msg.media instanceof Api.MessageMediaPhoto) {
              mediaType = 'photo'; mediaDescription = '📷 Photo';
            } else if (msg.media instanceof Api.MessageMediaDocument) {
              const doc = msg.media.document;
              if (doc instanceof Api.Document) {
                if (doc.attributes.some((a) => a instanceof Api.DocumentAttributeVideo)) {
                  mediaType = 'video'; mediaDescription = '🎬 Video';
                } else if (doc.attributes.some((a) => a instanceof Api.DocumentAttributeAudio)) {
                  mediaType = 'audio'; mediaDescription = '🎵 Audio';
                } else {
                  mediaType = 'document'; mediaDescription = '📎 File';
                }
              }
            }

            posts.push({
              id: `${ch.id}-${msg.id}`,
              channelId: ch.id,
              channelName: ch.name,
              channelColor: colorForId(ch.numId),
              channelInitials: getInitials(ch.name),
              text,
              html,
              date: msg.date,
              mediaType,
              mediaDescription,
            });
          }
        } catch {
          // Skip channels we can't read
        }
      })
    );

    // Sort newest first
    posts.sort((a, b) => b.date - a.date);

    return NextResponse.json({ posts });
  } catch (e) {
    console.error('Announcements error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
