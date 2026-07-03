import { ChatList } from '@/components/inbox/ChatList';
import { StreamProvider } from '@/components/inbox/StreamProvider';

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <StreamProvider>
      <div className="flex h-full">
        <div className="w-80 shrink-0 border-r border-border overflow-hidden flex flex-col">
          <ChatList />
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </StreamProvider>
  );
}
