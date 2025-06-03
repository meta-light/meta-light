'use client';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';

export function ClientWalletProvider({children}) {
  const wallets = useMemo(() => [], []);
  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        {children}
      </WalletModalProvider>
    </WalletProvider>
  );
}

export default ClientWalletProvider;