'use client';

import { useState, useEffect } from 'react';

interface MarketData {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

interface GlobalData {
  active_cryptocurrencies: number;
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_change_percentage_24h_usd: number;
}

export default function MarketOverview() {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch('/api/coingecko/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin,solana,cardano&order=market_cap_desc&per_page=5&page=1&sparkline=false');
        if (!response.ok) {throw new Error('Failed to fetch market data');}
        const data = await response.json();
        setMarketData(data);
        const globalResponse = await fetch('/api/coingecko/global');
        if (globalResponse.ok) {const globalData = await globalResponse.json(); setGlobalData(globalData.data);}
        setLoading(false);
      } 
      catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLoading(false);
      }
    };
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);
  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };
  const formatPrice = (price: number): string => {
    return `$${price.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: price < 1 ? 6 : 2 
    })}`;
  };
  if (loading) {
    return (
      <div className="p-4">
        <div className="text-green-400 animate-pulse">► Loading market data...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-400">► Error: {error}</div>
      </div>
    );
  }
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-green-400 font-bold">► MARKET OVERVIEW</h2>
        <div className="text-sm text-green-300">
          Last Updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
      {globalData && (
        <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
          <div className="border border-gray-700 p-2 rounded">
            <div className="text-gray-400">Total Market Cap</div>
            <div className="text-green-400 font-bold">
              {formatNumber(globalData.total_market_cap.usd)}
            </div>
            <div className={`text-xs ${globalData.market_cap_change_percentage_24h_usd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {globalData.market_cap_change_percentage_24h_usd >= 0 ? '+' : ''}
              {globalData.market_cap_change_percentage_24h_usd.toFixed(2)}%
            </div>
          </div>
          <div className="border border-gray-700 p-2 rounded">
            <div className="text-gray-400">24h Volume</div>
            <div className="text-green-400 font-bold">
              {formatNumber(globalData.total_volume.usd)}
            </div>
          </div>
          <div className="border border-gray-700 p-2 rounded">
            <div className="text-gray-400">Fear & Greed</div>
            <div className="text-yellow-400 font-bold">NEUTRAL</div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-5 gap-4">
        {marketData.map((coin) => (
          <div key={coin.id} className="border border-gray-700 p-3 rounded">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-green-400 font-bold text-sm">{coin.symbol.toUpperCase()}</div>
                <div className="text-gray-400 text-xs">{coin.name}</div>
              </div>
              <div className={`text-xs px-1 py-0.5 rounded ${
                coin.price_change_percentage_24h >= 0 
                  ? 'bg-green-900 text-green-400' 
                  : 'bg-red-900 text-red-400'
              }`}>
                {coin.price_change_percentage_24h >= 0 ? '+' : ''}
                {coin.price_change_percentage_24h.toFixed(2)}%
              </div>
            </div>
            <div className="text-green-400 font-bold text-lg">
              {formatPrice(coin.current_price)}
            </div>
            <div className="text-gray-400 text-xs">
              MCap: {formatNumber(coin.market_cap)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 