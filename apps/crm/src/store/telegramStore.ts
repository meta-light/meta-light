import { create } from 'zustand';
import type { TelegramChat, TelegramMessage } from '@/lib/telegram/types';

interface TelegramState {
  chats: TelegramChat[];
  activeChatId: string | null;
  messages: Record<string, TelegramMessage[]>;
  loading: boolean;
  setChats: (chats: TelegramChat[]) => void;
  setActiveChat: (id: string | null) => void;
  setMessages: (chatId: string, messages: TelegramMessage[]) => void;
  addMessage: (chatId: string, message: TelegramMessage) => void;
  setLoading: (loading: boolean) => void;
  updateUnread: (chatId: string, count: number) => void;
}

export const useTelegramStore = create<TelegramState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  loading: false,

  setChats: (chats) => set({ chats }),
  setActiveChat: (id) => set({ activeChatId: id }),
  setMessages: (chatId, messages) =>
    set((state) => ({ messages: { ...state.messages, [chatId]: messages } })),
  addMessage: (chatId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] ?? []), message],
      },
    })),
  setLoading: (loading) => set({ loading }),
  updateUnread: (chatId, count) =>
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: count } : c)),
    })),
}));
