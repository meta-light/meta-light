import React, { useState } from 'react';

interface DownloadLinks {owners: string | null; hashes: string | null;}

const GetHashlist = () => {
  const [collectionAddress, setCollectionAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinks>({ owners: null, hashes: null });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDownloadLinks({ owners: null, hashes: null });
    try {await getAssetsByGroup(collectionAddress);} 
    catch (err) {setError('Error fetching data. Please try again.'); console.error(err);}
    setLoading(false);
  };
  const getAssetsByGroup = async (groupValue: string) => {
    const response = await fetch('/api/hashlist', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ collectionAddress: groupValue })});
    if (!response.ok) {const errorData = await response.json(); throw new Error(errorData.error || 'Failed to fetch hashlist');}
    const data = await response.json();
    const ownersBlob = new Blob([JSON.stringify(data.owners, null, 2)], { type: 'application/json' });
    const hashesBlob = new Blob([JSON.stringify(data.hashes, null, 2)], { type: 'application/json' });
    setDownloadLinks({owners: URL.createObjectURL(ownersBlob), hashes: URL.createObjectURL(hashesBlob)});
  };
  return (
    <div className="terminal-tool">
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block text-green-400 text-sm font-mono mb-2">&gt; Enter Collection Address:</label>
          <input 
            type="text" 
            value={collectionAddress} 
            onChange={(e) => setCollectionAddress(e.target.value)} 
            placeholder="Collection mint address..." 
            className="w-full px-3 py-2 bg-gray-800 border border-green-600 rounded text-green-400 font-mono placeholder-green-700 focus:outline-none focus:border-green-400"
            required 
          />
        </div>
        <button 
          type="submit" 
          className="w-full px-4 py-2 bg-green-900 text-green-400 border border-green-600 rounded font-mono hover:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-600 transition-colors"
          disabled={loading}
        >
          {loading ? '[PROCESSING...]' : '[EXECUTE] Get Hashlist & Owners'}
        </button>
      </form>
      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-600 rounded">
          <p className="text-red-400 font-mono text-sm">
            <span className="text-red-600">ERROR:</span> {error}
          </p>
        </div>
      )}
      {downloadLinks.owners && downloadLinks.hashes && (
        <div className="space-y-4">
          <div className="text-green-400 font-mono mb-3">
            <span className="text-green-600">&gt; DATA READY FOR DOWNLOAD:</span>
          </div>
          <div className="bg-gray-800 border border-green-600 rounded p-4 space-y-3">
            <p className="text-green-400 font-mono text-sm mb-4">
              <span className="text-green-600">STATUS:</span> Data fetched successfully. Click to download files:
            </p>
            <div className="space-y-2">
              <a 
                href={downloadLinks.owners} 
                download="owners.json" 
                className="block px-3 py-2 bg-green-900 text-green-400 border border-green-600 rounded font-mono hover:bg-green-800 transition-colors text-center"
              >
                [DOWNLOAD] Owners List (JSON)
              </a>
              <a 
                href={downloadLinks.hashes} 
                download="hashes.json" 
                className="block px-3 py-2 bg-green-900 text-green-400 border border-green-600 rounded font-mono hover:bg-green-800 transition-colors text-center"
              >
                [DOWNLOAD] Hashlist (JSON)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GetHashlist;