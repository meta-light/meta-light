'use client';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CHAIN_CONFIG, generateContinuousSignal, TokenData } from '../../lib/signals';
import { buildSignalSeries, MIN_LOOKBACK, SignalSeries, tokenDataFromMarketChart } from '../../lib/signalSeries';
import {
  OSCILLATORS, OVERLAYS, Oscillator, STRATEGY_COLORS,
  baseOptions, buildOscillatorConfig, buildPriceConfig, buildScoreConfig, useChart
} from '../../lib/signalChartKit';

interface SignalPanelProps {
  // CoinGecko asset-platform id for the chart's chain (e.g. 'solana', 'binance-smart-chain'),
  // or null when the chain has no CoinGecko equivalent.
  platform: string | null;
  address: string;
  symbol: string;
}

const RANGES = [
  { label: '30D', days: '30' },
  { label: '90D', days: '90' },
  { label: '180D', days: '180' },
  { label: '1Y', days: '365' }
];

// The Birdeye iframe above owns most of the column height, so the panel charts run shorter
// than the standalone tool's and the legend is dropped from the price chart (the overlay
// buttons already name what is drawn).
const CHART_HEIGHT = 220;
const compactOptions = (yOverrides: any = {}) => baseOptions(yOverrides);

function verdict(score: number, strength: number) {
  if (strength < 0.15) return { label: 'NEUTRAL', className: 'text-yellow-400' };
  if (score > 0.3) return { label: 'BULLISH', className: 'text-green-400' };
  if (score > 0.1) return { label: 'LEAN BULL', className: 'text-green-500' };
  if (score < -0.3) return { label: 'BEARISH', className: 'text-red-400' };
  if (score < -0.1) return { label: 'LEAN BEAR', className: 'text-red-500' };
  return { label: 'NEUTRAL', className: 'text-yellow-400' };
}

const scoreColor = (score: number) => score > 0.1 ? 'text-green-400' : score < -0.1 ? 'text-red-400' : 'text-yellow-400';

