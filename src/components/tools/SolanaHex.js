import React, { useState } from 'react';
import { Keypair } from "@solana/web3.js";
import bs58 from 'bs58';

export default function SolanaHex() {
  const [privateKeyBase58, setPrivateKeyBase58] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {const processedData = processSolanaKey(privateKeyBase58); setResult(processedData);} 
    catch (err) {setError(`Error: ${err.message}`); console.error(err);}
  };
  const processSolanaKey = (privateKeyBase58) => {
    let secretKey = bs58.decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(secretKey);
    let privkey = new Uint8Array(keypair.secretKey);
    const base58Encoded = bs58.encode(privkey);
    const length = privkey.length;
    const halfLength = Math.ceil(length / 2);
    const firstHalf = privkey.subarray(0, halfLength);
    const secondHalf = privkey.subarray(halfLength);
    return {hex: `[${keypair.secretKey}]`, base58: base58Encoded, firstHalf: Array.from(firstHalf), secondHalf: Array.from(secondHalf), json: `[${Array.from(secretKey)}]`};
  };
  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Process Solana Key</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Private Key (Base58):</label>
          <input type="text" value={privateKeyBase58} onChange={(e) => setPrivateKeyBase58(e.target.value)} className="w-full px-3 py-2 border rounded-md" required/>
        </div>
        <button type="submit" className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Process Key</button>
      </form>
      {error && <p className="mt-4 text-red-500">{error}</p>}
      {result && (
        <div className="mt-4 space-y-2">
          <p><strong>Hex:</strong> {result.hex}</p>
          <p><strong>Base 58:</strong> {result.base58}</p>
          <p><strong>First Half:</strong> [{result.firstHalf.join(', ')}]</p>
          <p><strong>Second Half:</strong> [{result.secondHalf.join(', ')}]</p>
          <p><strong>JSON:</strong> {result.json}</p>
        </div>
      )}
    </div>
  );
}