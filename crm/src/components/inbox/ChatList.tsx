'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTelegramStore } from '@/store/telegramStore';
import { formatDistanceToNowStrict } from 'date-fns';
import type { TelegramChat } from '@/lib/telegram/types';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, Rss, SlidersHorizontal, Archive, FolderOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type Filter = 'all' | 'people' | 'groups' | 'bots';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'people', label: 'People' },
  { id: 'groups', label: 'Groups' },
  { id: 'bots', label: 'Bots' },
];

interface ChatFilters {
  hideArchived: boolean;
  hideBots: boolean;
}

function usePersistedFilters(): [ChatFilters, (f: Partial<ChatFilters>) => void] {
  const [filters, setFilters] = useState<ChatFilters>(() => {
    if (typeof window === 'undefined') return { hideArchived: true, hideBots: true };
    try {
      const stored = localStorage.getItem('chatFilters');
      return stored ? JSON.parse(stored) : { hideArchived: true, hideBots: true };
    } catch {
      return { hideArchived: true, hideBots: true };
    }
  });

  function update(partial: Partial<ChatFilters>) {
    setFilters((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem('chatFilters', JSON.stringify(next));
      return next;
    });
  }

  return [filters, update];
}

export function ChatList() {
  const pathname = usePathname();
  const { chats, setChats } = useTelegramStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [chatFilters, updateChatFilters] = usePersistedFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['chats'],
    queryFn: () => fetch('/api/telegram/chats').then((r) => r.json()),
  });

  useEffect(() => {
    if (data?.chats) setChats(data.chats);
  }, [data, setChats]);

  // Close filters dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const channels = chats.filter((c) => c.isChannel);

  const filtered = chats.filter((c) => {
    if (c.isChannel) return false;
    if (chatFilters.hideArchived && c.isArchived) return false;
    if (chatFilters.hideBots && c.isBot) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.username?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'people') return !c.isGroup && !c.isBot;
    if (filter === 'groups') return c.isGroup;
    if (filter === 'bots') return c.isBot;
    return true;
  });

  const activeFiltersCount = (chatFilters.hideArchived ? 1 : 0) + (chatFilters.hideBots ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-semibold text-base">Messages</h1>
          <div className="flex items-center gap-1">
            {/* Filters button */}
            <div className="relative" ref={filtersRef}>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  'relative flex items-center justify-center w-7 h-7 rounded-md transition-colors',
                  filtersOpen
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {filtersOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-popover border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Filters
                  </p>
                  <FilterToggle
                    label="Hide archived"
                    checked={chatFilters.hideArchived}
                    onChange={(v) => updateChatFilters({ hideArchived: v })}
                  />
                  <FilterToggle
                    label="Hide bots"
                    checked={chatFilters.hideBots}
                    onChange={(v) => updateChatFilters({ hideBots: v })}
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => refetch()}
              className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefetching && 'animate-spin')} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                filter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Announcements newsfeed entry */}
      {!isLoading && channels.length > 0 && (
        <AnnouncementsRow channels={channels} active={pathname === '/inbox/announcements'} />
      )}

      {/* Chat list */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex flex-col gap-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-2.5 w-36 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            {search ? 'No results' : 'No conversations'}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {filtered.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                active={pathname === `/inbox/${chat.id}`}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
    >
      <span>{label}</span>
      <div
        className={cn(
          'w-8 h-4 rounded-full relative transition-colors',
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </div>
    </button>
  );
}

function AnnouncementsRow({ channels, active }: { channels: TelegramChat[]; active: boolean }) {
  const totalUnread = channels.reduce((n, c) => n + c.unreadCount, 0);

  return (
    <div className="px-2 py-1.5 border-b border-border shrink-0">
      <Link
        href="/inbox/announcements"
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
          active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
        )}
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Rss className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">Announcements</span>
            {totalUnread > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shrink-0">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {channels.length} channel{channels.length !== 1 ? 's' : ''}
          </p>
        </div>
      </Link>
    </div>
  );
}

function ChatListItem({ chat, active }: { chat: TelegramChat; active: boolean }) {
  const lastDate = chat.lastMessageDate
    ? formatDistanceToNowStrict(new Date(chat.lastMessageDate * 1000), { addSuffix: false })
    : null;

  return (
    <Link
      href={`/inbox/${chat.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
      )}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
        style={{ backgroundColor: chat.avatarColor }}
      >
        {chat.initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate text-foreground">{chat.name}</span>
          {lastDate && (
            <span className="text-xs text-muted-foreground shrink-0">{lastDate}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {chat.lastMessage ?? (chat.isGroup ? 'Group' : '')}
          </span>
          {chat.unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shrink-0">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
        </div>
        {(chat.isArchived || chat.folders.length > 0) && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {chat.isArchived && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                <Archive className="w-2.5 h-2.5" />
                Archived
              </span>
            )}
            {chat.folders.map((folder) => (
              <span key={folder} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent text-accent-foreground">
                <FolderOpen className="w-2.5 h-2.5" />
                {folder}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
