import React, { useState, useEffect } from 'react';

export default function SolanaUtils() {
  const [ownerAddress, setOwnerAddress] = useState("9cpGSYpRthttGo3QvidzWbd3nseHP3fGSURQvqsih7dw");
  const [tps, setTPS] = useState(null);
  const [assetInfoList, setAssetInfoList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {getTPS();}, []);
  const getTPS = async () => {try {const currentTPS = await fetch('/api/helius-util'); setTPS(await currentTPS.json());}  catch (err) {setError(`Error getting TPS: ${err.message}`);}};

  const searchAssets = async () => {
    setLoading(true);
    setError(null);
    setAssetInfoList([]);
    try {
      const response = await fetch('/api/searchAssets', {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({ ownerAddress, compressed: true, page: 1 }),});
      const ids = await response.json();
      const infoList = [];
      for (const id of ids) {const info = await getAssetInfo(id); if (info.state) {infoList.push(info);}}
      setAssetInfoList(infoList);
    } 
    catch (err) {setError(`Error searching assets: ${err.message}`);}
    setLoading(false);
  };

  const getAssetInfo = async (id) => {
    const response = await fetch(`/api/getAsset/${id}`);
    const asset = await response.json();
    const name = asset.content.metadata.name;
    const state = asset.compression.compressed;
    const image = asset.content.links.image;
    const assetId = asset.id;
    return { name, assetId, state, image };
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Solana Utils</h2>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Current TPS</h3>
        {tps !== null ? (<p>Solana TPS: {tps}</p>) : (<p>Loading TPS...</p>)}
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Search Assets</h3>
        <input type="text" value={ownerAddress} onChange={(e) => setOwnerAddress(e.target.value)} className="w-full px-3 py-2 border rounded-md mb-2 text-black" placeholder="Owner Address" />
        <button onClick={searchAssets} className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600" disabled={loading}>{loading ? 'Searching...' : 'Search Assets'}</button>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      {assetInfoList.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Asset Information</h3>
          <div className="grid grid-cols-2 gap-4">
            {assetInfoList.map((asset) => (
              <div key={asset.assetId} className="border p-2 rounded">
                <img src={asset.image} alt={asset.name} className="w-full h-32 object-cover mb-2" />
                <p><strong>Name:</strong> {asset.name}</p>
                <p><strong>ID:</strong> {asset.assetId}</p>
                <p><strong>Compressed:</strong> {asset.state ? 'Yes' : 'No'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}