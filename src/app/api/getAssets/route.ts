import { Helius } from 'helius-sdk';
import { HELIUS_API_KEY } from '../../env';

export default async function handler(req, res) {
  if (!HELIUS_API_KEY) {return res.status(500).json({ error: 'HELIUS_API_KEY is not set' });}
  const { ownerAddress, compressed, burnt, page } = req.query;
  const helius = new Helius(HELIUS_API_KEY);
  try {
    const response = await helius.rpc.searchAssets({
      ownerAddress,
      compressed: compressed === 'true',
      burnt: burnt === 'true',
      page: parseInt(page, 10)
    });
    const assetInfos = response.items.map(item => ({
      name: String(item?.content?.metadata?.name),
      assetId: item.id,
      state: item?.compression?.compressed,
      image: item?.content?.links?.image,
    }));
    res.status(200).json({ assetInfos: assetInfos.filter(info => info && info.state) });
  } 
  catch (error) {
    console.error("Error in searchAssets API:", error);
    res.status(500).json({ error: error.message });
  }
}