import { Helius } from 'helius-sdk';
const helius = new Helius(process.env.HELIUS_KEY);

export default async function handler(req, res) {
  const { method, body } = req;
  switch (method) {
    case 'GET':
      try {
        const tps = await helius.rpc.getCurrentTPS();
        res.status(200).json(tps);
      } catch (error) {
        res.status(500).json({ error: 'Error fetching TPS' });
      }
      break;

    case 'POST':
      try {
        const { ownerAddress, compressed, page } = body;
        const assets = await helius.rpc.searchAssets({ ownerAddress, compressed, page });
        res.status(200).json(assets);
      } catch (error) {
        res.status(500).json({ error: 'Error searching assets' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}