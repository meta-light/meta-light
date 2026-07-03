'use client';

import { useEffect } from 'react';
import { useTelegramStore } from '@/store/telegramStore';

export function useTelegramStream() {
  const { addMessage, chats, setChats } = useTelegramStore();

  useEffect(() => {
    const es = new EventSource('/api/telegram/stream');

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Handle new message updates
        if (data.className === 'UpdateNewMessage' && data.message) {
          const msg = data.message;
          const peerId = msg.peerId;
          let chatId: string | undefined;

          if (peerId?.className === 'PeerUser') chatId = `user-${peerId.userId}`;
          else if (peerId?.className === 'PeerChat') chatId = `chat-${peerId.chatId}`;
          else if (peerId?.className === 'PeerChannel') chatId = `channel-${peerId.channelId}`;

          if (chatId) {
            addMessage(chatId, {
              id: msg.id,
              text: msg.message ?? '',
              date: msg.date,
              isOutgoing: msg.out ?? false,
            });
          }
        }
      } catch {}
    };

    es.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => es.close();
  }, [addMessage]);
}
