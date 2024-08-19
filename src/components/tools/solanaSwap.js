import React, { useState } from 'react';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { TokenSwap } from '@solana/spl-token-swap';
import { Token } from '@solana/spl-token';

export default function SolanaSwap() {
  const [tokenAAddress, setTokenAAddress] = useState('iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns');
  const [tokenBAddress, setTokenBAddress] = useState('AmgUMQeqW8H74trc8UkKjzZWtxBdpS496wh4GLy2mCpo');
  const [tokenSwapAddress, setTokenSwapAddress] = useState('J5U6amNaxzBtXbbgL8c6QsX6x9SMteqYhZgnddxiJ9Lb');
  const [amountToSwap, setAmountToSwap] = useState(10);
  const [externalAddress, setExternalAddress] = useState('2wzBg2xGMNR1Nr6cGywo3LJCXhMSntRxuwg15SCP3vL3');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const solanaNodeUrl = 'https://api.mainnet-beta.solana.com';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      await swapTokens();
      setResult('Swap completed and tokens sent to the external address.');
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error(err);
    }
  };

  const swapTokens = async () => {
    const connection = new Connection(solanaNodeUrl, 'confirmed');
    
    // Note: In a real application, you would need to handle wallet connection and signing
    // This is a placeholder and won't work without proper wallet integration
    const wallet = Keypair.generate(); // This should be replaced with the user's actual wallet

    const tokenAAddressPubkey = new PublicKey(tokenAAddress);
    const tokenBAddressPubkey = new PublicKey(tokenBAddress);
    const tokenSwapAddressPubkey = new PublicKey(tokenSwapAddress);
    const externalAddressPubkey = new PublicKey(externalAddress);

    const tokenSwapMarket = await TokenSwap.loadTokenSwap(connection, tokenSwapAddressPubkey, {}, null);
    const tokenA = new Token(connection, tokenAAddressPubkey, null, wallet);
    const tokenB = new Token(connection, tokenBAddressPubkey, null, wallet);

    const swapResult = await tokenSwapMarket.swap(tokenA, tokenB, wallet.publicKey, null, amountToSwap, 0);
    const transaction = await tokenB.transfer(swapResult, wallet.publicKey, externalAddressPubkey, []);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.partialSign(wallet);
    await connection.sendRawTransaction(transaction.serialize());
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4">Solana Token Swap</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Token A Address:</label>
          <input
            type="text"
            value={tokenAAddress}
            onChange={(e) => setTokenAAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Token B Address:</label>
          <input
            type="text"
            value={tokenBAddress}
            onChange={(e) => setTokenBAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Token Swap Address:</label>
          <input
            type="text"
            value={tokenSwapAddress}
            onChange={(e) => setTokenSwapAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Amount to Swap:</label>
          <input
            type="number"
            value={amountToSwap}
            onChange={(e) => setAmountToSwap(Number(e.target.value))}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block mb-1">External Address:</label>
          <input
            type="text"
            value={externalAddress}
            onChange={(e) => setExternalAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Swap Tokens
        </button>
      </form>

      {error && <p className="mt-4 text-red-500">{error}</p>}
      {result && <p className="mt-4 text-green-500">{result}</p>}
    </div>
  );
}