'use client';
import { useState, useEffect } from 'react';
import { fetchAllNews, fetchNewsAPI, fetchCryptoPanic, fetchFinancialModelingPrep, NewsItem } from '../../lib/newsApi';

export default function NewsPanel() {
  const [selectedTab, setSelectedTab] = useState<'all' | 'newsapi' | 'cryptopanic' | 'analysis'>('all');
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 300000);
    return () => clearInterval(interval);
  }, []);
  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      let news: NewsItem[] = [];
      switch (selectedTab) {
        case 'newsapi':
          news = await fetchNewsAPI();
          break;
        case 'cryptopanic':
          news = await fetchCryptoPanic();
          break;
        case 'analysis':
          news = await fetchFinancialModelingPrep();
          break;
        default:
          news = await fetchAllNews();
      }
      setNewsItems(news);
      setLastUpdate(new Date());
    } 
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
    } 
    finally {
      setLoading(false);
    }
  };
  const filteredNews = selectedTab === 'all' 
    ? newsItems 
    : newsItems.filter(item => {
        switch (selectedTab) {
          case 'newsapi':
            return item.id.startsWith('newsapi-');
          case 'cryptopanic':
            return item.id.startsWith('cryptopanic-');
          case 'analysis':
            return item.type === 'analysis';
          default:
            return true;
        }
      });
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'news': return '📰';
      case 'social': return '🐦';
      case 'analysis': return '📊';
      default: return '📄';
    }
  };
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-green-400 font-bold">► NEWS FEED</h3>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="px-2 py-1 bg-gray-800 text-green-400 text-xs rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? '...' : '↻'}
        </button>
      </div>
      <div className="flex border-b border-gray-700">
        {[
          { key: 'all', label: 'All' },
          { key: 'newsapi', label: 'News' },
          { key: 'cryptopanic', label: 'CryptoPanic' },
          { key: 'analysis', label: 'Analysis' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setSelectedTab(tab.key as any);
              if (tab.key !== 'all') {fetchNews();}
            }}
            className={`flex-1 px-3 py-2 text-xs transition-colors ${
              selectedTab === tab.key
                ? 'bg-green-400 text-black'
                : 'bg-gray-800 text-green-400 hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && newsItems.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-green-400 animate-pulse">► Loading news...</div>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <div className="text-red-400">► Error: {error}</div>
            <button onClick={fetchNews} className="mt-2 px-3 py-1 bg-green-400 text-black text-xs rounded hover:bg-green-300">Retry</button>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="p-4 text-center text-gray-400">No news available for this category.</div>
        ) : (
          <div className="p-3 space-y-3">
            {filteredNews.slice(0, 20).map((item) => (
              <div key={item.id} className="border border-gray-700 p-3 rounded hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => item.url !== '#' && window.open(item.url, '_blank')}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs">{getTypeIcon(item.type)}</span>
                    <div className={`text-xs font-bold ${getImpactColor(item.impact)}`}>● {item.impact.toUpperCase()}</div>
                  </div>
                  <div className="text-xs text-gray-400">{item.time}</div>
                </div>
                <div className="text-green-400 text-sm mb-1 line-clamp-2 leading-tight">{item.title}</div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-400">{item.source}</div>
                  {item.url !== '#' && (<div className="text-xs text-green-300 hover:text-green-200"> → Read more</div>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-2 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
        <span>{loading ? 'Updating...' : `${filteredNews.length} articles`}</span>
        <span>Last: {lastUpdate.toLocaleTimeString()}</span>
      </div>
    </div>
  );
} 