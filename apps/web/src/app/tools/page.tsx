"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import React, { useState } from 'react';
import { useSolana } from "@dewicats/connect-button";
import "../globals.css";
import "../styles/terminal.css";
import SnapshotTool from '../../components/tools/snapshot';
import FindFirstTX from '../../components/tools/findFirstTX';
import GetBalance from '../../components/tools/getBalance';
import GetHashlist from '../../components/tools/getHashlist';
import SolanaHex from '../../components/tools/SolanaHex';
import SolanaMetadata from '../../components/tools/solanaMetadata';
import CNFTHolders from '../../components/tools/cnft-holders';

const ConnectButtonProvider = dynamic(async () => (await import("@dewicats/connect-button")).ConnectButtonProvider, { ssr: false });
const ConnectButton = dynamic(async () => await import("@dewicats/connect-button"), { ssr: false });
const ProviderWrapper = ({ children }) => {
  const rpcHost = process.env.NEXT_PUBLIC_REACT_APP_SOLANA_RPC_HOST || "https://api.mainnet-beta.solana.com";
  return (<ConnectButtonProvider solanaRpcHost={rpcHost}>{children}</ConnectButtonProvider>);
};

function ToolsPage() {
  const { publicKey } = useSolana();
  const [activeTool, setActiveTool] = useState('snapshot');
  const LogoComponent = () => (<img src="/home/dewi-cat.gif" alt="Dewi Cat" />);
  const tools = [
    { id: 'snapshot', name: 'Snapshot', title: 'Solana NFT Snapshot Tool' },
    { id: 'findFirst', name: 'Find First TX', title: 'Find First SolanaTransaction' },
    { id: 'getBalance', name: 'Get Balances', title: 'Get Wallet Balances' },
    { id: 'getHashlist', name: 'Hashlist', title: 'Get Hashlist and Owners' },
    { id: 'solanaHex', name: 'Hex', title: 'Solana Hex Tool' },
    { id: 'solanaMetadata', name: 'Metadata', title: 'Solana Metadata Generator' },
    { id: 'cnftHolders', name: 'Holders', title: 'CNFT Holders' },
  ];
  const getToolTitle = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    return tool ? tool.title : 'Solana Tools';
  };
  return (
    <div className="flex flex-col min-h-screen bg-black text-green-400 font-mono">
      <div className="bg-black border-b border-green-500 p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div>
              <h1 className="text-green-400 font-bold">
                <span className="text-green-600">user@solana-tools</span>
                <span className="text-white">:</span>
                <span className="text-blue-400">~/tools</span>
                <span className="text-white">$</span>
              </h1>
              {publicKey && (<p className="text-sm text-green-600"># Connected wallet: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}</p>)}
            </div>
          </div>
          <div className="terminal-button">
            <ConnectButton compresedView disableMagicLink connectLabel="Connect Wallet" logo={LogoComponent}/>
          </div>
        </div>
      </div>
      <nav className="bg-black border-b border-green-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex overflow-x-auto px-4 py-2">
            <span className="text-green-600 mr-4 py-1">Available commands:</span>
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`px-3 py-1 mx-1 text-sm font-mono border transition-all duration-200 ${
                  activeTool === tool.id
                    ? 'border-green-400 bg-green-900/30 text-green-300 shadow-lg shadow-green-900/20'
                    : 'border-green-800 text-green-600 hover:border-green-600 hover:text-green-400 hover:bg-green-900/10'
                } rounded`}
              >
                ./{tool.name.toLowerCase().replace(/\s+/g, '-')}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="flex-grow bg-black">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-green-600">user@solana-tools</span>
              <span className="text-white">:</span>
              <span className="text-blue-400">~/tools</span>
              <span className="text-white">$</span>
              <span className="text-green-400">./{activeTool.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}</span>
            </div>
            <div className="text-green-600 text-sm mb-4"># Executing: {getToolTitle(activeTool)}</div>
          </div>
          <div className="bg-gray-900 border border-green-800 rounded p-6 shadow-2xl shadow-green-900/20">
            <div className="flex items-center mb-4 pb-2 border-b border-green-800">
              <div className="flex space-x-2 mr-4">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
              </div>
              <span className="text-green-600 text-sm">Terminal Output</span>
            </div>
            <div className="terminal-content">
              {activeTool === 'snapshot' && <SnapshotTool />}
              {activeTool === 'findFirst' && <FindFirstTX />}
              {activeTool === 'getBalance' && <GetBalance />}
              {activeTool === 'getHashlist' && <GetHashlist />}
              {activeTool === 'solanaHex' && <SolanaHex />}
              {activeTool === 'solanaMetadata' && <SolanaMetadata />}
              {activeTool === 'cnftHolders' && <CNFTHolders />}
            </div>
          </div>
          <div className="mt-4 text-green-700 text-xs">
            <span className="text-green-600">[INFO]</span> Use the command buttons above to switch between tools
          </div>
        </div>
      </main>

    </div>
  );
}

export default function Tools() {return (<ProviderWrapper><ToolsPage /></ProviderWrapper>);}