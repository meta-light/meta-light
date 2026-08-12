// Shared chart.js plumbing for the signal charts. Both the tools-page chart and the terminal
// signal panel render the same series from ./signalSeries, so the dataset builders and the
// terminal-green styling live here rather than being duplicated per component.

import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { SignalSeriesPoint } from './signalSeries';

export const RANGES = [
  { label: '30d', days: '30' },
  { label: '90d', days: '90' },
  { label: '180d', days: '180' },
  { label: '1y', days: '365' },
  { label: 'max', days: 'max' }
] as const;

export const OVERLAYS = [
  { key: 'sma20', label: 'SMA20', color: '#38bdf8' },
  { key: 'sma50', label: 'SMA50', color: '#818cf8' },
  { key: 'ema12', label: 'EMA12', color: '#fbbf24' },
  { key: 'ema26', label: 'EMA26', color: '#fb923c' },
  { key: 'bollinger', label: 'Bollinger', color: '#a78bfa' }
] as const;

export const OSCILLATORS = ['RSI', 'MACD', 'Stochastic', 'ADX'] as const;
export type Oscillator = typeof OSCILLATORS[number];

export const STRATEGY_COLORS: Record<string, string> = {
  SMA_Crossover: '#38bdf8',
  EMA_Crossover: '#fbbf24',
  RSI_Oversold_Overbought: '#f472b6',
  MACD_Signal: '#34d399',
  Bollinger_Bands: '#a78bfa',
  Stochastic_Oscillator: '#fb923c',
  ADX_Trend: '#60a5fa',
  Combined_Momentum: '#facc15',
  Pattern_Recognition: '#c084fc',
  Mean_Reversion: '#2dd4bf',
  Liquidity_Based: '#f87171'
};

export const AXIS_COLOR = '#166534';
export const TICK_COLOR = '#4ade80';

export const baseOptions = (yOverrides: any = {}, extras: any = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  // Toggling an overlay rebuilds the chart; animating a few hundred points on every
  // toggle just makes the controls feel laggy.
  animation: false as const,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { labels: { color: TICK_COLOR, font: { family: 'monospace', size: 10 }, boxWidth: 10 }, ...(extras.legend || {}) },
    tooltip: {
      backgroundColor: '#000', borderColor: '#166534', borderWidth: 1,
      titleColor: '#4ade80', bodyColor: '#86efac', titleFont: { family: 'monospace' }, bodyFont: { family: 'monospace' }
    }
  },
  scales: {
    x: { grid: { color: AXIS_COLOR }, ticks: { color: TICK_COLOR, font: { family: 'monospace', size: 9 }, maxTicksLimit: 8 } },
    y: { grid: { color: AXIS_COLOR }, ticks: { color: TICK_COLOR, font: { family: 'monospace', size: 9 } }, ...yOverrides }
  }
});

export const line = (label: string, data: (number | null)[], color: string, extra: any = {}) => ({
  label, data, borderColor: color, backgroundColor: color,
  borderWidth: 1.25, pointRadius: 0, tension: 0.1, spanGaps: true, ...extra
});

export function useChart(config: any, deps: React.DependencyList) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!canvasRef.current || !config) return;
    chartRef.current = new Chart(canvasRef.current, config);
    return () => {chartRef.current?.destroy(); chartRef.current = null;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return canvasRef;
}

export function buildPriceConfig(pts: SignalSeriesPoint[], labels: string[], activeOverlays: string[], options: any = baseOptions()) {
  const datasets: any[] = [line('Price', pts.map(p => p.price), '#4ade80', { borderWidth: 2 })];
  if (activeOverlays.includes('sma20')) datasets.push(line('SMA20', pts.map(p => p.sma20), '#38bdf8'));
  if (activeOverlays.includes('sma50')) datasets.push(line('SMA50', pts.map(p => p.sma50), '#818cf8'));
  if (activeOverlays.includes('ema12')) datasets.push(line('EMA12', pts.map(p => p.ema12), '#fbbf24'));
  if (activeOverlays.includes('ema26')) datasets.push(line('EMA26', pts.map(p => p.ema26), '#fb923c'));
  if (activeOverlays.includes('bollinger')) {
    datasets.push(line('BB Upper', pts.map(p => p.bbUpper), '#a78bfa', { borderDash: [4, 4] }));
    datasets.push(line('BB Lower', pts.map(p => p.bbLower), '#a78bfa', { borderDash: [4, 4], fill: '-1', backgroundColor: 'rgba(167,139,250,0.07)' }));
  }
  return { type: 'line', data: { labels, datasets }, options };
}

export function buildScoreConfig(pts: SignalSeriesPoint[], labels: string[], activeStrategies: string[], options: any = baseOptions({ min: -1, max: 1 })) {
  const datasets: any[] = [
    line('Aggregate score', pts.map(p => p.aggregateScore), '#4ade80', {
      borderWidth: 2, fill: 'origin', backgroundColor: 'rgba(74,222,128,0.10)'
    }),
    line('Confidence', pts.map(p => p.aggregateConfidence), '#e879f9', { borderDash: [3, 3] })
  ];
  for (const name of activeStrategies) {
    // A strategy that never produced a result is stored as NaN — chart.js draws NaN as a
    // zero-ish point, so map it to null and let spanGaps skip it.
    datasets.push(line(name, pts.map(p => {const v = p.strategyScores[name]; return Number.isNaN(v) ? null : v;}), STRATEGY_COLORS[name] || '#94a3b8', { borderWidth: 1 }));
  }
  return { type: 'line', data: { labels, datasets }, options };
}

export function buildOscillatorConfig(pts: SignalSeriesPoint[], labels: string[], oscillator: Oscillator, mkOptions: (y?: any) => any = baseOptions) {
  if (oscillator === 'RSI') {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          line('RSI', pts.map(p => p.rsi), '#f472b6', { borderWidth: 2 }),
          line('Overbought (70)', pts.map(() => 70), '#ef4444', { borderDash: [4, 4] }),
          line('Oversold (30)', pts.map(() => 30), '#22c55e', { borderDash: [4, 4] })
        ]
      },
      options: mkOptions({ min: 0, max: 100 })
    };
  }
  if (oscillator === 'MACD') {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type: 'bar', label: 'Histogram', data: pts.map(p => p.macdHistogram),
            backgroundColor: pts.map(p => (p.macdHistogram ?? 0) >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'), borderWidth: 0 },
          { type: 'line', ...line('MACD', pts.map(p => p.macdLine), '#34d399', { borderWidth: 2 }) },
          { type: 'line', ...line('Signal', pts.map(p => p.macdSignal), '#f59e0b') }
        ]
      },
      options: mkOptions()
    };
  }
  if (oscillator === 'Stochastic') {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          line('%K', pts.map(p => p.stochK), '#fb923c', { borderWidth: 2 }),
          line('%D', pts.map(p => p.stochD), '#38bdf8'),
          line('80', pts.map(() => 80), '#ef4444', { borderDash: [4, 4] }),
          line('20', pts.map(() => 20), '#22c55e', { borderDash: [4, 4] })
        ]
      },
      options: mkOptions({ min: 0, max: 100 })
    };
  }
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        line('ADX', pts.map(p => p.adx), '#60a5fa', { borderWidth: 2 }),
        line('+DI', pts.map(p => p.diPlus), '#22c55e'),
        line('-DI', pts.map(p => p.diMinus), '#ef4444'),
        line('Trend threshold (25)', pts.map(() => 25), '#94a3b8', { borderDash: [4, 4] })
      ]
    },
    options: mkOptions({ min: 0 })
  };
}
