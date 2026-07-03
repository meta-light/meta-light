'use client'
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import ClientWalletProvider from '../solana/WalletProvider';
import { HELIUS_API_KEY } from '../../app/env';

export default function ProviderWrapper({ children }) {
  const endpoint = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "finalized" }}>
      <ClientWalletProvider>
        {children}
      </ClientWalletProvider>
    </ConnectionProvider>
  );
}