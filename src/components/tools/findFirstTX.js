import React, { useState } from 'react';

export default function FindFirstTX() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {const data = await parseTransactions(address, apiKey); setResult(data);} 
    catch (err) {setError('Error fetching data. Please try again.'); console.error(err);}
    setLoading(false);
  };

  const parseTransactions = async (address, apiKey) => {
    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const slots = data.map(entry => entry.slot);
    slots.sort((a, b) => a - b);
    const lowestslot = slots[0];
    const lowestslotEntry = data.find(entry => entry.slot === lowestslot);
    return { slots, lowestslot, lowestslotEntry };
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Find First Transaction</h2>
      <form onSubmit={handleSubmit} className="mb-4">
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter Solana address" className="w-full px-3 py-2 border rounded-md" required />
        <button type="submit" className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600" disabled={loading}>{loading ? 'Loading...' : 'Find First TX'}</button>
      </form>
      {error && <p className="text-red-500">{error}</p>}
      {result && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Results:</h3>
          <p>Lowest Slot: {result.lowestslot}</p>
          <p>Total Transactions: {result.slots.length}</p>
          <details>
            <summary className="cursor-pointer text-blue-500">View Lowest Slot Entry</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded-md overflow-x-auto">{JSON.stringify(result.lowestslotEntry, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}