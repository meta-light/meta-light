import { eq } from 'drizzle-orm';
import { closeDatabase, connectDatabase, getDb, queryObjects } from './client';
import { prices } from './schema';

async function main() {
  await connectDatabase();
  const token = `ready-${Date.now()}`;
  await getDb().insert(prices).values({
    timestamp: new Date(),
    token,
    address: 'ready-check',
    price: 1,
    source: 'manual',
    chain: 'SOLANA',
  });
  const [row] = await getDb().select().from(prices).where(eq(prices.token, token)).limit(1);
  if (!row) throw new Error('D1 insert did not round-trip');
  await getDb().delete(prices).where(eq(prices.id, row.id));
  const tables = await queryObjects<{ count: number }>(
    "select count(*) as count from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '\\_cf\\_%' escape '\\'",
  );
  console.log(`D1 ready. Tables: ${Number(tables[0]?.count ?? 0)}`);
  await closeDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
