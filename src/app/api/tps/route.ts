import { Helius } from 'helius-sdk';
import { HELIUS_API_KEY } from '../../env';

export default async function handler(req, res) {
  if (!HELIUS_API_KEY) {return res.status(500).json({ error: 'HELIUS_API_KEY is not set' });}
  const helius = new Helius(HELIUS_API_KEY);
  try {const tps = await helius.rpc.getCurrentTPS(); res.status(200).json({ tps });} 
  catch (error) {res.status(500).json({ error: error.message });}
}