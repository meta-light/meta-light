'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Send,
  RefreshCw,
  LogOut,
  Tag,
  Plus,
  Puzzle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#3b82f6', '#06b6d4',
];

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  const { data: tagsData, isLoading: tagsLoading } = useQuery<{
    tags: { id: string; name: string; color: string }[];
  }>({
    queryKey: ['tags'],
    queryFn: () => fetch('/api/tags').then((r) => r.json()),
  });

  const sync = useMutation({
    mutationFn: () => fetch('/api/telegram/sync', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const logout = useMutation({
    mutationFn: () =>
      fetch('/api/telegram/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      }),
    onSuccess: () => router.replace('/auth'),
  });

  const createTag = useMutation({
    mutationFn: () =>
      fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: newTagName, color: newTagColor }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
    },
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your CRM</p>
      </div>

      <div className="flex flex-col gap-6 p-6 max-w-2xl">
        {/* Telegram */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Send className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Telegram</h2>
              <p className="text-xs text-muted-foreground">Manage your Telegram connection</p>
            </div>
          </div>
          <Separator className="mb-4" />
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Contact Sync</p>
                <p className="text-xs text-muted-foreground">
                  Pull your latest Telegram contacts into the CRM
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
                className="gap-1.5"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', sync.isPending && 'animate-spin')} />
                {sync.isPending ? 'Syncing...' : 'Sync now'}
              </Button>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Sign out</p>
                <p className="text-xs text-muted-foreground">Disconnect your Telegram account</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </Button>
            </div>
          </div>
        </Card>

        {/* Tags */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Tag className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Tags</h2>
              <p className="text-xs text-muted-foreground">Manage your contact tags</p>
            </div>
          </div>
          <Separator className="mb-4" />

          {/* Create tag */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTagName.trim()) createTag.mutate();
              }}
            />
            <div className="flex gap-1">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-transform',
                    newTagColor === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewTagColor(color)}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="h-8 gap-1"
              disabled={!newTagName.trim() || createTag.isPending}
              onClick={() => createTag.mutate()}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>

          {/* Tag list */}
          {tagsLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (tagsData?.tags ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No tags yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(tagsData?.tags ?? []).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-white font-medium"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Integrations stub */}
        <Card className="p-5 opacity-70">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <Puzzle className="w-4.5 h-4.5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Integrations</h2>
              <p className="text-xs text-muted-foreground">Coming soon: Notion, Gmail, and more</p>
            </div>
          </div>
          <Separator className="mb-4" />
          <div className="flex flex-col gap-3">
            {['Notion', 'Gmail', 'Slack'].map((name) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-sm">{name}</span>
                <Button variant="outline" size="sm" disabled>
                  Coming soon
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* API credentials info */}
        <Card className="p-5">
          <h2 className="font-semibold text-sm mb-1">API Configuration</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Set these environment variables in <code className="font-mono bg-muted px-1 rounded">.env.local</code>
          </p>
          <div className="flex flex-col gap-2 font-mono text-xs bg-muted rounded-lg p-3">
            <div>
              <span className="text-muted-foreground">TELEGRAM_API_ID</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-foreground">your_api_id</span>
            </div>
            <div>
              <span className="text-muted-foreground">TELEGRAM_API_HASH</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-foreground">your_api_hash</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Get these from{' '}
            <span className="font-medium">my.telegram.org/apps</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
