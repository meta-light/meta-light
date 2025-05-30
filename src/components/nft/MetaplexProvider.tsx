import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { MetaplexContext } from './useMetaplex';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo, ReactNode } from 'react';

interface MetaplexProviderProps {
  children: ReactNode;
}

export const MetaplexProvider = ({ children }: MetaplexProviderProps) => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const metaplex = useMemo(
    () => Metaplex.make(connection).use(walletAdapterIdentity(wallet)),
    [connection, wallet]
  );

  return (
    <MetaplexContext.Provider value={{ metaplex } as any}>
      {children}
    </MetaplexContext.Provider>
  )
}
