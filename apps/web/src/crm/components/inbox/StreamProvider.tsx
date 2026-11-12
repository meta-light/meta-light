'use client';

import { useTelegramStream } from '@/crm/hooks/useTelegramStream';

export function StreamProvider({ children }: { children: React.ReactNode }) {
  useTelegramStream();
  return <>{children}</>;
}
