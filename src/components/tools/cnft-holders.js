import React, { useState } from 'react';
export default function CNFTHolders() {
  const [collectionAddress, setCollectionAddress] = useState('');
  const [uniqueOwners, setUniqueOwners] = useState([]);
  const [loading, setLoading] = useState(false);

  const getAssetsByGroup = async () => {
    setLoading(true);
    const url = `https://mainnet.helius-rpc.com/?api-key=<API_KEY>`;
    let page = 1;
    let assetList = [];
    while (page) {
      const response = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({jsonrpc: "2.0", id: "my-id", method: "getAssetsByGroup", params: {groupKey: "collection", groupValue: collectionAddress, page: page, limit: 1000,},}),});
      const { result = [] } = await response.json();
      assetList.push(...result.items);
      if (result.total !== 1000) {page = false;} else {page++;}
    }
    const rawList = assetList.map(item => item.ownership.owner);
    const uniqueOwnersSet = new Set(rawList);
    setUniqueOwners(Array.from(uniqueOwnersSet));
    setLoading(false);
  };
  return (
    <div>
      <input type="text" value={collectionAddress} onChange={(e) => setCollectionAddress(e.target.value)} placeholder="Enter Collection Address" className="w-full px-3 py-2 border rounded-md mb-2 text-black"/>
      <button onClick={getAssetsByGroup} disabled={loading} className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">{loading ? 'Loading...' : 'Get Unique Owners'}</button>
      {uniqueOwners.length > 0 && (
        <div>
          <h3>Unique Owners: {uniqueOwners.length}</h3>
          <ul>{uniqueOwners.map((owner, index) => (<li key={index}>{owner}</li>))}</ul>
        </div>
      )}
    </div>
  );
}