'use client';
import { useState, useEffect } from 'react';
interface TradingChartProps {symbol?: string;}

export default function TradingChart({ symbol = 'SOL' }: TradingChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [selectedChain, setSelectedChain] = useState('solana');
  const [tokenAddress, setTokenAddress] = useState('So11111111111111111111111111111111111111112'); // SOL default
  const [isLoading, setIsLoading] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const chains = [
    { id: 'solana', name: 'Solana', prefix: 'solana' },
    { id: 'ethereum', name: 'Ethereum', prefix: 'ethereum' },
    { id: 'bsc', name: 'BSC', prefix: 'bsc' },
    { id: 'polygon', name: 'Polygon', prefix: 'polygon' },
    { id: 'arbitrum', name: 'Arbitrum', prefix: 'arbitrum' },
    { id: 'base', name: 'Base', prefix: 'base' }
  ];
  const timeframes = ['5M', '15M', '1H', '4H', '1D', '1W'];
  const popularTokens: { [key: string]: { address: string; symbol: string; chain: string }[] } = {
    solana: [
      { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', chain: 'solana' },
      { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', chain: 'solana' },
      { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', chain: 'solana' },
      { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', chain: 'solana' }
    ],
    ethereum: [
      { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', chain: 'ethereum' },
      { address: '0xA0b86a33E6417aB93cBc3C8fEe6Ef3C8D2c06C30', symbol: 'LINK', chain: 'ethereum' }
    ]
  };
  const handleAddressSubmit = () => {
    if (tokenAddress.trim()) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  };
  const handleQuickSelect = (token: { address: string; symbol: string; chain: string }) => {
    setTokenAddress(token.address);
    setSelectedChain(token.chain);
    setCurrentSymbol(token.symbol);
    handleAddressSubmit();
  };
  const getBirdeyeEmbedUrl = () => {
    const chainPrefix = chains.find(c => c.id === selectedChain)?.prefix || 'solana';
    return `https://birdeye.so/tv-widget/${tokenAddress}?chain=${chainPrefix}&viewMode=pair&chartInterval=15&chartType=Candle&chartTimezone=America%2FChicago&chartLeftToolbar=hide&theme=dark`;
  };
  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col space-y-2 p-3 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-green-400 font-bold">► TRADING CHART</h3>
          <div className="flex space-x-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2 py-1 text-xs rounded ${
                  selectedTimeframe === tf
                    ? 'bg-green-400 text-black'
                    : 'bg-gray-800 text-green-400 hover:bg-gray-700'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="flex space-x-2">
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-green-400 text-xs focus:outline-none focus:border-green-400"
          >
            {chains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="Enter token contract address..."
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-green-400 text-xs placeholder-gray-500 focus:outline-none focus:border-green-400"
            onKeyPress={(e) => e.key === 'Enter' && handleAddressSubmit()}
          />
          <button
            onClick={handleAddressSubmit}
            disabled={isLoading || !tokenAddress.trim()}
            className="px-3 py-1 bg-green-400 text-black text-xs rounded hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '...' : 'Load'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-gray-400 mr-2">Quick select:</span>
          {popularTokens[selectedChain]?.map((token) => (
            <button
              key={`${token.chain}-${token.address}`}
              onClick={() => handleQuickSelect(token)}
              className="px-2 py-1 bg-gray-700 text-green-400 text-xs rounded hover:bg-gray-600 transition-colors"
            >
              {token.symbol}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-green-400 animate-pulse">Loading chart for {currentSymbol}...</div>
          </div>
        ) : (
          <>
            <iframe
              src={getBirdeyeEmbedUrl()}
              className="w-full h-full border-0"
              title={`${currentSymbol} Chart`}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              allow="fullscreen"
              loading="lazy"
              style={{ height: '600px' }}
            />
          </>
        )}
      </div>
      <div className="p-2 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
        <span>Real-time data • {chains.find(c => c.id === selectedChain)?.name}</span>
        <span>TF: {selectedTimeframe}</span>
      </div>
    </div>
  );
} 