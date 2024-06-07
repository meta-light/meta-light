'use client'
import { ConnectionProvider } from '@solana/wallet-adapter-react';

export default function ProviderWrapper({ children }) {
  const heliusKey = process.env.HELIUS_KEY;
  const endpoint = 'https://rpc.helius.xyz/?api-key=' + heliusKey;

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "finalized" }}>
        {children}
    </ConnectionProvider>
  )
}