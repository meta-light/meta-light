import { NextResponse } from 'next/server';
import { getClient } from '@/lib/telegram/client';
import { Api } from 'telegram';
import type { TelegramChat } from '@/lib/telegram/types';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#3b82f6', '#06b6d4',
];

function colorForId(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// Returns a stable string key for a peer so we can match against filter peer lists
function peerKey(peer: Api.TypeInputPeer | Api.TypePeer): string | null {
  if (peer instanceof Api.InputPeerUser || peer instanceof Api.PeerUser) {
    return `user-${Number(peer.userId)}`;
  }
  if (peer instanceof Api.InputPeerChat || peer instanceof Api.PeerChat) {
    return `chat-${Number(peer.chatId)}`;
  }
  if (peer instanceof Api.InputPeerChannel || peer instanceof Api.PeerChannel) {
    return `channel-${Number(peer.channelId)}`;
  }
  return null;
}

interface FolderDef {
  name: string;
  peerKeys: Set<string>;
  // categorical flags
  allBroadcasts: boolean;
  allGroups: boolean;
  allBots: boolean;
  allContacts: boolean;
  allNonContacts: boolean;
}

export async function GET() {
  try {
    const client = await getClient();
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch normal + archived dialogs in parallel alongside folder filters
    const [normalDialogs, archivedDialogs, filtersResult] = await Promise.all([
      client.getDialogs({ limit: 100 }),
      client.getDialogs({ limit: 100, archived: true }),
      client.invoke(new Api.messages.GetDialogFilters()),
    ]);

    // Build folder definitions
    const folders: FolderDef[] = [];
    const filterList = Array.isArray(filtersResult) ? filtersResult : (filtersResult as { filters: Api.TypeDialogFilter[] }).filters ?? [];

    for (const filter of filterList) {
      if (!(filter instanceof Api.DialogFilter)) continue;
      const title = typeof filter.title === 'string' ? filter.title : (filter.title as { text?: string })?.text ?? 'Folder';
      const peerKeys = new Set<string>();
      for (const p of [...(filter.pinnedPeers ?? []), ...(filter.includePeers ?? [])]) {
        const key = peerKey(p);
        if (key) peerKeys.add(key);
      }
      folders.push({
        name: title,
        peerKeys,
        allBroadcasts: !!filter.broadcasts,
        allGroups: !!filter.groups,
        allBots: !!filter.bots,
        allContacts: !!filter.contacts,
        allNonContacts: !!filter.nonContacts,
      });
    }

    const archivedIds = new Set(
      archivedDialogs.map((d) => {
        const e = d.entity;
        if (!e) return null;
        if (e instanceof Api.User) return `user-${Number(e.id)}`;
        if (e instanceof Api.Chat || e instanceof Api.ChatForbidden) return `chat-${Number(e.id)}`;
        if (e instanceof Api.Channel || e instanceof Api.ChannelForbidden) return `channel-${Number(e.id)}`;
        return null;
      }).filter(Boolean)
    );

    function buildChat(dialog: (typeof normalDialogs)[number], isArchived: boolean): TelegramChat | null {
      const entity = dialog.entity;
      if (!entity) return null;

      let id: string;
      let name: string;
      let username: string | undefined;
      let phone: string | undefined;
      let isGroup = false;
      let isChannel = false;
      let isBot = false;
      let entityIdNum = 0;

      if (entity instanceof Api.User) {
        entityIdNum = Number(entity.id);
        id = `user-${entityIdNum}`;
        name = [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.username || 'Unknown';
        username = entity.username ?? undefined;
        phone = entity.phone ?? undefined;
        isBot = !!entity.bot;
      } else if (entity instanceof Api.Chat || entity instanceof Api.ChatForbidden) {
        entityIdNum = Number(entity.id);
        id = `chat-${entityIdNum}`;
        name = entity.title ?? 'Group';
        isGroup = true;
      } else if (entity instanceof Api.Channel || entity instanceof Api.ChannelForbidden) {
        entityIdNum = Number(entity.id);
        id = `channel-${entityIdNum}`;
        name = entity.title ?? 'Channel';
        isChannel = !(entity instanceof Api.ChannelForbidden) && !entity.megagroup;
        isGroup = !(entity instanceof Api.ChannelForbidden) && !!entity.megagroup;
      } else {
        return null;
      }

      let lastMessage: string | undefined;
      let lastMessageDate: number | undefined;
      const msg = dialog.message;
      if (msg instanceof Api.Message) {
        lastMessage = msg.message || (msg.media ? '[Media]' : undefined);
        lastMessageDate = msg.date;
      }

      // Determine folders this chat belongs to
      const chatFolders = folders
        .filter((f) => {
          if (f.peerKeys.has(id)) return true;
          if (f.allBroadcasts && isChannel) return true;
          if (f.allGroups && isGroup) return true;
          if (f.allBots && isBot) return true;
          return false;
        })
        .map((f) => f.name);

      return {
        id,
        name,
        username,
        phone,
        isGroup,
        isChannel,
        isBot,
        isArchived,
        folders: chatFolders,
        unreadCount: dialog.unreadCount ?? 0,
        lastMessage,
        lastMessageDate,
        avatarColor: colorForId(entityIdNum),
        initials: getInitials(name),
      };
    }

    const chats: TelegramChat[] = [];

    for (const dialog of normalDialogs) {
      const chat = buildChat(dialog, archivedIds.has(
        (() => {
          const e = dialog.entity;
          if (!e) return '';
          if (e instanceof Api.User) return `user-${Number(e.id)}`;
          if (e instanceof Api.Chat || e instanceof Api.ChatForbidden) return `chat-${Number(e.id)}`;
          if (e instanceof Api.Channel || e instanceof Api.ChannelForbidden) return `channel-${Number(e.id)}`;
          return '';
        })()
      ));
      if (chat) chats.push(chat);
    }

    for (const dialog of archivedDialogs) {
      const chat = buildChat(dialog, true);
      if (chat && !chats.find((c) => c.id === chat.id)) chats.push(chat);
    }

    return NextResponse.json({ chats });
  } catch (e) {
    console.error('Chats error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
