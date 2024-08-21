"use client";
import React, { useState } from 'react';
import '../styles/tailwind.css';
import SnapshotTool from '../components/tools/snapshot';
import FindFirstTX from '../components/tools/findFirstTX';
import GetBalance from '../components/tools/getBalance';
import SolanaHex from '../components/tools/SolanaHex';
import SolanaSwap from '../components/tools/solanaSwap';
import SolanaUtils from '../components/tools/solanaUtils';
import SolanaMetadata from '../components/tools/solanaMetadata';
import UpdateMetadata from '../components/tools/update-metadata';
import CNFTHolders from '../components/tools/cnft-holders';

export default function Home() {
  const [activeTool, setActiveTool] = useState('snapshot');

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="bg-gray-800 text-white p-4">
        <ul className="flex flex-wrap space-x-4">
          <li><button onClick={() => setActiveTool('snapshot')} className={`px-3 py-2 rounded ${activeTool === 'snapshot' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>Snapshot Tool</button></li>
          <li><button onClick={() => setActiveTool('findFirst')} className={`px-3 py-2 rounded ${activeTool === 'findFirst' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>First TX</button></li>
          <li><button onClick={() => setActiveTool('getBalance')} className={`px-3 py-2 rounded ${activeTool === 'getBalance' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>Get Balance</button></li>
          <li><button onClick={() => setActiveTool('solanaHex')} className={`px-3 py-2 rounded ${activeTool === 'solanaHex' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>Solana Hex</button></li>
          <li><button onClick={() => setActiveTool('solanaSwap')} className={`px-3 py-2 rounded ${activeTool === 'solanaSwap' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>Solana Swap</button></li>
          <li><button onClick={() => setActiveTool('solanaUtils')} className={`px-3 py-2 rounded ${activeTool === 'solanaUtils' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>Solana Utils</button></li>
          <li><button onClick={() => setActiveTool('solanaMetadata')} className={`px-3 py-2 rounded ${activeTool === 'solanaMetadata' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>Solana Metadata</button></li>
          <li><button onClick={() => setActiveTool('updateMetadata')} className={`px-3 py-2 rounded ${activeTool === 'updateMetadata' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>Update Metadata</button></li>
          <li><button onClick={() => setActiveTool('cnftHolders')} className={`px-3 py-2 rounded ${activeTool === 'cnftHolders' ? 'bg-blue-500' : 'hover:bg-gray-700'}`}>CNFT Holders</button></li>
        </ul>
      </nav>

      <main className="flex-grow flex flex-col items-center justify-between p-24">
        <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
          <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
            {getToolTitle(activeTool)}
          </p>
        </div>

        {activeTool === 'snapshot' && <SnapshotTool />}
        {activeTool === 'findFirst' && <FindFirstTX />}
        {activeTool === 'getBalance' && <GetBalance />}
        {activeTool === 'solanaHex' && <SolanaHex />}
        {activeTool === 'solanaSwap' && <SolanaSwap />}
        {activeTool === 'solanaUtils' && <SolanaUtils />}
        {activeTool === 'solanaMetadata' && <SolanaMetadata />}
        {activeTool === 'updateMetadata' && <UpdateMetadata />}
        {activeTool === 'cnftHolders' && <CNFTHolders />}

        <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
          <a href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
            target="_blank" rel="noopener noreferrer">
            <p className={`m-0 max-w-[30ch] text-sm opacity-50`}></p>
          </a>
        </div>
      </main>
    </div>
  );
}

function getToolTitle(activeTool) {
  switch (activeTool) {
    case 'snapshot':
      return 'Solana NFT Snapshot Tool';
    case 'findFirst':
      return 'Find First Transaction';
    case 'getBalance':
      return 'Get Wallet Balance';
    case 'solanaHex':
      return 'Solana Hex Tool';
    case 'solanaSwap':
      return 'Solana Token Swap';
    case 'solanaUtils':
      return 'Solana Utilities';
    case 'solanaMetadata':
      return 'Solana Metadata Generator';
    default:
      return 'Solana Tools';
  }
}