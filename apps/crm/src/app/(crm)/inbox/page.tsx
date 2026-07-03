import { ChatList } from '@/components/inbox/ChatList';

export default function InboxPage() {
  return (
    <div className="flex h-full">
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div className="flex flex-col items-center gap-3 max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="font-medium text-foreground">Select a conversation</h2>
          <p className="text-sm text-muted-foreground">Choose a chat from the list to start messaging</p>
        </div>
      </div>
    </div>
  );
}
