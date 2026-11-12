import { MessageThread } from '@/crm/components/inbox/MessageThread';

export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  return <MessageThread chatId={chatId} />;
}
