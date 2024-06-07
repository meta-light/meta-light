"use client"
import { useMemo } from 'react';
import { WalletProvider, WalletModalProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';

export default function ClientWalletProvider({ children }) {
  const walletMemo = useMemo(() => {
    const wallets = [new PhantomWalletAdapter()];
    return wallets;
  }, []);

  return (
    <WalletProvider wallets={walletMemo} autoConnect>
      <WalletModalProvider>
        {children}
      </WalletModalProvider>
    </WalletProvider>
  );
}