import React, { useState } from 'react';

const GetHashlist = () => {
  const [collectionAddress, setCollectionAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadLinks, setDownloadLinks] = useState({ owners: null, hashes: null });
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDownloadLinks({ owners: null, hashes: null });
    try {await getAssetsByGroup(collectionAddress);} 
    catch (err) {setError('Error fetching data. Please try again.'); console.error(err);}
    setLoading(false);
  };

  const getAssetsByGroup = async (groupValue) => {
    const response = await fetch(url, {method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({jsonrpc: '2.0', id: 'my-id', method: 'getAssetsByGroup', params: { groupKey: 'collection', groupValue, page: 1, limit: 1000 }})});
    const { result } = await response.json();
    const owners = result.items.map(item => item.ownership.owner);
    const hashes = result.items.map(item => item.id);
    const ownersBlob = new Blob([JSON.stringify(owners, null, 2)], { type: 'application/json' });
    const hashesBlob = new Blob([JSON.stringify(hashes, null, 2)], { type: 'application/json' });
    setDownloadLinks({owners: URL.createObjectURL(ownersBlob), hashes: URL.createObjectURL(hashesBlob)});
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">Get Hashlist and Owners</h1>
      <form onSubmit={handleSubmit} className="mb-4">
        <input type="text" value={collectionAddress} onChange={(e) => setCollectionAddress(e.target.value)} placeholder="Enter Collection Address" className="w-full px-3 py-2 border rounded-md" required />
        <button type="submit" className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600" disabled={loading}>{loading ? 'Loading...' : 'Get Data'}</button>
      </form>
      {error && <p className="text-red-500">{error}</p>}
      {downloadLinks.owners && downloadLinks.hashes && (
        <div>
          <p className="mb-2">Data fetched successfully. Click to download:</p>
          <a href={downloadLinks.owners} download="owners.json" className="block mb-2 text-blue-500 hover:underline">Download Owners List</a>
          <a href={downloadLinks.hashes} download="hashes.json" className="block text-blue-500 hover:underline">Download Hashlist</a>
        </div>
      )}
    </div>
  );
};

export default GetHashlist;