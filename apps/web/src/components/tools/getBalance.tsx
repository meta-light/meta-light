import React, { useState } from 'react';

interface BalanceData {
  nativeBalance: number;
  tokens: Array<{
    mint: string;
    amount: number;
    decimals: number;
  }>;
}

export default function GetBalance() {
  const [address, setAddress] = useState('');
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {const data = await getBalances(address); setBalances(data);} 
    catch (err) {setError('Error fetching balance. Please try again.'); console.error(err);}
    setLoading(false);
  };
  const getBalances = async (address: string) => {
    const response = await fetch('/api/balances', {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({ address })});
    if (!response.ok) {const errorData = await response.json(); throw new Error(errorData.error || 'Failed to fetch balances');}
    return await response.json();
  };
  return (
    <div className="terminal-tool">
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block text-green-400 text-sm font-mono mb-2">&gt; Enter wallet address to check balances:</label>
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
          {loading ? '[QUERYING...]' : '[EXECUTE] Get Balance'}
        </button>
      </form>
      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-600 rounded">
          <p className="text-red-400 font-mono text-sm">
            <span className="text-red-600">ERROR:</span> {error}
          </p>
        </div>
      )}
      {balances && (
        <div className="space-y-4">
          <div className="text-green-400 font-mono mb-3">
            <span className="text-green-600">&gt; BALANCE REPORT:</span>
          </div>
          <div className="bg-gray-800 border border-green-600 rounded p-4 space-y-3">
            <div className="font-mono text-green-400">
              <span className="text-green-600">Native Balance:</span> {(balances.nativeBalance || 0) / 1000000000} SOL
            </div>
            <div className="font-mono text-green-400">
              <span className="text-green-600">Token Count:</span> {balances.tokens?.length || 0}
            </div>
          </div>
          <details className="bg-gray-800 border border-green-600 rounded">
            <summary className="cursor-pointer p-4 text-blue-400 font-mono hover:text-blue-300">
              &gt; [EXPAND] View Token Details ({balances.tokens?.length || 0} tokens)
            </summary>
            <div className="p-4 border-t border-green-600">
              <div className="bg-gray-900 rounded border border-green-700 max-h-64 overflow-y-auto">
                {(balances.tokens || []).map((token, index) => (
                  <div key={index} className="p-3 border-b border-green-900 last:border-b-0">
                    <div className="font-mono text-green-400 text-sm">
                      <div className="text-blue-400 mb-1">Token #{String(index + 1).padStart(3, '0')}</div>
                      <div><span className="text-green-600">Mint:</span> {token.mint}</div>
                      <div><span className="text-green-600">Amount:</span> {token.amount}</div>
                      <div><span className="text-green-600">Decimals:</span> {token.decimals}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}