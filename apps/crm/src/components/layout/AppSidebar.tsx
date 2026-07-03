'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MessageSquare, Users, KanbanSquare, Settings, Send } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { href: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { href: '/contacts', icon: Users, label: 'Contacts' },
  { href: '/pipeline', icon: KanbanSquare, label: 'Pipeline' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <aside className="flex flex-col items-center w-16 h-full bg-sidebar border-r border-sidebar-border py-4 gap-1 shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary mb-4">
          <Send className="w-5 h-5 text-primary-foreground" />
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Tooltip key={href}>
                <TooltipTrigger render={
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-xl transition-colors',
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                } />
                <TooltipContent side="right" sideOffset={8}>
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
