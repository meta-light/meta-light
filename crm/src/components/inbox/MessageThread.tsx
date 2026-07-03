'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTelegramStore } from '@/store/telegramStore';
import { useCrmStore } from '@/store/crmStore';
import type { TelegramMessage } from '@/lib/telegram/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Send, UserCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContactPanel } from '@/components/crm/ContactPanel';
import { Skeleton } from '@/components/ui/skeleton';

export function MessageThread({ chatId }: { chatId: string }) {
  const { messages, setMessages, chats, setActiveChat } = useTelegramStore();
  const { contactPanelOpen, setContactPanelOpen, setSelectedContact } = useCrmStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chat = chats.find((c) => c.id === chatId);

  // Resolve contact ID from chat
  const contactId = chatId.startsWith('user-') ? `tg-${chatId.slice(5)}` : null;

  useEffect(() => {
    setActiveChat(chatId);
    if (contactId) setSelectedContact(contactId);
    return () => setActiveChat(null);
  }, [chatId, contactId, setActiveChat, setSelectedContact]);

  const { isLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () =>
      fetch(`/api/telegram/messages/${chatId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.messages) setMessages(chatId, d.messages);
          return d;
        }),
  });

  const threadMessages = messages[chatId] ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;

    const optimisticMsg: TelegramMessage = {
      id: Date.now(),
      text: text.trim(),
      date: Math.floor(Date.now() / 1000),
      isOutgoing: true,
    };

    setMessages(chatId, [...threadMessages, optimisticMsg]);
    const msg = text.trim();
    setText('');
    setSending(true);

    try {
      await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: msg }),
      });
    } catch {}
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  return (
    <div className="flex h-full">
      {/* Chat column */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {chat && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                style={{ backgroundColor: chat.avatarColor }}
              >
                {chat.initials}
              </div>
            )}
            <div>
              <h2 className="font-medium text-sm leading-tight">
                {chat?.name ?? chatId}
              </h2>
              {chat?.username && (
                <p className="text-xs text-muted-foreground">@{chat.username}</p>
              )}
            </div>
          </div>
          {contactId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setContactPanelOpen(!contactPanelOpen)}
              className="gap-1.5"
            >
              <UserCircle className="w-4 h-4" />
              <span className="text-xs">CRM</span>
              <ChevronRight
                className={cn(
                  'w-3 h-3 transition-transform',
                  contactPanelOpen && 'rotate-180'
                )}
              />
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0 px-4 py-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                  <Skeleton className={cn('h-10 rounded-2xl', i % 2 === 0 ? 'w-48' : 'w-36')} />
                </div>
              ))}
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No messages yet
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {threadMessages.map((msg, i) => {
                const prev = threadMessages[i - 1];
                const showDate =
                  !prev ||
                  new Date(msg.date * 1000).toDateString() !==
                    new Date(prev.date * 1000).toDateString();

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex items-center justify-center my-3">
                        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          {format(new Date(msg.date * 1000), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    <MessageBubble msg={msg} />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Compose */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message... (Enter to send)"
              rows={1}
              className="resize-none min-h-[40px] max-h-32 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!text.trim() || sending}
              className="shrink-0 h-10 w-10"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* CRM Panel */}
      {contactId && contactPanelOpen && (
        <div className="w-72 shrink-0 border-l border-border overflow-hidden">
          <ContactPanel contactId={contactId} />
        </div>
      )}
    </div>
  );
}

const URL_REGEX = /https?:\/\/[^\s<>"]+/g;

function MessageText({ text, outgoing }: { text: string; outgoing: boolean }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <a
        key={match.index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('underline underline-offset-2', outgoing ? 'text-primary-foreground/80 hover:text-primary-foreground' : 'text-primary hover:text-primary/80')}
      >
        {match[0]}
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function MessageBubble({ msg }: { msg: TelegramMessage }) {
  const time = format(new Date(msg.date * 1000), 'HH:mm');

  return (
    <div className={cn('flex', msg.isOutgoing ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed',
          msg.isOutgoing
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        )}
      >
        {!msg.isOutgoing && msg.fromName && (
          <p className="text-xs font-medium text-primary mb-1">{msg.fromName}</p>
        )}
        {msg.mediaDescription && !msg.text && (
          <p className="italic">{msg.mediaDescription}</p>
        )}
        {msg.text && (
          msg.html
            ? <p className="whitespace-pre-wrap break-words [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-80 [&_strong]:font-semibold [&_em]:italic [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:bg-black/10 [&_code]:px-1 [&_code]:rounded [&_pre]:font-mono [&_pre]:text-[0.85em] [&_pre]:whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.html }} />
            : <p className="whitespace-pre-wrap break-words"><MessageText text={msg.text} outgoing={msg.isOutgoing} /></p>
        )}
        {msg.mediaDescription && msg.text && (
          <p className="text-xs opacity-70 mt-0.5">{msg.mediaDescription}</p>
        )}
        <p
          className={cn(
            'text-[10px] mt-1 text-right',
            msg.isOutgoing ? 'text-primary-foreground/60' : 'text-muted-foreground'
          )}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
