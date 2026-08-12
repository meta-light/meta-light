// Turns the point-in-time signal functions in ./signals into time series for charting.
// Each point is evaluated against the price history *up to that point* (expanding window),
// so the series shows what the signal would have read live rather than in hindsight.

import {
    TokenData, ChainConfig, DEFAULT_CHAIN_CONFIG, STRATEGY_INDICATOR_MAP,
    generateContinuousSignal, calculateSMA, calculateEMA, calculateRSI, calculateMACD,
    calculateBollingerBands, calculateStochastic, calculateADX, calculateATR
} from './signals';

// Every indicator needs some lookback before it returns anything: SMA_Crossover needs 50
// points, ADX needs 29, MACD 35. Start the series past the longest of those.
export const MIN_LOOKBACK = 50;

export interface SignalSeriesPoint {
    timestamp: number;
    price: number;
    sma20: number | null;
    sma50: number | null;
    ema12: number | null;
    ema26: number | null;
    bbUpper: number | null;
    bbLower: number | null;
    bbMiddle: number | null;
    rsi: number | null;
    macdLine: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    stochK: number | null;
    stochD: number | null;
    adx: number | null;
    diPlus: number | null;
    diMinus: number | null;
    atr: number | null;
    aggregateScore: number;
    aggregateStrength: number;
    aggregateConfidence: number;
    marketCondition: string;
    strategyScores: Record<string, number>;
}

export interface SignalSeries {
    points: SignalSeriesPoint[];
    strategies: string[];
}

function windowed(tokenData: TokenData, end: number): TokenData {
    return {
        ...tokenData,
        priceHistory: tokenData.priceHistory.slice(0, end + 1),
        timestamps: tokenData.timestamps.slice(0, end + 1),
        priceAnalysisHistory: tokenData.priceAnalysisHistory?.slice(0, end + 1),
        liquidityScores: tokenData.liquidityScores?.slice(0, end + 1),
        spreadHistory: tokenData.spreadHistory?.slice(0, end + 1),
        confidenceHistory: tokenData.confidenceHistory?.slice(0, end + 1)
    };
}

export function buildSignalSeries(tokenData: TokenData, chainConfig: ChainConfig = DEFAULT_CHAIN_CONFIG): SignalSeries {
    const strategies = (chainConfig.SIGNAL_CONFIG || []).filter(c => c.enabled).map(c => c.name);
    const points: SignalSeriesPoint[] = [];
    for (let i = MIN_LOOKBACK; i < tokenData.priceHistory.length; i++) {
        const slice = windowed(tokenData, i);
        const prices = slice.priceHistory;
        const bb = calculateBollingerBands(prices);
        const macd = calculateMACD(prices);
        const stoch = calculateStochastic(prices);
        const adx = calculateADX(prices);
        const aggregate = generateContinuousSignal(slice, chainConfig);
        const strategyScores: Record<string, number> = {};
        for (const result of aggregate.indicatorResults) {strategyScores[result.strategyName] = result.signal.score;}
        // Strategies disabled or unmapped never produce a result — keep the key so chart
        // datasets stay aligned across points.
        for (const name of strategies) {if (!(name in strategyScores)) {strategyScores[name] = STRATEGY_INDICATOR_MAP.has(name) ? 0 : NaN;}}
        points.push({
            timestamp: tokenData.timestamps[i],
            price: prices[prices.length - 1],
            sma20: prices.length >= 20 ? calculateSMA(prices, 20) : null,
            sma50: prices.length >= 50 ? calculateSMA(prices, 50) : null,
            ema12: prices.length >= 12 ? calculateEMA(prices, 12) : null,
            ema26: prices.length >= 26 ? calculateEMA(prices, 26) : null,
            bbUpper: bb ? bb.upper : null,
            bbLower: bb ? bb.lower : null,
            bbMiddle: bb ? bb.middle : null,
            rsi: calculateRSI(prices) ?? null,
            macdLine: macd ? macd.line : null,
            macdSignal: macd ? macd.signal : null,
            macdHistogram: macd ? macd.histogram : null,
            stochK: stoch ? stoch.k : null,
            stochD: stoch ? stoch.d : null,
            adx: adx ? adx.adx : null,
            diPlus: adx ? adx.diPlus : null,
            diMinus: adx ? adx.diMinus : null,
            atr: calculateATR(prices) ?? null,
            aggregateScore: aggregate.score,
            aggregateStrength: aggregate.strength,
            aggregateConfidence: aggregate.confidence,
            marketCondition: detectConditionType(slice),
            strategyScores
        });
    }
    return { points, strategies };
}

function detectConditionType(tokenData: TokenData): string {
    // generateContinuousSignal already computes this internally but doesn't return the type,
    // so re-derive it here rather than changing the ported signature.
    const { priceHistory } = tokenData;
    if (priceHistory.length < 20) return 'sideways';
    const returns = priceHistory.slice(-20).map((price, i, arr) => i > 0 ? (price - arr[i-1]) / arr[i-1] : 0).slice(1);
    const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
    const recent = priceHistory.slice(-10);
    const older = priceHistory.slice(-20, -10);
    const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p, 0) / older.length;
    const trend = (recentAvg - olderAvg) / olderAvg;
    if (volatility > 0.05) return 'volatile';
    if (Math.abs(trend) > 0.02) return 'trending';
    return 'sideways';
}

// The signal functions are O(n) per point, so the series build is O(n^2). CoinGecko returns
// ~2000 hourly points for a 90d window, which is enough to make that noticeable — downsample
// to a target count before building.
export function downsample<T>(items: T[], target: number): T[] {
    if (items.length <= target) return items;
    const step = items.length / target;
    const out: T[] = [];
    for (let i = 0; i < target; i++) {out.push(items[Math.floor(i * step)]);}
    if (out[out.length - 1] !== items[items.length - 1]) {out[out.length - 1] = items[items.length - 1];}
    return out;
}

export function tokenDataFromMarketChart(
    ticker: string,
    id: string,
    prices: [number, number][],
    maxPoints: number = 400
): TokenData {
    const sampled = downsample(prices, maxPoints);
    return {
        ticker,
        address: id,
        priceHistory: sampled.map(p => p[1]),
        timestamps: sampled.map(p => p[0])
    };
}
