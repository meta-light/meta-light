import React, { useState } from 'react';

interface TransactionResult {
  slots: number[];
  lowestslot: number;
  lowestslotEntry: any;
}

export default function FindFirstTX() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {const data = await parseTransactions(address); setResult(data);} 
    catch (err) {setError('Error fetching data. Please try again.'); console.error(err);}
    setLoading(false);
  };
  const parseTransactions = async (address: string) => {
    const response = await fetch('/api/first-transaction', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ address })});
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch first transaction');
    }
    return await response.json();
  };
  return (
    <div className="terminal-tool">
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block text-green-400 text-sm font-mono mb-2">&gt; Enter Solana address to analyze:</label>
          <input 
            type="text" 
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
            placeholder="Wallet address..." 
            className="w-full px-3 py-2 bg-gray-800 border border-green-600 rounded text-green-400 font-mono placeholder-green-700 focus:outline-none focus:border-green-400" 
            required 
          />
        </div>
        <button 
          type="submit" 
          className="w-full px-4 py-2 bg-green-900 text-green-400 border border-green-600 rounded font-mono hover:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-600 transition-colors" 
          disabled={loading}
        >
          {loading ? '[SCANNING...]' : '[EXECUTE] Find First Transaction'}
        </button>
      </form>
      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-600 rounded">
          <p className="text-red-400 font-mono text-sm">
            <span className="text-red-600">ERROR:</span> {error}
          </p>
        </div>
      )}
      {result && (
        <div className="space-y-4">
          <div className="text-green-400 font-mono mb-3">
            <span className="text-green-600">&gt; ANALYSIS RESULTS:</span>
          </div>
          <div className="bg-gray-800 border border-green-600 rounded p-4 space-y-3">
            <div className="font-mono text-green-400">
              <span className="text-green-600">Lowest Slot:</span> {result.lowestslot}
            </div>
            <div className="font-mono text-green-400">
              <span className="text-green-600">Total Transactions:</span> {result.slots.length}
            </div>
          </div>
          <details className="bg-gray-800 border border-green-600 rounded">
            <summary className="cursor-pointer p-4 text-blue-400 font-mono hover:text-blue-300">
              &gt; [EXPAND] View Lowest Slot Entry Details
            </summary>
            <div className="p-4 border-t border-green-600">
              <pre className="text-green-400 font-mono text-xs overflow-x-auto bg-gray-900 p-3 rounded border border-green-700">
                {JSON.stringify(result.lowestslotEntry, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}