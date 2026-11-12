import { desc, eq } from 'drizzle-orm';
import type { NewsItem } from './model';
import { connectDatabase, getDb } from '../database/client';
import { newsItems } from './schema';

type NewsRow = typeof newsItems.$inferSelect;

function toNews(row: NewsRow): NewsItem {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    url: row.url ?? '',
    publishedAt: row.publishedAt,
    description: row.description ?? undefined,
    content: row.content ?? undefined,
    type: row.type as NewsItem['type'],
    impact: row.impact as NewsItem['impact'],
    coin: row.coin ?? undefined,
    priority: row.priority ?? undefined,
    kind: row.kind ?? undefined,
    votes: row.votes ?? undefined,
    sourceType: row.sourceType as NewsItem['sourceType'],
    scrapedAt: row.scrapedAt,
  };
}

export async function findNewsByUrl(url: string): Promise<NewsItem | null> {
  await connectDatabase();
  const [row] = await getDb()
    .select()
    .from(newsItems)
    .where(eq(newsItems.url, url))
    .limit(1);
  return row ? toNews(row) : null;
}

export async function insertNews(item: Partial<NewsItem>): Promise<void> {
  if (
    !item.id ||
    !item.title ||
    !item.source ||
    !item.publishedAt ||
    !item.sourceType
  ) {
    throw new Error('News item is missing required fields');
  }
  await connectDatabase();
  await getDb()
    .insert(newsItems)
    .values({
      id: item.id,
      title: item.title,
      source: item.source,
      url: item.url,
      publishedAt: item.publishedAt,
      description: item.description,
      content: item.content,
      type: item.type ?? 'news',
      impact: item.impact ?? 'medium',
      coin: item.coin,
      priority: item.priority,
      kind: item.kind,
      votes: item.votes,
      sourceType: item.sourceType,
      scrapedAt: item.scrapedAt ?? new Date(),
      updatedAt: new Date(),
    });
}

export async function updateNewsByUrl(
  url: string,
  votes: NewsItem['votes'],
  scrapedAt: Date,
): Promise<void> {
  await connectDatabase();
  await getDb()
    .update(newsItems)
    .set({ votes, scrapedAt, updatedAt: new Date() })
    .where(eq(newsItems.url, url));
}

export async function listRecentNews(limit = 30): Promise<NewsItem[]> {
  await connectDatabase();
  const rows = await getDb()
    .select()
    .from(newsItems)
    .orderBy(desc(newsItems.publishedAt))
    .limit(limit);
  return rows.map(toNews);
}
