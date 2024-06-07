'use client';
import Button from './button';
import BasketContext from './BasketContext';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from "@solana/wallet-adapter-react";
import { useContext, useEffect } from "react";

export const Section = () => {
  const { assetInfoList, getTPS, searchAssets } = useContext(BasketContext);
  const { wallet, connect, disconnect } = useWallet();

  useEffect(() => {
    // Log the wallet connection status to help with debugging
    console.log("Wallet connection status:", wallet.connected);
  }, [wallet.connected]);

  return (
    <>
      <section className="terminal-output-section">
        <h1>Assets Found: <strong>{assetInfoList.length > 0 ? `(${assetInfoList.length} items)` : 'None'}</strong></h1>
      </section>
      <br />
      <section className="terminal-input-section" style={{ display: 'flex', alignItems: 'center' }}>
        <Button className="btn btn-default" onClick={getTPS} text="Update TPS" />
        <Button className="btn btn-default" onClick={searchAssets} text="Search Assets" />
        {wallet.connected ? (
          <WalletMultiButton onClick={disconnect} style={{ height: 40 }} />
        ) : (
          <WalletMultiButton onClick={connect} style={{ height: 40 }} />
        )}
      </section>
    </>
  );
};

export default Section;