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

export default function TopMoversMarquee() {
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovers = async () => {
      try {
        const response = await fetch('/api/coingecko/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h');
        if (!response.ok) {throw new Error('Failed to fetch movers data');}
        const data: Mover[] = await response.json();
        const validData = data.filter(coin => coin.price_change_percentage_24h !== null);
        const sortedGainers = validData
          .filter(coin => coin.price_change_percentage_24h > 0)
          .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
          .slice(0, 8);
        const sortedLosers = validData
          .filter(coin => coin.price_change_percentage_24h < 0)
          .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
          .slice(0, 8);
        setGainers(sortedGainers);
        setLosers(sortedLosers);
        setLoading(false);
      } 
      catch (err) {
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
      maximumFractionDigits: price < 1 ? 4 : 2 
    })}`;
  };
  if (loading) {
    return (
      <div className="bg-gray-900 border-b border-green-400 p-2">
        <div className="text-green-400 text-sm animate-pulse">► Loading top movers...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-gray-900 border-b border-green-400 p-2">
        <div className="text-red-400 text-sm">► Error loading movers: {error}</div>
      </div>
    );
  }
  const allMovers = [...gainers, ...losers];
  return (
    <div className="bg-gray-900 border-b border-green-400 py-2 overflow-hidden">
      <div className="flex items-center space-x-4 px-4 mb-1">
        <span className="text-green-400 font-bold text-sm">► TOP MOVERS</span>
        <span className="text-xs text-gray-400">
          {gainers.length} gainers • {losers.length} losers
        </span>
      </div>
      <div className="relative overflow-hidden">
        <div className="flex animate-marquee space-x-6 whitespace-nowrap">
          {allMovers.map((mover, index) => (
            <div
              key={`${mover.id}-1`}
              className="flex items-center space-x-2 px-4 py-1 bg-gray-800 rounded-lg min-w-fit"
            >
              <span className="text-green-400 font-bold text-sm">
                {mover.symbol.toUpperCase()}
              </span>
              <span className="text-green-400 text-sm">
                {formatPrice(mover.current_price)}
              </span>
              <span
                className={`text-sm font-bold ${
                  mover.price_change_percentage_24h >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {mover.price_change_percentage_24h >= 0 ? '+' : ''}
                {mover.price_change_percentage_24h.toFixed(2)}%
              </span>
            </div>
          ))}
          {allMovers.map((mover, index) => (
            <div
              key={`${mover.id}-2`}
              className="flex items-center space-x-2 px-4 py-1 bg-gray-800 rounded-lg min-w-fit"
            >
              <span className="text-green-400 font-bold text-sm">
                {mover.symbol.toUpperCase()}
              </span>
              <span className="text-green-400 text-sm">
                {formatPrice(mover.current_price)}
              </span>
              <span
                className={`text-sm font-bold ${
                  mover.price_change_percentage_24h >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {mover.price_change_percentage_24h >= 0 ? '+' : ''}
                {mover.price_change_percentage_24h.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 