export interface TelegramChat {
  id: string;
  name: string;
  username?: string;
  phone?: string;
  isGroup: boolean;
  isChannel: boolean;
  isBot: boolean;
  isArchived: boolean;
  folders: string[];
  unreadCount: number;
  lastMessage?: string;
  lastMessageDate?: number;
  avatarColor: string;
  initials: string;
}

export interface TelegramMessage {
  id: number;
  text: string;
  html?: string;
  date: number;
  fromId?: string;
  fromName?: string;
  isOutgoing: boolean;
  mediaType?: 'photo' | 'video' | 'document' | 'sticker' | 'audio';
  mediaDescription?: string;
}

export interface SendMessagePayload {
  chatId: string;
  message: string;
}
