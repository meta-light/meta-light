'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Section from '../basket/section';
import ProviderWrapper from '../basket/providers/ProviderWrapper';
import '../styles/basket/page.module.css';
import '../styles/basket/globals.css';
require('@solana/wallet-adapter-react-ui/styles.css');
import Image from 'next/image';

export default function BasketComponent() {
  const wallet = useWallet();
  const [assetInfoList, setAssetInfoList] = useState([]);
  const [tps, setTps] = useState(null);
  const customLoader = ({ src }) => {return src;};
  const searchAssets = useCallback(async () => {
    try {
      const ownerAddress = wallet.publicKey.toString();
      const response = await fetch(`/api/helius?action=searchAssets&ownerAddress=${ownerAddress}`);
      const assetInfos = await response.json();
      setAssetInfoList(assetInfos);
    } catch (error) {console.error("Error in searchAssets:", error);}
  }, [wallet.publicKey]);

  useEffect(() => { getTPS() }, []);
  useEffect(() => {if (wallet.connected) {console.log("User's wallet address: ", wallet.publicKey?.toBase58()); searchAssets();}}, [wallet.connected, searchAssets, wallet.publicKey]);

  async function getTPS() {
    try {
      const response = await fetch('/api/helius?action=getTPS');
      const data = await response.json();
      const tps = data.tps;
      console.log("Solana TPS:", tps);
      setTps(tps);
    } catch (error) {console.error("Error fetching TPS:", error);}
  }

  return (
    <ProviderWrapper>
      <main>
        <link rel="stylesheet" href="https://unpkg.com/terminal.css@0.7.2/dist/terminal.min.css" />
        <title>Basket</title>
        <section className="terminal-output">
          <p>Welcome to <strong>cNFT Basket</strong></p>
          <div className="output-area"></div>
        </section>
        <section className="terminal-output">
          <p>Solana Network TPS: <strong>{tps ? tps.toFixed(2) : null}</strong></p>
        </section>
        <Section assetInfoList={assetInfoList} getTPS={getTPS} searchAssets={searchAssets} />
        <br></br>
        <div className="article-grid">
          {assetInfoList.map((assetInfoList, index) => (
            <article key={index}>
              <div className="equlibrium-image-container">
                <Image className="view-icon-hover" loader={customLoader} src="/icon-view.svg" alt="View Icon" width={24} height={24}/>
                <Image className="equilibrium-image" loader={customLoader} src={assetInfoList.image} alt={assetInfoList.name} width={604} height={604}/>
                <div className="profile-nick-div">
                  <h2><span className="hover-cyan">{assetInfoList.name}</span></h2>
                </div>
              </div>
            </article>
          ))}
        </div>
        <br></br>
        <div className="terminal-output"><strong>Basket - 2023</strong></div>
        <br></br>
      </main>
    </ProviderWrapper>
  )
} 