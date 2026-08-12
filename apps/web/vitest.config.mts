import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The /strudel suites are pure logic (notation, chunks, timeline) -- no DOM.
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    server: {
      deps: {
        // @strudel/* would otherwise be externalized and resolved by node,
        // which bypasses the @kabelsalat/web alias below.
        inline: [/@strudel\//],
      },
    },
  },
  resolve: {
    alias: {
      // @strudel/core's repl.mjs imports SalatRepl from '@kabelsalat/web',
      // whose node build doesn't expose that named export. See the stub.
      '@kabelsalat/web': fileURLToPath(
        new URL('./src/tests/stubs/kabelsalat-web.ts', import.meta.url),
      ),
      // Mirrors the "@/*" -> "./src/*" mapping in tsconfig.json. The trailing
      // slash keeps this from swallowing scoped packages like @kabelsalat/web.
      '@/': fileURLToPath(new URL('./src/', import.meta.url)),
    },
  },
});
