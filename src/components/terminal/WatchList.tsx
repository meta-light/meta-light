'use client';
import { useState, useEffect } from 'react';

interface WatchListItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

export default function WatchList() {
  const [watchList, setWatchList] = useState<WatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSymbol, setNewSymbol] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const defaultWatchList = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot'];
  useEffect(() => {
    fetchWatchListData();
    const interval = setInterval(fetchWatchListData, 30000);
    return () => clearInterval(interval);
  }, []);
  const fetchWatchListData = async () => {
    try {
      const savedWatchList = localStorage.getItem('crypto-watchlist');
      const watchListIds = savedWatchList ? JSON.parse(savedWatchList) : defaultWatchList;
      if (watchListIds.length === 0) {
        setWatchList([]);
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/coingecko/markets?vs_currency=usd&ids=${watchListIds.join(',')}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`);
      if (!response.ok) {throw new Error('Failed to fetch watchlist data');}
      const data = await response.json();
      setWatchList(data);
      setLoading(false);
    } 
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
    }
  };

  const addToWatchList = async () => {
    if (!newSymbol.trim()) return;
    setIsAdding(true);
    try {
      const searchResponse = await fetch(
        `/api/coingecko/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`
      );
      if (!searchResponse.ok) {
        throw new Error('Failed to search for coin');
      }
      const searchData = await searchResponse.json();
      const coin = searchData.find((c: any) => 
        c.symbol.toLowerCase() === newSymbol.toLowerCase() ||
        c.name.toLowerCase().includes(newSymbol.toLowerCase())
      );
      if (!coin) {
        alert('Coin not found');
        setIsAdding(false);
        return;
      }
      const savedWatchList = localStorage.getItem('crypto-watchlist');
      const currentIds = savedWatchList ? JSON.parse(savedWatchList) : defaultWatchList;
      if (!currentIds.includes(coin.id)) {
        const newIds = [...currentIds, coin.id];
        localStorage.setItem('crypto-watchlist', JSON.stringify(newIds));
        await fetchWatchListData();
      }
      setNewSymbol('');
    } 
    catch (err) {
      alert('Error adding coin to watchlist');
    }
    setIsAdding(false);
  };
  const removeFromWatchList = (coinId: string) => {
    const savedWatchList = localStorage.getItem('crypto-watchlist');
    const currentIds = savedWatchList ? JSON.parse(savedWatchList) : defaultWatchList;
    const newIds = currentIds.filter((id: string) => id !== coinId);
    localStorage.setItem('crypto-watchlist', JSON.stringify(newIds));
    fetchWatchListData();
  };
  const formatPrice = (price: number): string => {
    return `$${price.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: price < 1 ? 6 : 2 
    })}`;
  };
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-green-400 animate-pulse">► Loading watchlist...</div>
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-green-400 font-bold">► WATCHLIST</h3>
        <div className="text-xs text-gray-400">
          {watchList.length} items
        </div>
      </div>
      <div className="p-2 border-b border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Add symbol (e.g., BTC)"
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-green-400 text-xs placeholder-gray-500 focus:outline-none focus:border-green-400"
            onKeyPress={(e) => e.key === 'Enter' && addToWatchList()}
          />
          <button
            onClick={addToWatchList}
            disabled={isAdding || !newSymbol.trim()}
            className="px-3 py-1 bg-green-400 text-black text-xs rounded hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? '...' : '+'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {watchList.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            No items in watchlist. Add some above!
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {watchList.map((coin) => (
              <div
                key={coin.id}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-800 transition-colors border border-gray-700 group"
              >
                <div className="flex items-center space-x-2">
                  <div>
                    <div className="text-green-400 font-bold text-sm">
                      {coin.symbol.toUpperCase()}
                    </div>
                    <div className="text-gray-400 text-xs truncate max-w-16">
                      {coin.name}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-1">
                  <div className="text-green-400 text-sm font-mono">
                    {formatPrice(coin.current_price)}
                  </div>
                  <div className={`text-xs ${
                    coin.price_change_percentage_24h >= 0 
                      ? 'text-green-400' 
                      : 'text-red-400'
                  }`}>
                    {coin.price_change_percentage_24h >= 0 ? '+' : ''}
                    {coin.price_change_percentage_24h.toFixed(2)}%
                  </div>
                </div>
                <button
                  onClick={() => removeFromWatchList(coin.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs ml-2 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-2 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
        <span>Real-time data</span>
        <span>Last: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
} 