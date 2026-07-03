'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { RefreshCw, Rss } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnnouncementPost } from '@/app/api/telegram/announcements/route';

export default function AnnouncementsPage() {
  const { data, isLoading, refetch, isRefetching } = useQuery<{ posts: AnnouncementPost[] }>({
    queryKey: ['announcements'],
    queryFn: () => fetch('/api/telegram/announcements').then((r) => r.json()),
  });

  const posts = data?.posts ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Rss className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Announcements</h2>
          {posts.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {posts.length} posts
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin')} />
        </button>
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex flex-col divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-7 h-7 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-12 ml-auto" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Rss className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No channel posts</p>
            <p className="text-xs text-muted-foreground">Subscribe to channels to see their posts here</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function PostCard({ post }: { post: AnnouncementPost }) {
  const date = new Date(post.date * 1000);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffHours = diffMs / 3600000;

  const timeLabel =
    diffHours < 1
      ? `${Math.max(1, Math.floor(diffMs / 60000))}m ago`
      : diffHours < 24
      ? `${Math.floor(diffHours)}h ago`
      : format(date, 'MMM d');

  return (
    <div className="px-5 py-4 hover:bg-muted/30 transition-colors">
      {/* Channel row */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
          style={{ backgroundColor: post.channelColor }}
        >
          {post.channelInitials}
        </div>
        <span className="text-xs font-semibold text-foreground truncate">{post.channelName}</span>
        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{timeLabel}</span>
      </div>

      {/* Body */}
      {post.mediaDescription && !post.text && (
        <p className="text-sm text-muted-foreground italic">{post.mediaDescription}</p>
      )}
      {post.text && (
        post.html
          ? <p
              className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-80 [&_strong]:font-semibold [&_em]:italic [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:font-mono [&_pre]:text-[0.85em] [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          : <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{post.text}</p>
      )}
      {post.mediaDescription && post.text && (
        <p className="text-xs text-muted-foreground mt-1">{post.mediaDescription}</p>
      )}
    </div>
  );
}
