import type { Metadata } from 'next';
import { IBM_Plex_Mono, Unbounded } from 'next/font/google';
import './globals.css';

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
});

const unbounded = Unbounded({
  weight: ['500', '700', '900'],
  subsets: ['latin'],
  variable: '--font-unbounded',
});

export const metadata: Metadata = {
  title: 'Strudel Kitchen',
  description: 'Build songs with Strudel code and visual editors',
};

/**
 * Nested layout: the <html>/<body> shell (and ProviderWrapper) come from the
 * root layout at src/app/layout.tsx, so this only supplies the font variables
 * and the .strudel-scope wrapper that all of globals.css hangs off.
 */
export default function StrudelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${plexMono.variable} ${unbounded.variable} strudel-scope min-h-dvh flex flex-col antialiased`}
    >
      {children}
    </div>
  );
}
