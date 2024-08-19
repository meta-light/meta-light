import React, { useState } from 'react';

export default function GetBalance() {
  const [address, setAddress] = useState('');
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY; // Ensure this is set in your .env.local file

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await getBalances(address, apiKey);
      setBalances(data);
    } catch (err) {
      setError('Error fetching balance. Please try again.');
      console.error(err);
    }
    setLoading(false);
  };

  const getBalances = async (address, apiKey) => {
    const url = `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("balances: ", data);
    console.log((data.nativeBalance / 1000000000));
    return data;
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Get Wallet Balance</h2>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter Solana address"
          className="w-full px-3 py-2 border rounded-md"
          required
        />
        <button
          type="submit"
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get Balance'}
        </button>
      </form>

      {error && <p className="text-red-500">{error}</p>}

      {balances && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Balances:</h3>
          <p>Native Balance: {balances.nativeBalance / 1000000000} SOL</p>
          <p>Tokens: {balances.tokens.length}</p>
          <details>
            <summary className="cursor-pointer text-blue-500">View Token Details</summary>
            <ul className="mt-2 p-2 bg-gray-100 rounded-md overflow-x-auto">
              {balances.tokens.map((token, index) => (
                <li key={index} className="mb-2">
                  <strong>{token.mint}</strong>: {token.amount} (Decimals: {token.decimals})
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}