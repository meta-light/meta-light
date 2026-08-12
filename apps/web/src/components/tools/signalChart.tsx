"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CHAIN_CONFIG, generateContinuousSignal, TokenData } from '../../lib/signals';
import { buildSignalSeries, MIN_LOOKBACK, SignalSeries, tokenDataFromMarketChart } from '../../lib/signalSeries';
import {
  OSCILLATORS, OVERLAYS, Oscillator, RANGES,
  buildOscillatorConfig, buildPriceConfig, buildScoreConfig, useChart
} from '../../lib/signalChartKit';

interface MarketCoin {id: string; symbol: string; name: string;}

export default function SignalChart() {
  const [coins, setCoins] = useState<MarketCoin[]>([]);
  const [coinId, setCoinId] = useState('bitcoin');
  const [days, setDays] = useState('90');
  const [series, setSeries] = useState<SignalSeries | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeOverlays, setActiveOverlays] = useState<string[]>(['sma20', 'sma50']);
  const [oscillator, setOscillator] = useState<Oscillator>('RSI');
  const [activeStrategies, setActiveStrategies] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/coingecko/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1')
      .then(res => res.ok ? res.json() : Promise.reject(new Error('markets fetch failed')))
      .then(data => {if (!cancelled && Array.isArray(data)) setCoins(data.map((c: any) => ({ id: c.id, symbol: c.symbol, name: c.name })));})
      .catch(() => {/* the coin list is a convenience; the chart still works with the default id */});
    return () => {cancelled = true;};
  }, []);

  const loadChart = async (id: string, range: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coingecko/market-chart?id=${encodeURIComponent(id)}&vs_currency=usd&days=${range}`);
      if (!res.ok) {const body = await res.json().catch(() => ({})); throw new Error(body.error || `Request failed (${res.status})`);}
      const data = await res.json();
      const prices: [number, number][] = data.prices || [];
      if (prices.length <= MIN_LOOKBACK) {throw new Error(`Not enough price history to compute signals (${prices.length} points, need > ${MIN_LOOKBACK})`);}
      const ticker = (coins.find(c => c.id === id)?.symbol || id).toUpperCase();
      const token = tokenDataFromMarketChart(ticker, id, prices);
      setTokenData(token);
      setSeries(buildSignalSeries(token, DEFAULT_CHAIN_CONFIG));
    }
    catch (err: any) {setError(err.message || 'Failed to load chart data'); setSeries(null); setTokenData(null);}
    setLoading(false);
  };

  useEffect(() => {loadChart(coinId, days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinId, days]);

  const labels = useMemo(() => (series?.points || []).map(p => new Date(p.timestamp).toLocaleDateString()), [series]);

  const priceConfig = useMemo(() => series ? buildPriceConfig(series.points, labels, activeOverlays) : null, [series, labels, activeOverlays]);
  const scoreConfig = useMemo(() => series ? buildScoreConfig(series.points, labels, activeStrategies) : null, [series, labels, activeStrategies]);
  const oscillatorConfig = useMemo(() => series ? buildOscillatorConfig(series.points, labels, oscillator) : null, [series, labels, oscillator]);

  const priceCanvas = useChart(priceConfig, [priceConfig]);
  const scoreCanvas = useChart(scoreConfig, [scoreConfig]);
  const oscCanvas = useChart(oscillatorConfig, [oscillatorConfig]);

  const latest = useMemo(() => tokenData ? generateContinuousSignal(tokenData, DEFAULT_CHAIN_CONFIG) : null, [tokenData]);
  const latestPoint = series?.points[series.points.length - 1];

  const toggle = (list: string[], setList: (v: string[]) => void, key: string) =>
    setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);

  const scoreColor = (score: number) => score > 0.1 ? 'text-green-400' : score < -0.1 ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="terminal-tool">
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-green-400 text-sm font-mono mb-2">&gt; Coin (CoinGecko id):</label>
          {coins.length > 0 ? (
            <select
              value={coinId}
              onChange={(e) => setCoinId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-green-600 rounded text-green-400 font-mono focus:outline-none focus:border-green-400"
            >
              {coins.map(c => (<option key={c.id} value={c.id}>{c.symbol.toUpperCase()} — {c.name}</option>))}
            </select>
          ) : (
            <input
              type="text"
              value={coinId}
              onChange={(e) => setCoinId(e.target.value.trim())}
              placeholder="bitcoin"
              className="w-full px-3 py-2 bg-gray-800 border border-green-600 rounded text-green-400 font-mono placeholder-green-700 focus:outline-none focus:border-green-400"
            />
          )}
        </div>
        <div>
          <label className="block text-green-400 text-sm font-mono mb-2">&gt; Range:</label>
          <div className="flex flex-wrap gap-2">
            {RANGES.map(r => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-2 text-sm font-mono border rounded transition-colors ${days === r.days ? 'border-green-400 bg-green-900/30 text-green-300' : 'border-green-800 text-green-600 hover:border-green-600 hover:text-green-400'}`}
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={() => loadChart(coinId, days)}
              disabled={loading}
              className="px-3 py-2 text-sm font-mono border border-green-600 rounded bg-green-900 text-green-400 hover:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-600 transition-colors"
            >
              {loading ? '[LOADING...]' : '[REFRESH]'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-600 rounded">
          <p className="text-red-400 font-mono text-sm"><span className="text-red-600">ERROR:</span> {error}</p>
        </div>
      )}

      {loading && !series && (<div className="text-green-600 font-mono text-sm">&gt; Fetching CoinGecko price history and computing signals...</div>)}

      {series && latest && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gray-800 border border-green-600 rounded p-3 font-mono">
              <div className="text-green-600 text-xs">AGGREGATE SCORE</div>
              <div className={`text-xl ${scoreColor(latest.score)}`}>{latest.score.toFixed(3)}</div>
            </div>
            <div className="bg-gray-800 border border-green-600 rounded p-3 font-mono">
              <div className="text-green-600 text-xs">STRENGTH</div>
              <div className="text-xl text-green-400">{latest.strength.toFixed(3)}</div>
            </div>
            <div className="bg-gray-800 border border-green-600 rounded p-3 font-mono">
              <div className="text-green-600 text-xs">CONFIDENCE</div>
              <div className="text-xl text-green-400">{(latest.confidence * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-gray-800 border border-green-600 rounded p-3 font-mono">
              <div className="text-green-600 text-xs">MARKET CONDITION</div>
              <div className="text-xl text-blue-400">{latestPoint?.marketCondition ?? '—'}</div>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-green-600 font-mono text-sm">&gt; Overlays:</span>
              {OVERLAYS.map(o => (
                <button
                  key={o.key}
                  onClick={() => toggle(activeOverlays, setActiveOverlays, o.key)}
                  className={`px-2 py-1 text-xs font-mono border rounded transition-colors ${activeOverlays.includes(o.key) ? 'border-green-400 bg-green-900/30 text-green-300' : 'border-green-800 text-green-600 hover:border-green-600'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="bg-gray-900 border border-green-800 rounded p-3" style={{ height: 340 }}>
              <canvas ref={priceCanvas} />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-green-600 font-mono text-sm">&gt; Signal scores (-1 sell &rarr; +1 buy):</span>
              {series.strategies.map(name => (
                <button
                  key={name}
                  onClick={() => toggle(activeStrategies, setActiveStrategies, name)}
                  className={`px-2 py-1 text-xs font-mono border rounded transition-colors ${activeStrategies.includes(name) ? 'border-green-400 bg-green-900/30 text-green-300' : 'border-green-800 text-green-600 hover:border-green-600'}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="bg-gray-900 border border-green-800 rounded p-3" style={{ height: 300 }}>
              <canvas ref={scoreCanvas} />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-green-600 font-mono text-sm">&gt; Oscillator:</span>
              {OSCILLATORS.map(o => (
                <button
                  key={o}
                  onClick={() => setOscillator(o)}
                  className={`px-2 py-1 text-xs font-mono border rounded transition-colors ${oscillator === o ? 'border-green-400 bg-green-900/30 text-green-300' : 'border-green-800 text-green-600 hover:border-green-600'}`}
                >
                  {o}
                </button>
              ))}
            </div>
            <div className="bg-gray-900 border border-green-800 rounded p-3" style={{ height: 260 }}>
              <canvas ref={oscCanvas} />
            </div>
          </div>

          <details className="bg-gray-800 border border-green-600 rounded">
            <summary className="cursor-pointer p-4 text-blue-400 font-mono hover:text-blue-300">&gt; [EXPAND] Latest indicator breakdown</summary>
            <div className="p-4 border-t border-green-600 overflow-x-auto">
              <table className="w-full text-xs font-mono text-green-400">
                <thead>
                  <tr className="text-green-600 text-left">
                    <th className="py-1 pr-4">STRATEGY</th>
                    <th className="py-1 pr-4">SCORE</th>
                    <th className="py-1 pr-4">STRENGTH</th>
                    <th className="py-1 pr-4">THRESHOLD</th>
                    <th className="py-1 pr-4">WEIGHT</th>
                    <th className="py-1 pr-4">RISK-ADJ</th>
                    <th className="py-1 pr-4">RAW</th>
                    <th className="py-1">MET</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.indicatorResults.map(r => (
                    <tr key={r.strategyName} className="border-t border-green-900">
                      <td className="py-1 pr-4">{r.strategyName}</td>
                      <td className={`py-1 pr-4 ${scoreColor(r.signal.score)}`}>{r.signal.score.toFixed(3)}</td>
                      <td className="py-1 pr-4">{r.signal.strength.toFixed(3)}</td>
                      <td className="py-1 pr-4">{r.threshold}</td>
                      <td className="py-1 pr-4">{r.weight.toFixed(2)}</td>
                      <td className="py-1 pr-4">{r.riskAdjustedScore.toFixed(3)}</td>
                      <td className="py-1 pr-4">{r.signal.rawValue !== undefined ? r.signal.rawValue.toFixed(4) : '—'}</td>
                      <td className={`py-1 ${r.meetsThreshold ? 'text-green-400' : 'text-gray-500'}`}>{r.meetsThreshold ? 'YES' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="text-green-700 text-xs font-mono">
            <span className="text-green-600">[INFO]</span> {series.points.length} plotted points from {tokenData?.priceHistory.length} sampled prices.
            Signals are evaluated on an expanding window, so each point reflects only data available at that time.
            Liquidity_Based falls back to its volatility proxy — CoinGecko does not provide spread or depth data.
          </div>
        </div>
      )}
    </div>
  );
}
