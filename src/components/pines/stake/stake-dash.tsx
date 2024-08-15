'use client';
import Image from 'next/image';
import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export function StakeGridUpdog() {
  const [ownedPinesData, setOwnedPinesData] = useState<{ underdogId: string; heliusHolder: string; heliusStaked: string; image: string; mint: string; }[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const wallet = useWallet();
  const activeWallet = wallet.publicKey?.toBase58();
  const heliusUrl = "<Helius Api Key>"; // move to .env

  const getData = useCallback(async () => {
    const underdogOptions = {method: 'GET', headers: {accept: 'application/json', authorization: 'Bearer 7aaadeea68df16.1e6458f36269480aa680cec897385cc4'}}; // move to .env
    const heliusOptions = {method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({jsonrpc: '2.0', id: 'my-id', method: 'getAssetsByGroup', params: { groupKey: 'collection', groupValue: 'BQakVcDe1xMywcetx9Yj3iAQWKf5or92F9hEf1yRH8ZM', page: 1, limit: 1000 }})};
    const totalPages = 3;
    let underdogData: { id: string; ownerAddress: string; attributes: { staked: string }; image: string; mintAddress: string; }[] = [];
    let heliusData: { id: string; ownership: { owner: string; }; content: { metadata: { attributes: { trait_type: string; value: string; }[] }; links: { image: string }} }[] = [];
    for (let i = 1; i <= totalPages; i++) {
      const response = await fetch(`https://mainnet.underdogprotocol.com/v2/projects/1/nfts?page=${i}&limit=100`, underdogOptions);
      const data = await response.json();
      underdogData = underdogData.concat(data.results);
    }
    const heliusResponse = await fetch(heliusUrl, heliusOptions);
    const heliusResult = await heliusResponse.json();
    heliusData = heliusResult.result.items;
    if (!activeWallet) {console.log('No active wallet found.'); return;}
    const pinesData = underdogData.map((item) => ({underdogId: item.id, underdogHolder: item.ownerAddress, underdogStaked: item.attributes.staked, image: item.image, mint: item.mintAddress,
        heliusHolder: heliusData.find((heliusItem) => heliusItem.id === item.mintAddress)?.ownership.owner || 'Unknown',
        heliusStaked: heliusData.find((heliusItem) => heliusItem.id === item.mintAddress)?.content.metadata.attributes.find(attr => attr.trait_type === 'staked')?.value || 'Unknown',
    }));
    const pinesHolders = pinesData.reduce((acc: { [key: string]: number }, item: {heliusHolder: string;}) => {acc[item.heliusHolder] = (acc[item.heliusHolder] || 0) + 1; return acc;},{});
    if (activeWallet in pinesHolders) {console.log('Active wallet owns at least 1 Pine');} else {console.log('Active wallet does not own Pine');}
    const pinesOwnedByActiveWallet = pinesData.filter((item: { underdogId: string; heliusHolder: string; heliusStaked: string; image: string; mint: string; }) => item.heliusHolder === activeWallet)
      .map((item: {underdogId: string; heliusHolder: string; heliusStaked: string; image: string; mint: string;}) => item
    );
    setOwnedPinesData(pinesOwnedByActiveWallet);
  }, [activeWallet]);
  useEffect(() => {console.log('Your Pines: ', ownedPinesData);}, [ownedPinesData]);
  useEffect(() => {if (wallet.connected && !hasRun) {getData(); setHasRun(true);}}, [wallet.connected, getData, hasRun]);

  const stakePine = async (underdogId: string) => {
    const url = 'https://mainnet.underdogprotocol.com/v2/projects/1/nfts/' + underdogId;
    try {const response = await fetch(url, {
        method: 'PATCH', headers: {'Content-Type': 'application/json', Authorization: 'Bearer 7aaadeea68df16.1e6458f36269480aa680cec897385cc4'},
        body: JSON.stringify({attributes: { staked: 'true', supply: '222', price: '0', namespace: 'public' },name: 'The Pines',symbol: 'PINE',description: 'There’s no need to pine over spilled milk.',
        image: 'https://underdog-protocol.s3.us-west-1.amazonaws.com/6626ebfe-f65d-401a-8087-816ad36ea1bf.png', externalUrl: 'https://t.me/+iVKU8g_o5j5jOWUx'}),
      });
      const data = await response.json();
      console.log(data); } catch (err) { console.error(err);
    }
  };

  const unstakePine = async (underdogId: string) => {
    const url = 'https://mainnet.underdogprotocol.com/v2/projects/1/nfts/' + underdogId;
    try {const response = await fetch(url, {
        method: 'PATCH', headers: {'Content-Type': 'application/json', Authorization: 'Bearer 7aaadeea68df16.1e6458f36269480aa680cec897385cc4'},
        body: JSON.stringify({attributes: { staked: 'false', supply: '222', price: '0', namespace: 'public' }, name: 'The Pines', symbol: 'PINE', description: 'There’s no need to pine over spilled milk.',
        image: 'https://underdog-protocol.s3.us-west-1.amazonaws.com/6626ebfe-f65d-401a-8087-816ad36ea1bf.png', externalUrl: 'https://t.me/+iVKU8g_o5j5jOWUx'}),
      });
      const data = await response.json();
      console.log(data);} catch (err) {console.error(err);}
  };

  return (
    <div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px'}}>
            <div style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', gap: '50px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h2 style={{ color: 'white' }}>UNSTAKED</h2>
                    <br></br>
                    <div style={{ backgroundColor: '#7c9d2d', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: '100%', padding: '10px', alignItems: 'center' }}>
                    {ownedPinesData.filter((item: { underdogId: string; heliusHolder: string; heliusStaked: string; image: string; mint: string; }) => item.heliusStaked === 'false')
                        .map((item: { underdogId: string; heliusHolder: string; heliusStaked: string; image: string; mint: string; }) => (
                    <div key={item.underdogId} style={{ borderRadius: '10px', padding: '10px', width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Image src={item.image} width={200} height={200} alt="Pine Image"/><br></br>
                        <button onClick={() => unstakePine(item.underdogId)} style={{ backgroundColor: '#a8d7fb', borderRadius: '5px' }}>Stake</button>
                    </div>))}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h2 style={{ color: 'white' }}>STAKED</h2>
                    <br></br>
                    <div style={{ backgroundColor: '#5e4031', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: '100%', padding: '10px', alignItems: 'center' }}>
                    {ownedPinesData.filter((item: { underdogId: string; heliusHolder: string; heliusStaked: string; image: string; mint: string; }) => item.heliusStaked === 'true')
                        .map((item: { underdogId: string; heliusHolder: string; heliusStaked: string; image: string; mint: string; }) => (
                    <div key={item.underdogId} style={{ borderRadius: '10px', padding: '10px', width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Image src={item.image} width={200} height={200} alt="Pine Image" /><br></br>
                        <button onClick={() => stakePine(item.underdogId)} style={{ backgroundColor: '#a8d7fb', borderRadius: '5px' }}>Unstake</button>
                    </div>))}
                    </div>
                </div>
            </div>
        </div>
    </div>)};
