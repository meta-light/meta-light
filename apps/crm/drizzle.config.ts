import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: `file:${process.env.DB_PATH ?? './crm.db'}`,
  },
} satisfies Config;
