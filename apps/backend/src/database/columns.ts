import { text } from 'drizzle-orm/sqlite-core';

export const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
