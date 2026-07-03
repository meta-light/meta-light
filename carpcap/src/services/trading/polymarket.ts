import { PolymarketUS } from 'polymarket-us';
// https://docs.polymarket.us/sdks/typescript/events

const client = new PolymarketUS({keyId: process.env.POLYMARKET_KEY_ID, secretKey: process.env.POLYMARKET_SECRET_KEY, timeout: 30000});

async function test() {
    const events = await client.events.list({ limit: 10, active: true });
    const event = await client.events.retrieveBySlug('super-bowl-2025');
    const markets = await client.markets.list({ limit: 10 });
    const market = await client.markets.retrieveBySlug('btc-100k');
    const book = await client.markets.book('btc-100k');
    const bbo = await client.markets.bbo('btc-100k');
    const results = await client.search.query({ query: 'bitcoin' });
    const series = await client.series.list();
    const sports = await client.sports.list();
}