export default function SignalPanel({ platform, address, symbol }: SignalPanelProps) {
  const [days, setDays] = useState('90');
  const [series, setSeries] = useState<SignalSeries | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<string[]>(['sma20', 'sma50']);
  const [oscillator, setOscillator] = useState<Oscillator>('RSI');
  const [activeStrategies, setActiveStrategies] = useState<string[]>([]);

  useEffect(() => {
    if (collapsed) return;
    if (!platform) {setError('This chain has no CoinGecko asset platform mapping'); setSeries(null); setTokenData(null); return;}
    if (!address.trim()) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/coingecko/contract-market-chart?platform=${encodeURIComponent(platform)}&address=${encodeURIComponent(address)}&vs_currency=usd&days=${days}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
        const prices: [number, number][] = body.prices || [];
        if (prices.length <= MIN_LOOKBACK) throw new Error(`Not enough price history to compute signals (${prices.length} points, need > ${MIN_LOOKBACK})`);
        // Fewer points than the standalone tool: the panel is narrower, and the O(n^2)
        // series build runs on every token switch here rather than on an explicit load.
        const token = tokenDataFromMarketChart(symbol.toUpperCase(), address, prices, 300);
        if (cancelled) return;
        setTokenData(token);
        setSeries(buildSignalSeries(token, DEFAULT_CHAIN_CONFIG));
      }
      catch (err: any) {
        if (cancelled) return;
        setError(err.message || 'Failed to load signal data');
        setSeries(null);
        setTokenData(null);
      }
      if (!cancelled) setLoading(false);
    };
    run();
    return () => {cancelled = true;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, address, days, collapsed]);

  const labels = useMemo(() => (series?.points || []).map(p => new Date(p.timestamp).toLocaleDateString()), [series]);
  const priceConfig = useMemo(() => series ? buildPriceConfig(series.points, labels, activeOverlays, compactOptions()) : null, [series, labels, activeOverlays]);
  const scoreConfig = useMemo(() => series ? buildScoreConfig(series.points, labels, activeStrategies, compactOptions({ min: -1, max: 1 })) : null, [series, labels, activeStrategies]);
  const oscillatorConfig = useMemo(() => series ? buildOscillatorConfig(series.points, labels, oscillator, compactOptions) : null, [series, labels, oscillator]);

  const priceCanvas = useChart(priceConfig, [priceConfig]);
  const scoreCanvas = useChart(scoreConfig, [scoreConfig]);
  const oscCanvas = useChart(oscillatorConfig, [oscillatorConfig]);

  const latest = useMemo(() => tokenData ? generateContinuousSignal(tokenData, DEFAULT_CHAIN_CONFIG) : null, [tokenData]);
  const latestPoint = series?.points[series.points.length - 1];
  const call = latest ? verdict(latest.score, latest.strength) : null;

  const toggle = (list: string[], setList: (v: string[]) => void, key: string) =>
    setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);

  const tabClass = (active: boolean) =>
    `px-2 py-1 text-xs rounded ${active ? 'bg-green-400 text-black' : 'bg-gray-800 text-green-400 hover:bg-gray-700'}`;

  return (
    <div className="border-t border-gray-700">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <div className="flex items-baseline space-x-3">
          <h3 className="text-green-400 font-bold">► SIGNAL ANALYSIS</h3>
          <span className="text-xs text-gray-400">{symbol} • {address.slice(0, 4)}...{address.slice(-4)}</span>
          {call && !loading && (<span className={`text-xs font-bold ${call.className}`}>{call.label}</span>)}
        </div>
        <div className="flex space-x-1">
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setDays(r.days)} className={tabClass(days === r.days)}>{r.label}</button>
          ))}
          <button onClick={() => setCollapsed(!collapsed)} className="px-2 py-1 text-xs rounded bg-gray-800 text-green-400 hover:bg-gray-700">
            {collapsed ? '[+]' : '[-]'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-3">
          {error && (<div className="p-2 bg-red-900/40 border border-red-600 rounded text-xs text-red-400">ERROR: {error}</div>)}
          {loading && (<div className="text-green-400 text-xs animate-pulse">Computing signals for {symbol}...</div>)}

          {series && latest && !loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="bg-gray-800 border border-gray-700 rounded p-2">
                  <div className="text-gray-400 text-[10px]">SCORE</div>
                  <div className={`text-lg ${scoreColor(latest.score)}`}>{latest.score.toFixed(3)}</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded p-2">
                  <div className="text-gray-400 text-[10px]">STRENGTH</div>
                  <div className="text-lg text-green-400">{latest.strength.toFixed(3)}</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded p-2">
                  <div className="text-gray-400 text-[10px]">CONFIDENCE</div>
                  <div className="text-lg text-green-400">{(latest.confidence * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded p-2">
                  <div className="text-gray-400 text-[10px]">CONDITION</div>
                  <div className="text-lg text-blue-400">{latestPoint?.marketCondition ?? '—'}</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded p-2">
                  <div className="text-gray-400 text-[10px]">RSI</div>
                  <div className="text-lg text-pink-400">{latestPoint?.rsi != null ? latestPoint.rsi.toFixed(1) : '—'}</div>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  <span className="text-gray-400 text-[10px] mr-1">OVERLAYS:</span>
                  {OVERLAYS.map(o => (
                    <button key={o.key} onClick={() => toggle(activeOverlays, setActiveOverlays, o.key)} className={tabClass(activeOverlays.includes(o.key))}>{o.label}</button>
                  ))}
                </div>
                <div style={{ height: CHART_HEIGHT }}><canvas ref={priceCanvas} /></div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  <span className="text-gray-400 text-[10px] mr-1">SCORES (-1 SELL → +1 BUY):</span>
                  {series.strategies.map(name => (
                    <button
                      key={name}
                      onClick={() => toggle(activeStrategies, setActiveStrategies, name)}
                      className={tabClass(activeStrategies.includes(name))}
                      style={activeStrategies.includes(name) ? { backgroundColor: STRATEGY_COLORS[name] } : undefined}
                    >
                      {name.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                <div style={{ height: CHART_HEIGHT }}><canvas ref={scoreCanvas} /></div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  <span className="text-gray-400 text-[10px] mr-1">OSCILLATOR:</span>
                  {OSCILLATORS.map(o => (
                    <button key={o} onClick={() => setOscillator(o)} className={tabClass(oscillator === o)}>{o}</button>
                  ))}
                </div>
                <div style={{ height: CHART_HEIGHT }}><canvas ref={oscCanvas} /></div>
              </div>

              <details className="bg-gray-800 border border-gray-700 rounded">
                <summary className="cursor-pointer p-2 text-xs text-blue-400 hover:text-blue-300">► Indicator breakdown ({latest.indicatorResults.length} strategies)</summary>
                <div className="p-2 border-t border-gray-700 overflow-x-auto">
                  <table className="w-full text-[11px] text-green-400">
                    <thead>
                      <tr className="text-gray-400 text-left">
                        <th className="py-1 pr-3">STRATEGY</th>
                        <th className="py-1 pr-3">SCORE</th>
                        <th className="py-1 pr-3">STRENGTH</th>
                        <th className="py-1 pr-3">WEIGHT</th>
                        <th className="py-1 pr-3">RISK-ADJ</th>
                        <th className="py-1">MET</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latest.indicatorResults.map(r => (
                        <tr key={r.strategyName} className="border-t border-gray-700">
                          <td className="py-1 pr-3">{r.strategyName}</td>
                          <td className={`py-1 pr-3 ${scoreColor(r.signal.score)}`}>{r.signal.score.toFixed(3)}</td>
                          <td className="py-1 pr-3">{r.signal.strength.toFixed(3)}</td>
                          <td className="py-1 pr-3">{r.weight.toFixed(2)}</td>
                          <td className="py-1 pr-3">{r.riskAdjustedScore.toFixed(3)}</td>
                          <td className={`py-1 ${r.meetsThreshold ? 'text-green-400' : 'text-gray-500'}`}>{r.meetsThreshold ? 'YES' : 'no'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <div className="text-[10px] text-gray-500">
                CoinGecko price history • {series.points.length} points • expanding-window evaluation (no lookahead) •
                Liquidity_Based uses its volatility fallback (no spread/depth data)
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
