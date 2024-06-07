import { Helius } from 'helius-sdk';

export default async function handler(req, res) {
  const heliusKey = process.env.HELIUS_KEY;
  const helius = new Helius(heliusKey);

  try {
    const tps = await helius.rpc.getCurrentTPS();
    res.status(200).json({ tps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}