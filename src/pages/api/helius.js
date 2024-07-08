import { Helius } from 'helius-sdk';
import { pRateLimit } from "p-ratelimit";
const heliusAPI = process.env.HELIUS_KEY;
const HeliusKey = new Helius(heliusAPI);

const heliusLimit = pRateLimit({
  interval: 60000, // 60000 ms == 1 minute
  rate: 120, // 120 API calls per interval
  concurrency: 10, // no more than 10 running at once
  maxDelay: 2000, // an API call delayed > 2 sec is rejected
});

export default async function handler(req, res) {
  const { action, ownerAddress } = req.query;
  try {
    if (action === 'getTPS') {
      const tps = await HeliusKey.rpc.getCurrentTPS();
      res.status(200).json({ tps });
    } else if (action === 'searchAssets') {
      if (!ownerAddress) {return res.status(400).json({ error: 'ownerAddress is required' });}
      const response = await heliusLimit(() => HeliusKey.rpc.searchAssets({ ownerAddress, compressed: true, burnt: false, page: 1 }));
      const assetInfos = response.items.map(item => ({
        name: String(item.content.metadata.name),
        assetId: item.id,
        state: item.compression.compressed,
        image: item.content.links.image,
      }));
      res.status(200).json(assetInfos.filter(info => info && info.state));
    } else {res.status(400).json({ error: 'Invalid action' });}
  } catch (error) {
    console.error("Error in API handler:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}