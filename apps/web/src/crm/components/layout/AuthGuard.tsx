'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'authed' | 'redirect'>('loading');

  useEffect(() => {
    fetch('/api/telegram/auth')
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.replace('/auth');
          setStatus('redirect');
        } else {
          setStatus('authed');
        }
      })
      .catch(() => {
        router.replace('/auth');
        setStatus('redirect');
      });
  }, [router]);

  // Render nothing on server / first paint to avoid hydration mismatch
  if (status === 'loading') {
    return (
      <div suppressHydrationWarning className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  if (status === 'redirect') return null;

  return <>{children}</>;
}
