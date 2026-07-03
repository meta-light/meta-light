'use client';
import { useState, useEffect } from 'react';

interface Mover {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

export default function TopMovers() {
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [selectedView, setSelectedView] = useState<'gainers' | 'losers'>('gainers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchMovers = async () => {
      try {
        const response = await fetch('/api/coingecko/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h');
        if (!response.ok) {throw new Error('Failed to fetch movers data');}
        const data: Mover[] = await response.json();
        const validData = data.filter(coin => coin.price_change_percentage_24h !== null);
        const sortedGainers = validData
          .filter(coin => coin.price_change_percentage_24h > 0)
          .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
          .slice(0, 10);
        const sortedLosers = validData
          .filter(coin => coin.price_change_percentage_24h < 0)
          .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
          .slice(0, 10);
        setGainers(sortedGainers);
        setLosers(sortedLosers);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLoading(false);
      }
    };
    fetchMovers();
    const interval = setInterval(fetchMovers, 60000);
    return () => clearInterval(interval);
  }, []);
  const formatPrice = (price: number): string => {
    return `$${price.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: price < 1 ? 6 : 2 
    })}`;
  };
  const formatMarketCap = (marketCap: number): string => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toFixed(0)}`;
  };
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-green-400 animate-pulse">► Loading movers...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400">► Error: {error}</div>
      </div>
    );
  }
  const currentData = selectedView === 'gainers' ? gainers : losers;
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-green-400 font-bold">► TOP MOVERS</h3>
        <div className="flex space-x-1">
          <button
            onClick={() => setSelectedView('gainers')}
            className={`px-3 py-1 text-xs rounded ${
              selectedView === 'gainers'
                ? 'bg-green-400 text-black'
                : 'bg-gray-800 text-green-400 hover:bg-gray-700'
            }`}
          >
            Gainers
          </button>
          <button
            onClick={() => setSelectedView('losers')}
            className={`px-3 py-1 text-xs rounded ${
              selectedView === 'losers'
                ? 'bg-red-400 text-black'
                : 'bg-gray-800 text-green-400 hover:bg-gray-700'
            }`}
          >
            Losers
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {currentData.map((coin, index) => (
            <div
              key={coin.id}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-800 transition-colors border border-gray-700"
            >
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-xs w-4">#{index + 1}</span>
                <div>
                  <div className="text-green-400 font-bold text-sm">
                    {coin.symbol.toUpperCase()}
                  </div>
                  <div className="text-gray-400 text-xs truncate max-w-16">
                    {coin.name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-green-400 text-sm font-mono">
                  {formatPrice(coin.current_price)}
                </div>
                <div className="text-xs text-gray-400">
                  {formatMarketCap(coin.market_cap)}
                </div>
              </div>
              <div className={`text-right ${
                coin.price_change_percentage_24h >= 0 
                  ? 'text-green-400' 
                  : 'text-red-400'
              }`}>
                <div className="text-sm font-bold">
                  {coin.price_change_percentage_24h >= 0 ? '+' : ''}
                  {coin.price_change_percentage_24h.toFixed(2)}%
                </div>
                <div className="text-xs">24h</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-2 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
        <span>
          {selectedView === 'gainers' ? `${gainers.length} gainers` : `${losers.length} losers`}
        </span>
        <span>Last: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
} 