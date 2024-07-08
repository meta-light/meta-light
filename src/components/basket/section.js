'use client';
import Button from './button'
import { WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";

export const Section = (props) => {
  const { assetInfoList, getTPS, searchAssets } = props
  const walletModal = useWalletModal()
  const { wallet } = useWallet();
  const [isConnected, setIsConnected] = useState(false);
  const handleConnectWallet = () => {walletModal.setVisible(!walletModal.visible); setIsConnected(true);};
  const handleDisconnectWallet = () => {setIsConnected(false);};
  return ( 
    <>
      <section className="terminal-output-section"><h>Assets Found: <strong>{assetInfoList.length > 0 ? `(${assetInfoList.length} items)` : ''}</strong></h></section>
      <br></br>
      <section className="terminal-input-section" style={{ display: 'flex', alignItems: 'center' }}>
        <Button className="btn btn-default" onClick={() => getTPS()} text="Update TPS" />
        <Button className="btn btn-default" text={"Search Assets"} onClick={() => searchAssets()} />
        {isConnected ? (<><WalletDisconnectButton onClick={handleDisconnectWallet} style={{ height: 40 }}/></>) : (<Button onClick={handleConnectWallet} text={walletModal.visible ? "Cancel" : "Connect Wallet"} className="btn btn-default" id="connect"/>)}
      </section>
    </>
  )
}
export default Section