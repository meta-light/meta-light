import React, { useState } from 'react';

export default function SnapshotTool() {
  const [groupValue, setGroupValue] = useState('');
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = () => {
    if (!groupValue.trim()) {setError('Please enter a collection address'); return;}
    setProcessing(true);
    setError(null);
    setStatus('Initializing snapshot process...');
    generateSnapshot(groupValue);
  };
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {setGroupValue(event.target.value); if (error) setError(null);};
  const generateSnapshot = async (collectionAddress: string) => {
    try {
      setStatus('Fetching collection assets...');
      const response = await fetch('/api/snapshot', {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({ collectionAddress })});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate snapshot');
      }
      const result = await response.json();
      if (result.success) {
        setStatus(`✓ Success! Processed ${result.uniqueOwnerCount} unique owners from ${result.totalAssets} assets`);
        if (result.downloadPath) {
          const a = document.createElement('a');
          a.href = result.downloadPath;
          a.download = 'uniqueOwners.json';
          a.click();
        } 
        else {
          const blob = new Blob([JSON.stringify(result.uniqueOwners, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'uniqueOwners.json';
          a.click();
          URL.revokeObjectURL(url);
        }
      } 
      else {setStatus(`✗ Error: Snapshot generation failed`);}
    } 
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error generating snapshot: ${errorMessage}`);
      setStatus('✗ Snapshot generation failed');
      console.error(err);
    }
    setProcessing(false);
  };
  return (
    <div className="terminal-tool">
      <div className="mb-4">
        <label className="block text-green-400 text-sm font-mono mb-2">
          &gt; Enter Collection Address for snapshot:
        </label>
        <input 
          type="text" 
          value={groupValue} 
          onChange={handleInputChange} 
          placeholder="Collection mint address..." 
          className="w-full px-3 py-2 bg-gray-800 border border-green-600 rounded text-green-400 font-mono placeholder-green-700 focus:outline-none focus:border-green-400" 
        />
      </div>
      <button 
        onClick={handleSubmit} 
        disabled={processing}
        className="w-full px-4 py-2 bg-green-900 text-green-400 border border-green-600 rounded font-mono hover:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-600 transition-colors"
      >
        {processing ? '[PROCESSING...]' : '[EXECUTE] Generate Snapshot'}
      </button>
      {error && (
        <div className="mt-4 p-3 bg-red-900 border border-red-600 rounded">
          <p className="text-red-400 font-mono text-sm">
            <span className="text-red-600">ERROR:</span> {error}
          </p>
        </div>
      )}
      {status && (
        <div className="mt-4 p-3 bg-gray-800 border border-green-600 rounded">
          <div className="text-green-400 font-mono text-sm">
            <span className="text-green-600">&gt; STATUS:</span> {status}
          </div>
        </div>
      )}
    </div>
  );
}