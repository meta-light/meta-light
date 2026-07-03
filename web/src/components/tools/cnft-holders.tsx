import React, { useState } from 'react';

export default function CNFTHolders() {
  const [collectionAddress, setCollectionAddress] = useState('');
  const [uniqueOwners, setUniqueOwners] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const getAssetsByGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cnft-holders', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ collectionAddress })});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch CNFT holders');
      }
      const data = await response.json();
      setUniqueOwners(data.uniqueOwners);
    } 
    catch (err) {
      setError('Error fetching CNFT holders. Please try again.');
      console.error(err);
    }
    setLoading(false);
  };
  return (
    <div className="terminal-tool">
      <div className="mb-4">
        <label className="block text-green-400 text-sm font-mono mb-2">&gt; Enter Collection Address:</label>
        <input 
          type="text" 
          value={collectionAddress} 
          onChange={(e) => setCollectionAddress(e.target.value)} 
          placeholder="Collection mint address..." 
          className="w-full px-3 py-2 bg-gray-800 border border-green-600 rounded text-green-400 font-mono placeholder-green-700 focus:outline-none focus:border-green-400"
        />
      </div>
      <button 
        onClick={getAssetsByGroup} 
        disabled={loading} 
        className="w-full px-4 py-2 bg-green-900 text-green-400 border border-green-600 rounded font-mono hover:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-600 transition-colors"
      >
        {loading ? '[PROCESSING...]' : '[EXECUTE] Get Unique Owners'}
      </button>
      {error && (
        <div className="mt-4 p-3 bg-red-900 border border-red-600 rounded">
          <p className="text-red-400 font-mono text-sm">
            <span className="text-red-600">ERROR:</span> {error}
          </p>
        </div>
      )}
      {uniqueOwners.length > 0 && (
        <div className="mt-6">
          <div className="text-green-400 font-mono mb-3">
            <span className="text-green-600">&gt; OUTPUT:</span> Found {uniqueOwners.length} unique owners
          </div>
          <div className="bg-gray-800 border border-green-600 rounded p-4 max-h-96 overflow-y-auto">
            <ul className="space-y-1">
              {uniqueOwners.map((owner, index) => (
                <li key={index} className="font-mono text-green-400 text-sm border-b border-green-900 pb-1">
                  {String(index + 1).padStart(3, '0')}: {owner}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}