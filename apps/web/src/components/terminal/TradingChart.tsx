'use client';
import { useState, useEffect } from 'react';
import SignalPanel from './SignalPanel';
interface TradingChartProps {symbol?: string;}

const DEFAULT_TOKEN = {address: 'So11111111111111111111111111111111111111112', chain: 'solana'};

export default function TradingChart({ symbol = 'SOL' }: TradingChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [selectedChain, setSelectedChain] = useState('solana');
  const [tokenAddress, setTokenAddress] = useState(DEFAULT_TOKEN.address); // SOL default
  const [isLoading, setIsLoading] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  // The iframe follows the input as you type; the signal panel below hits CoinGecko, so it
  // tracks the last explicitly loaded token instead of every keystroke.
  const [loadedToken, setLoadedToken] = useState(DEFAULT_TOKEN);
  // `coingecko` is the asset-platform id used by CoinGecko's by-contract endpoints, which
  // does not always match Birdeye's chain prefix.
  const chains = [
    { id: 'solana', name: 'Solana', prefix: 'solana', coingecko: 'solana' },
    { id: 'ethereum', name: 'Ethereum', prefix: 'ethereum', coingecko: 'ethereum' },
    { id: 'bsc', name: 'BSC', prefix: 'bsc', coingecko: 'binance-smart-chain' },
    { id: 'polygon', name: 'Polygon', prefix: 'polygon', coingecko: 'polygon-pos' },
    { id: 'arbitrum', name: 'Arbitrum', prefix: 'arbitrum', coingecko: 'arbitrum-one' },
    { id: 'base', name: 'Base', prefix: 'base', coingecko: 'base' }
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
  // Quick-select sets state and submits in the same tick, so the token has to be passed in
  // explicitly rather than read back from the (still stale) state.
  const handleAddressSubmit = (address: string = tokenAddress, chain: string = selectedChain) => {
    if (address.trim()) {
      setIsLoading(true);
      setLoadedToken({ address: address.trim(), chain });
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  };
  const handleQuickSelect = (token: { address: string; symbol: string; chain: string }) => {
    setTokenAddress(token.address);
    setSelectedChain(token.chain);
    setCurrentSymbol(token.symbol);
    handleAddressSubmit(token.address, token.chain);
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
            onClick={() => handleAddressSubmit()}
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
      <SignalPanel
        platform={chains.find(c => c.id === loadedToken.chain)?.coingecko ?? null}
        address={loadedToken.address}
        symbol={currentSymbol}
      />
    </div>
  );
} 