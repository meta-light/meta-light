import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo, ReactNode, createContext } from 'react';

export const MetaplexContext = createContext<{ metaplex: Metaplex } | null>(null);

interface MetaplexProviderProps {
  children: ReactNode;
}

export const MetaplexProvider = ({ children }: MetaplexProviderProps) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const metaplex = useMemo(() => Metaplex.make(connection).use(walletAdapterIdentity(wallet)), [connection, wallet]);
  return (<MetaplexContext.Provider value={{ metaplex } as any}>{children}</MetaplexContext.Provider>)
}
