'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageSquare, RefreshCw, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContactRow {
  id: string;
  telegramId: number;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  phone?: string | null;
  avatarColor: string;
  pipelineStageId?: string | null;
  lastContactedAt?: number | null;
  contactTags: { tag: { id: string; name: string; color: string } }[];
}

export default function ContactsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ contacts: ContactRow[] }>({
    queryKey: ['contacts', search],
    queryFn: () =>
      fetch(`/api/contacts?search=${encodeURIComponent(search)}`).then((r) => r.json()),
  });

  const sync = useMutation({
    mutationFn: () => fetch('/api/telegram/sync', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const contacts = data?.contacts ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">Contacts</h1>
            <p className="text-sm text-muted-foreground">{contacts.length} contacts</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="gap-1.5"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', sync.isPending && 'animate-spin')} />
              Sync Telegram
            </Button>
          </div>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex flex-col divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-2.5 w-20 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No contacts yet</p>
            <p className="text-xs text-muted-foreground">Sync your Telegram contacts to get started</p>
            <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
              Sync now
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header row */}
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
              <div className="w-9" />
              <div>Name</div>
              <div>Username / Phone</div>
              <div>Tags</div>
              <div className="w-8" />
            </div>
            {contacts.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ContactRow({ contact }: { contact: ContactRow }) {
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-6 py-3 items-center hover:bg-muted/40 transition-colors border-b border-border/50 group">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
        style={{ backgroundColor: contact.avatarColor }}
      >
        {fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'}
      </div>

      {/* Name */}
      <div>
        <p className="text-sm font-medium leading-tight">{fullName || 'Unknown'}</p>
        {contact.lastContactedAt && (
          <p className="text-xs text-muted-foreground">
            Last: {format(new Date(contact.lastContactedAt), 'MMM d')}
          </p>
        )}
      </div>

      {/* Username / Phone */}
      <div className="flex flex-col gap-0.5">
        {contact.username && (
          <span className="text-sm text-muted-foreground">@{contact.username}</span>
        )}
        {contact.phone && (
          <span className="text-xs text-muted-foreground">{contact.phone}</span>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {contact.contactTags.slice(0, 3).map(({ tag }) => (
          <span
            key={tag.id}
            className="px-1.5 py-0.5 rounded-full text-[10px] text-white font-medium"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
          </span>
        ))}
        {contact.contactTags.length > 3 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
            +{contact.contactTags.length - 3}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {contact.telegramId && (
          <Link href={`/inbox/user-${contact.id.replace('tg-', '')}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MessageSquare className="w-3.5 h-3.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
