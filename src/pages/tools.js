"use client";
import React, { useState } from 'react';
import '../styles/tailwind.css';

export default function Home() {
  const [groupValue, setGroupValue] = useState('');
  const handleSubmit = () => {getAssetsByGroup(groupValue);};
  const handleInputChange = (event) => {setGroupValue(event.target.value);};
  const getAssetsByGroup = async (groupValue) => {
    const url = `https://mainnet.helius-rpc.com/?api-key=<API_KEY>`;
    let page = 1;
    let assetList = [];
    while (page) {
      const response = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({jsonrpc: "2.0", id: "my-id", method: "getAssetsByGroup", params: { groupKey: "collection", groupValue: groupValue, page: page, limit: 1000 },}),
      });
      const { result = {} } = await response.json();
      console.log(result);
      if (result.items && result.items.length > 0) {assetList.push(...result.items);}
      if (result.total !== 1000) {page = false;} else {page++;}}
    const rawList = assetList.map(item => item.ownership.owner);
    let uniqueOwners = [];
    rawList.forEach(owner => {if (!uniqueOwners.includes(owner)) {uniqueOwners.push(owner);}});
    console.log(uniqueOwners);
    console.log("Unique Owners: ", uniqueOwners.length);
    const downloadUniqueOwners = () => {
      const data = JSON.stringify(uniqueOwners);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'uniqueOwners.json';
      a.click();
      URL.revokeObjectURL(url);
    };
    downloadUniqueOwners();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">Solana NFT Snapshot Tool&nbsp;</p>
      </div>
      <div>
        <input type="text" value={groupValue} onChange={handleInputChange} placeholder="Enter Collection Address" className="rounded-lg border border-gray-300 px-3 py-2 font-mono" style={{ width: '200%', color: 'black' }}/>
        <br></br><br></br>
        <button onClick={handleSubmit} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded font-mono">Submit</button>
      </div>
      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        <a href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank" rel="noopener noreferrer">
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}></p>
        </a>
      </div>
    </main>
  );
}

