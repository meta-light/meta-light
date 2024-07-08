'use client'
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import ClientWalletProvider from './WalletProvider';
const heliusAPI = process.env.HELIUS_KEY;

export default function ProviderWrapper({ children }) {
  const endpoint = 'https://rpc.helius.xyz/?api-key=' + heliusAPI;
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "finalized" }}>
      <ClientWalletProvider>
        {children}
      </ClientWalletProvider>
    </ConnectionProvider>
  );
}