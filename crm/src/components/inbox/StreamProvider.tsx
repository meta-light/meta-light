'use client';

import { useTelegramStream } from '@/hooks/useTelegramStream';

export function StreamProvider({ children }: { children: React.ReactNode }) {
  useTelegramStream();
  return <>{children}</>;
}
