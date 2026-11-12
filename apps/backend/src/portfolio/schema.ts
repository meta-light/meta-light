import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { id } from '../database/columns';

export const portfolioWallets = sqliteTable(
  'portfolio_wallets',
  {
    id: id(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    netuid: integer('netuid').notNull(),
    subnetName: text('subnet_name').notNull(),
  },
  (table) => [
    uniqueIndex('portfolio_wallets_address_netuid_idx').on(
      table.address,
      table.netuid,
    ),
  ],
);

export const portfolioStates = sqliteTable('portfolio_states', {
  key: text('key').primaryKey(),
  lastSnapshot: text('last_snapshot', { mode: 'json' }),
});
