import React, { useState } from 'react';
import { Transaction, Connection, PublicKey } from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddress } from "@solana/spl-token";

export default function SendToken() {
  const [mintAddress, setMintAddress] = useState('4umMdShNxbdnoV2EZjUp6h5GYYneZFLH9otBEU2K3ZYP');
  const [receiveAddress, setReceiveAddress] = useState('2xSHLfiPs3aEhzbLnYbyzWYMEaYnwSwJwAnVh5CwHWwX');
  const [fromTokenAccount, setFromTokenAccount] = useState('CE2uTSeVbBhy2Q8qVEnp8qAJYBQkVxMC4uGzchiAn6gG');
  const [amount, setAmount] = useState('1');
  const [decimals, setDecimals] = useState('0');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      const txHash = await transfer();
      setResult(`Transaction hash: ${txHash}`);
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error(err);
    }
  };

  const transfer = async () => {
    // Note: In a real application, you would need to handle wallet connection and signing
    const connection = new Connection("https://api.mainnet-beta.solana.com");
    const feePayer = null; // This should be the connected wallet
    const prevOwner = null; // This should be the connected wallet

    const mintPubkey = new PublicKey(mintAddress);
    const receiveAdressPubkey = new PublicKey(receiveAddress);
    const tokenAccount1Pubkey = new PublicKey(fromTokenAccount);

    let ata = await getAssociatedTokenAddress(mintPubkey, receiveAdressPubkey);

    const tokenAccount2Pubkey = new PublicKey(ata);
    let tx = new Transaction();
    tx.add(
      createTransferCheckedInstruction(
        tokenAccount1Pubkey, // from
        mintPubkey, // mint
        tokenAccount2Pubkey, // to
        prevOwner, // from's owner
        parseInt(amount), // amount
        parseInt(decimals) // decimals
      )
    );

    // Note: In a real application, you would sign and send the transaction here
    // For demonstration, we'll just return a dummy transaction hash
    return "dummy_transaction_hash";
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Send Token</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Mint Address:</label>
          <input
            type="text"
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Receive Address:</label>
          <input
            type="text"
            value={receiveAddress}
            onChange={(e) => setReceiveAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">From Token Account:</label>
          <input
            type="text"
            value={fromTokenAccount}
            onChange={(e) => setFromTokenAccount(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Amount:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Decimals:</label>
          <input
            type="number"
            value={decimals}
            onChange={(e) => setDecimals(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Send Token
        </button>
      </form>

      {error && <p className="mt-4 text-red-500">{error}</p>}
      {result && <p className="mt-4 text-green-500">{result}</p>}
    </div>
  );
}