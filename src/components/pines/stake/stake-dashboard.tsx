'use client';
import Image from 'next/image';
import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export function StakeGrid() {
  const [ownedPinesData, setOwnedPinesData] = useState([]);
  const [hasRun, setHasRun] = useState(false);
  const wallet = useWallet(); 
  const activeWallet = wallet.publicKey?.toBase58();
  const heliusUrl = "<Helius API Key>";
  const getAssetsByGroup = useCallback(async () => {
    if (!activeWallet) {console.log("No active wallet found."); return;}
    const response = await fetch(heliusUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({jsonrpc: '2.0', id: 'my-id', method: 'getAssetsByGroup', params: { groupKey: 'collection', groupValue: 'BQakVcDe1xMywcetx9Yj3iAQWKf5or92F9hEf1yRH8ZM', page: 1, limit: 1000 }})});
    const { result } = await response.json();
    const pinesData = result.items.map((item: { id: string; ownership: { owner: string; }; content: { metadata: { attributes: { trait_type: string; value: string; }[] }; links: { image: string }}  }) => ({
      id: item.id, holder: item.ownership.owner, traitType: item.content.metadata.attributes[0].trait_type, value: item.content.metadata.attributes[0].value, image: item.content.links.image
    }));
    console.log(pinesData);
    const pinesHolders = pinesData.reduce((acc: Record<string, number>, item: { id: string; holder: string }) => {acc[item.holder] = (acc[item.holder] || 0) + 1; return acc; }, {});
    //const pinesMintAddresses = pinesData.map((item: { id: string; }) => item.id); //use this to make a quick snapshot of all minted Pines


    // const getSnapshot = async () => { // rebuild pinesData with data from finalData
    //   const options = { method: 'GET', headers: { accept: 'application/json', authorization: 'Bearer 7aaadeea68df16.1e6458f36269480aa680cec897385cc4' } };
    //   const totalPages = 3;
    //   let finalData: object[] = [];
    //   for (let i = 1; i <= totalPages; i++) {
    //     const response = await fetch(`https://mainnet.underdogprotocol.com/v2/projects/1/nfts?page=${i}&limit=100`, options);
    //     const data = await response.json();
    //     finalData = finalData.concat(data.results);
    //   }
    //   console.log(finalData);
    // }
    // getSnapshot();



    if (activeWallet in pinesHolders) {console.log("Active wallet owns Pine");} else {console.log("Active wallet does not own Pine");}  
    const pinesOwnedByActiveWallet = pinesData.filter((item: { id: string; holder: string }) => item.holder === activeWallet).map((item: { id: string; holder: string; traitType: string; value: string; image: string }) => item);    
    setOwnedPinesData(pinesOwnedByActiveWallet);
  }, [activeWallet]);
  useEffect(() => {console.log("Your Pines: ", ownedPinesData);}, [ownedPinesData]);
  useEffect(() => {if (wallet.connected && !hasRun) {getAssetsByGroup(); setHasRun(true);}}, [wallet.connected, getAssetsByGroup, hasRun]);


  const stakePine = async (nftId: string) => {
    // const url = 'https://mainnet.underdogprotocol.com/v2/projects/1/nfts/' + nftId;
    const url = 'https://mainnet.underdogprotocol.com/v2/projects/1/nfts/172';
    console.log(url)
    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer 7aaadeea68df16.1e6458f36269480aa680cec897385cc4' },
            body: JSON.stringify({
                attributes: { staked: 'true' },
                name: 'The Pines',
                symbol: 'PINE',
                description: 'There’s no need to pine over spilled milk.',
                image: 'https://underdog-protocol.s3.us-west-1.amazonaws.com/6626ebfe-f65d-401a-8087-816ad36ea1bf.png',
                externalUrl: 'https://t.me/+iVKU8g_o5j5jOWUx'
            })
        });
        const data = await response.json();
        console.log(data);
    } catch (err) {
        console.error(err);
    }
}

const unstakePine = async (id: string) => {
  const url = 'https://mainnet.underdogprotocol.com/v2/projects/1/nfts/' + id;
  try {
      const response = await fetch(url, {
          method: 'PATCH',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer 7aaadeea68df16.1e6458f36269480aa680cec897385cc4'
          },
          body: JSON.stringify({
              attributes: { staked: 'false' },
              name: 'The Pines',
              symbol: 'PINE',
              description: 'There’s no need to pine over spilled milk.',
              image: 'https://underdog-protocol.s3.us-west-1.amazonaws.com/6626ebfe-f65d-401a-8087-816ad36ea1bf.png',
              externalUrl: 'https://t.me/+iVKU8g_o5j5jOWUx'
          })
      });
      const data = await response.json();
      console.log(data);
  } catch (err) {
      console.error(err);
  }
}

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', gap: '50px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ color: 'white' }}>UNSTAKED</h2><br></br>
            <div style={{ backgroundColor: '#7c9d2d', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: '100%', padding: '10px', alignItems: 'center' }}>            
            {ownedPinesData.filter((item: { id: string; image: string; value: string }) => item.value == "false").map((item: { id: string; image: string; value: string; }) => (
              <div key={item.id} style={{ borderRadius: '10px', padding: '10px', width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Image src={item.image} width={200} height={200} alt="Pine Image"/><br></br><button onClick={() => stakePine(item.id)} style={{ backgroundColor: '#a8d7fb', borderRadius: '5px' }}>Stake</button>
              </div>
            ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ color: 'white' }}>STAKED</h2><br></br>
            <div style={{ backgroundColor: '#5e4031', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: '100%', padding: '10px', alignItems: 'center' }}>
            {ownedPinesData.filter((item: { id: string; image: string; value: string }) => item.value == "true").map((item: { id: string; image: string; value: string; }) => (
              <div key={item.id} style={{ borderRadius: '10px', padding: '10px', width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Image src={item.image} width={200} height={200} alt="Pine Image"/><br></br><button onClick={() => unstakePine(item.id)} style={{ backgroundColor: '#a8d7fb', borderRadius: '5px' }}>Stake</button>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
