import { detectMarketCondition, calculateLiquidityScore } from '../utils';
import { TokenData, IndicatorResult, PerformanceTracker, ArbitrageData, ArbitrageOpportunity, ContinuousSignal, TokenScore, ContinuousIndicatorSignal } from '../models/interfaces';
import { SolanaCoreValidatedTokens, EclipseCoreValidatedTokens } from '../config';

export const STRATEGY_INDICATOR_MAP = new Map<string, (tokenData: TokenData) => ContinuousIndicatorSignal>([
    ['SMA_Crossover', generateSMASignal],
    ['EMA_Crossover', generateEMASignal],
    ['RSI_Oversold_Overbought', generateRSISignal],
    ['MACD_Signal', generateMACDSignal],
    ['Bollinger_Bands', generateBollingerSignal],
    ['Stochastic_Oscillator', generateStochasticSignal],
    ['ADX_Trend', generateADXSignal],
    ['Combined_Momentum', generateCombinedMomentumSignal],
    ['Pattern_Recognition', generatePatternSignal],
    ['Mean_Reversion', generateMeanReversionSignal],
    ['Liquidity_Based', generateLiquidityBasedSignal]
]);

function calculateSMA(prices: number[], period: number): number {if (prices.length < period) return 0; const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0); return sum / period;}

export function generateSMASignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    if (priceHistory.length < 50) return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };
    const sma20 = calculateSMA(priceHistory, 20);
    const sma50 = calculateSMA(priceHistory, 50);
    const currentPrice = priceHistory[priceHistory.length - 1];
    let score = 0;
    let strength = 0;
    if (sma20 > sma50) {const priceVsSMA20 = (currentPrice - sma20) / sma20; score = Math.max(0, Math.min(1, priceVsSMA20 * 10)); strength = Math.min(Math.abs(priceVsSMA20) * 10, 1);} 
    else if (sma20 < sma50) {const priceVsSMA20 = (currentPrice - sma20) / sma20; score = Math.max(-1, Math.min(0, priceVsSMA20 * 10)); strength = Math.min(Math.abs(priceVsSMA20) * 10, 1);} 
    else {score = 0; strength = 0;}
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: sma20 / sma50 };
}

export function generateMeanReversionSignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    if (priceHistory.length < 20) return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };
    const sma20 = calculateSMA(priceHistory, 20);
    const currentPrice = priceHistory[priceHistory.length - 1];
    const deviation = (currentPrice - sma20) / sma20;
    let score = 0;
    let strength = 0;
    if (deviation < -0.05) {score = Math.max(0, Math.min(1, Math.abs(deviation) * 10)); strength = Math.min(Math.abs(deviation) * 10, 1);} 
    else if (deviation > 0.05) {score = Math.max(-1, Math.min(0, -deviation * 10)); strength = Math.min(deviation * 10, 1);} 
    else {score = 0; strength = 0;}
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: deviation };
}

export function calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const k = 2 / (period + 1);
    let ema = calculateSMA(prices.slice(0, period), period);
    for (let i = period; i < prices.length; i++) {ema = prices[i] * k + ema * (1 - k);}
    return ema;
}

export function generateEMASignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    if (priceHistory.length < 26) return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };
    const ema12 = calculateEMA(priceHistory, 12);
    const ema26 = calculateEMA(priceHistory, 26);
    const currentPrice = priceHistory[priceHistory.length - 1];
    let score = 0;
    let strength = 0;
    if (ema12 > ema26) {const priceVsEMA12 = (currentPrice - ema12) / ema12; score = Math.max(0, Math.min(1, priceVsEMA12 * 10)); strength = Math.min(Math.abs(priceVsEMA12) * 10, 1);} 
    else if (ema12 < ema26) {const priceVsEMA12 = (currentPrice - ema12) / ema12; score = Math.max(-1, Math.min(0, priceVsEMA12 * 10)); strength = Math.min(Math.abs(priceVsEMA12) * 10, 1);} 
    else {score = 0; strength = 0;}
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: ema12 / ema26 };
}

export function calculateRSI(prices: number[], period: number = 14): number | undefined {
    if (prices.length < period + 1) {return undefined;}
    let gains = 0; let losses = 0;
    for (let i = 1; i <= period; i++) {const diff = prices[i] - prices[i - 1]; if (diff >= 0) {gains += diff;} else {losses -= diff;}}
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        let currentGain = 0;
        let currentLoss = 0;
        if (diff >= 0) {currentGain = diff;} else {currentLoss = -diff;}
        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }
    if (avgLoss === 0) {return 100;}
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    return rsi;
}

export function generateRSISignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    const rsi = calculateRSI(priceHistory);
    if (!rsi) return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };
    let score = 0;
    let strength = 0;
    if (rsi < 30) {score = Math.max(0, Math.min(1, (30 - rsi) / 30)); strength = (30 - rsi) / 30;} 
    else if (rsi > 70) {score = Math.max(-1, Math.min(0, -(rsi - 70) / 30)); strength = (rsi - 70) / 30;} 
    else {const neutralScore = (rsi - 50) / 50; score = Math.max(-0.3, Math.min(0.3, neutralScore)); strength = Math.abs(neutralScore) * 0.5;}
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: rsi };
}

export function calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): { line: number; signal: number; histogram: number } | undefined {
    if (prices.length < slowPeriod + signalPeriod) {return undefined;}
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    const macdLine = fastEMA - slowEMA;
    const macdLineHistory: number[] = [];
    for (let i = prices.length - signalPeriod - 1; i < prices.length; i++) {
        const slice = prices.slice(0, i + 1);
        const fastEMA = calculateEMA(slice, fastPeriod);
        const slowEMA = calculateEMA(slice, slowPeriod);
        macdLineHistory.push(fastEMA - slowEMA);
    }
    const signalLine = calculateEMA(macdLineHistory, signalPeriod);
    const histogram = macdLine - signalLine;
    return { line: macdLine, signal: signalLine, histogram };
}

export function generateMACDSignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    const macd = calculateMACD(priceHistory);
    if (!macd) return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };
    let score = 0;
    let strength = 0;
    const lineVsSignal = macd.line - macd.signal;
    const histogramStrength = Math.abs(macd.histogram);
    if (macd.line > macd.signal && macd.histogram > 0) {
        score = Math.max(0, Math.min(1, lineVsSignal / Math.max(Math.abs(macd.line), 0.001) * 50));
        strength = Math.min(histogramStrength / Math.max(Math.abs(macd.line), 0.001) * 10, 1);
    } 
    else if (macd.line < macd.signal && macd.histogram < 0) {
        score = Math.max(-1, Math.min(0, lineVsSignal / Math.max(Math.abs(macd.line), 0.001) * 50));
        strength = Math.min(histogramStrength / Math.max(Math.abs(macd.line), 0.001) * 10, 1);
    } 
    else {
        const neutralScore = lineVsSignal / Math.max(Math.abs(macd.line), 0.001) * 20;
        score = Math.max(-0.4, Math.min(0.4, neutralScore));
        strength = Math.min(histogramStrength / Math.max(Math.abs(macd.line), 0.001) * 5, 0.5);
    }
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: macd.histogram };
}

export function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number; width: number; percentB: number } | undefined {
    if (prices.length < period) {return undefined;}
    const middle = calculateSMA(prices.slice(-period), period);
    const pricesForStdDev = prices.slice(-period);
    const squaredDiffs = pricesForStdDev.map(price => Math.pow(price - middle, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
    const standardDeviation = Math.sqrt(avgSquaredDiff);
    const upper = middle + (standardDeviation * stdDev);
    const lower = middle - (standardDeviation * stdDev);
    const width = (upper - lower) / middle;
    const currentPrice = prices[prices.length - 1];
    const percentB = (currentPrice - lower) / (upper - lower);
    return { upper, middle, lower, width, percentB };
}

export function generateBollingerSignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    const bb = calculateBollingerBands(priceHistory);
    if (!bb) return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };
    const currentPrice = priceHistory[priceHistory.length - 1];
    let score = 0;
    let strength = 0;
    if (currentPrice < bb.lower && bb.percentB < 0) {score = Math.max(0, Math.min(1, Math.abs(bb.percentB))); strength = Math.min(Math.abs(bb.percentB), 1.0);} 
    else if (currentPrice > bb.upper && bb.percentB > 1) {score = Math.max(-1, Math.min(0, -(bb.percentB - 1))); strength = Math.min(bb.percentB - 1, 1.0);} 
    else {const bandPosition = (bb.percentB - 0.5) * 2; score = Math.max(-0.3, Math.min(0.3, bandPosition)); strength = Math.abs(bandPosition) * 0.5;}
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: bb.percentB };
}

export function calculateStochastic(prices: number[],  period: number = 14,  smoothK: number = 3,  smoothD: number = 3): { k: number; d: number } | undefined {
    if (prices.length < period + Math.max(smoothK, smoothD)) {return undefined;}
    const rawKValues: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const currentPrices = prices.slice(i - period + 1, i + 1);
        const highest = Math.max(...currentPrices);
        const lowest = Math.min(...currentPrices);
        const currentPrice = currentPrices[currentPrices.length - 1];
        if (highest === lowest) {rawKValues.push(50);} 
        else {const rawK = 100 * ((currentPrice - lowest) / (highest - lowest)); rawKValues.push(rawK);}
    }
    const kValues = [];
    for (let i = smoothK - 1; i < rawKValues.length; i++) {const smoothedK = calculateSMA(rawKValues.slice(i - smoothK + 1, i + 1), smoothK); kValues.push(smoothedK);}
    const dValues = [];
    for (let i = smoothD - 1; i < kValues.length; i++) {const smoothedD = calculateSMA(kValues.slice(i - smoothD + 1, i + 1), smoothD); dValues.push(smoothedD);}
    return {k: kValues[kValues.length - 1], d: dValues[dValues.length - 1]};
}

export function generateStochasticSignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    const stoch = calculateStochastic(priceHistory);
    if (!stoch) return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };
    let score = 0;
    let strength = 0;
    
    if (stoch.k < 20 && stoch.d < 20 && stoch.k > stoch.d) {score = Math.max(0, Math.min(1, (20 - stoch.k) / 20)); strength = (20 - stoch.k) / 20;} 
    else if (stoch.k > 80 && stoch.d > 80 && stoch.k < stoch.d) {score = Math.max(-1, Math.min(0, -(stoch.k - 80) / 20)); strength = (stoch.k - 80) / 20;} 
    else {
        const kPosition = (stoch.k - 50) / 50; 
        const dPosition = (stoch.d - 50) / 50;
        const avgPosition = (kPosition + dPosition) / 2;
        score = Math.max(-0.3, Math.min(0.3, avgPosition));
        strength = Math.abs(avgPosition) * 0.5;
    }
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: stoch.k };
}

export function calculateATR(prices: number[],  period: number = 14, highPrices: number[] = prices, lowPrices: number[] = prices): number | undefined {
    if (prices.length < period + 1) {return undefined;}
    const trValues: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const high = highPrices[i] || prices[i];
        const low = lowPrices[i] || prices[i];
        const previousClose = prices[i - 1];
        const tr1 = high - low;
        const tr2 = Math.abs(high - previousClose);
        const tr3 = Math.abs(low - previousClose);
        const trueRange = Math.max(tr1, tr2, tr3);
        trValues.push(trueRange);
    }
    const atrValues: number[] = [];
    let atr = calculateSMA(trValues.slice(0, period), period);
    atrValues.push(atr);
    for (let i = period; i < trValues.length; i++) {atr = ((atr * (period - 1)) + trValues[i]) / period; atrValues.push(atr);}
    return atrValues[atrValues.length - 1];
}

export function calculateADX(prices: number[], period: number = 14, highPrices: number[] = prices, lowPrices: number[] = prices): { adx: number; diPlus: number; diMinus: number } | undefined {
    if (prices.length < (period * 2) + 1) {return undefined;}
    const trValues: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const high = highPrices[i] || prices[i];
        const low = lowPrices[i] || prices[i];
        const previousClose = prices[i - 1];
        const tr1 = high - low;
        const tr2 = Math.abs(high - previousClose);
        const tr3 = Math.abs(low - previousClose);
        const trueRange = Math.max(tr1, tr2, tr3);
        trValues.push(trueRange);
    }
    const dmPlusValues: number[] = [];
    const dmMinusValues: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const high = highPrices[i] || prices[i];
        const low = lowPrices[i] || prices[i];
        const previousHigh = highPrices[i - 1] || prices[i - 1];
        const previousLow = lowPrices[i - 1] || prices[i - 1];
        const upMove = high - previousHigh;
        const downMove = previousLow - low;
        let dmPlus = 0;
        let dmMinus = 0;
        if (upMove > downMove && upMove > 0) {dmPlus = upMove;}
        if (downMove > upMove && downMove > 0) {dmMinus = downMove;}
        dmPlusValues.push(dmPlus);
        dmMinusValues.push(dmMinus);
    }
    let diPlus = 100 * (calculateSMA(dmPlusValues.slice(0, period), period) / calculateSMA(trValues.slice(0, period), period));
    let diMinus = 100 * (calculateSMA(dmMinusValues.slice(0, period), period) / calculateSMA(trValues.slice(0, period), period));
    for (let i = period; i < trValues.length; i++) {
        const smoothedDmPlus = ((calculateSMA(dmPlusValues.slice(i - period, i), period) * (period - 1)) + dmPlusValues[i]) / period;
        const smoothedDmMinus = ((calculateSMA(dmMinusValues.slice(i - period, i), period) * (period - 1)) + dmMinusValues[i]) / period;
        const smoothedTR = ((calculateSMA(trValues.slice(i - period, i), period) * (period - 1)) + trValues[i]) / period;
        diPlus = 100 * (smoothedDmPlus / smoothedTR);
        diMinus = 100 * (smoothedDmMinus / smoothedTR);
    }
    const dx = 100 * (Math.abs(diPlus - diMinus) / (diPlus + diMinus));
    let adx = dx;
    adx = ((adx * (period - 1)) + dx) / period;
    return {adx, diPlus, diMinus};
}

export function generateADXSignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    const adx = calculateADX(priceHistory);
    if (!adx) return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };
    let score = 0;
    let strength = 0;
    const trendStrength = Math.min(adx.adx / 50, 1);
    const diDifference = adx.diPlus - adx.diMinus;
    if (adx.adx > 25) {
        if (adx.diPlus > adx.diMinus) {score = Math.max(0, Math.min(1, trendStrength * (diDifference / 100))); strength = trendStrength;} 
        else if (adx.diMinus > adx.diPlus) {score = Math.max(-1, Math.min(0, -trendStrength * (Math.abs(diDifference) / 100))); strength = trendStrength;} 
        else {score = 0; strength = trendStrength * 0.5;}
    } 
    else {
        const weakDirection = diDifference / 100; 
        score = Math.max(-0.3, Math.min(0.3, weakDirection * 0.3));
        strength = Math.abs(weakDirection) * 0.3;
    }
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrengthValue = strength;
    return { score, strength, timeframeAlignment, trendStrength: trendStrengthValue, rawValue: adx.adx };
}

export function calculateOBV(prices: number[],  volumes: number[]): number | undefined {
    if (prices.length < 2 || volumes.length < prices.length) {return undefined;}
    let obv = volumes[0];
    for (let i = 1; i < prices.length; i++) {
        const currentPrice = prices[i];
        const previousPrice = prices[i - 1];
        const currentVolume = volumes[i];
        if (currentPrice > previousPrice) {obv += currentVolume;} 
        else if (currentPrice < previousPrice) {obv -= currentVolume;}
    }
    return obv;
}

export function detectPricePatterns(prices: number[]): { bullish: string[]; bearish: string[] } {
    if (prices.length < 5) {return { bullish: [], bearish: [] };}
    const bullishPatterns: string[] = [];
    const bearishPatterns: string[] = [];
    const recentPrices = prices.slice(-5);
    const lastPrice = recentPrices[recentPrices.length - 1];
    const prevPrice = recentPrices[recentPrices.length - 2];
    const prev2Price = recentPrices[recentPrices.length - 3];
    if (prevPrice < prev2Price && lastPrice > prevPrice && lastPrice > prev2Price && (lastPrice - prevPrice) > (prev2Price - prevPrice)) {bullishPatterns.push('BullishEngulfing');}
    if (prevPrice > prev2Price && lastPrice < prevPrice && lastPrice < prev2Price && (prevPrice - lastPrice) > (prevPrice - prev2Price)) {bearishPatterns.push('BearishEngulfing');}
    if (recentPrices[0] > recentPrices[1] && recentPrices[1] > recentPrices[2] && recentPrices[2] < recentPrices[3] && recentPrices[3] < recentPrices[4]) {bullishPatterns.push('VBottom');}
    if (recentPrices[0] < recentPrices[1] && recentPrices[1] < recentPrices[2] && recentPrices[2] > recentPrices[3] && recentPrices[3] > recentPrices[4]) {bearishPatterns.push('VTop');}
    const dojiThreshold = 0.001; 
    if (Math.abs(lastPrice - prevPrice) / prevPrice < dojiThreshold) {if (prevPrice < prev2Price) {bullishPatterns.push('Doji');} else {bearishPatterns.push('Doji');}}
    return { bullish: bullishPatterns, bearish: bearishPatterns };
}

export function generatePatternSignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const { priceHistory } = tokenData;
    const patterns = detectPricePatterns(priceHistory);
    let score = 0;
    let strength = 0;
    const totalPatterns = patterns.bullish.length + patterns.bearish.length;
    if (totalPatterns === 0) {score = 0; strength = 0;} 
    else {const patternBalance = (patterns.bullish.length - patterns.bearish.length) / totalPatterns; score = patternBalance * 0.6; strength = Math.min(totalPatterns / 5, 1) * 0.6;}
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: totalPatterns };
}

export function calculateSpreadIndicator(spreadHistory: number[]): {avgSpread: number; spreadTrend: 'TIGHTENING' | 'WIDENING' | 'STABLE'; liquiditySignal: 'HIGH' | 'MEDIUM' | 'LOW';} {
    if (!spreadHistory || spreadHistory.length === 0) {return { avgSpread: 0.5, spreadTrend: 'STABLE', liquiditySignal: 'MEDIUM' };}
    const avgSpread = spreadHistory.reduce((sum, spread) => sum + spread, 0) / spreadHistory.length;
    let spreadTrend: 'TIGHTENING' | 'WIDENING' | 'STABLE' = 'STABLE';
    if (spreadHistory.length >= 5) {
        const recent = spreadHistory.slice(-3);
        const earlier = spreadHistory.slice(-6, -3);
        if (recent.length > 0 && earlier.length > 0) {
            const recentAvg = recent.reduce((sum, spread) => sum + spread, 0) / recent.length;
            const earlierAvg = earlier.reduce((sum, spread) => sum + spread, 0) / earlier.length;
            const change = (recentAvg - earlierAvg) / earlierAvg;
            if (change < -0.1) spreadTrend = 'TIGHTENING';
            else if (change > 0.1) spreadTrend = 'WIDENING';
        }
    }
    const liquiditySignal = avgSpread < 0.1 ? 'HIGH' : avgSpread > 0.5 ? 'LOW' : 'MEDIUM';
    return { avgSpread, spreadTrend, liquiditySignal };
}

export function analyzeLiquidityTrend(liquidityScores: number[]): {avgLiquidity: number; liquidityTrend: 'IMPROVING' | 'DETERIORATING' | 'STABLE'; isLiquidityAdequate: boolean;} {
    if (liquidityScores.length === 0) {return { avgLiquidity: 0, liquidityTrend: 'STABLE', isLiquidityAdequate: false };}
    const avgLiquidity = liquidityScores.reduce((sum, score) => sum + score, 0) / liquidityScores.length;
    let liquidityTrend: 'IMPROVING' | 'DETERIORATING' | 'STABLE' = 'STABLE';
    if (liquidityScores.length >= 5) {
        const recent = liquidityScores.slice(-3);
        const earlier = liquidityScores.slice(-6, -3);
        if (earlier.length > 0) {
            const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
            const earlierAvg = earlier.reduce((sum, score) => sum + score, 0) / earlier.length;
            const change = (recentAvg - earlierAvg) / earlierAvg;
            if (change > 0.05) {liquidityTrend = 'IMPROVING';} 
            else if (change < -0.05) {liquidityTrend = 'DETERIORATING';}
        }
    }
    const isLiquidityAdequate = avgLiquidity > 70;
    return { avgLiquidity, liquidityTrend, isLiquidityAdequate };
}

export function calculateConfidenceWeightedPrice(prices: number[], confidenceLevels: ('high' | 'medium' | 'low')[]): number {
    if (prices.length === 0 || prices.length !== confidenceLevels.length) {return prices[prices.length - 1] || 0;}
    const weights = confidenceLevels.map(level => {switch (level) {case 'high': return 1.0; case 'medium': return 0.7; case 'low': return 0.3; default: return 0.5;}});
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < prices.length; i++) {weightedSum += prices[i] * weights[i]; totalWeight += weights[i];}
    return totalWeight > 0 ? weightedSum / totalWeight : prices[prices.length - 1];
}

export function generateCombinedMomentumSignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const signals = [generateRSISignal(tokenData), generateMACDSignal(tokenData), generateStochasticSignal(tokenData)];
    let score = 0;
    let strength = 0;
    const buySignals = signals.filter(s => s.score > 0.1);
    const sellSignals = signals.filter(s => s.score < -0.1);
    if (buySignals.length >= 2) {
        const avgScore = buySignals.reduce((sum, s) => sum + s.score, 0) / buySignals.length;
        const avgStrength = buySignals.reduce((sum, s) => sum + s.strength, 0) / buySignals.length;
        score = Math.max(0, Math.min(1, avgScore));
        strength = avgStrength;
    } 
    else if (sellSignals.length >= 2) {
        const avgScore = sellSignals.reduce((sum, s) => sum + s.score, 0) / sellSignals.length;
        const avgStrength = sellSignals.reduce((sum, s) => sum + s.strength, 0) / sellSignals.length;
        score = Math.max(-1, Math.min(0, avgScore));
        strength = avgStrength;
    } 
    else {
        const avgScore = signals.reduce((sum, s) => sum + s.score, 0) / signals.length;
        const avgStrength = signals.reduce((sum, s) => sum + s.strength, 0) / signals.length;
        score = Math.max(-0.3, Math.min(0.3, avgScore * 0.5));
        strength = avgStrength * 0.5;
    }
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: signals.length };
}

export function detectLiquidityEvents(liquidityScores: number[], priceChanges: number[]): {liquidityDrain: boolean; liquidityBoost: boolean; volatilitySpike: boolean;} {
    if (liquidityScores.length < 5 || priceChanges.length < 5) {return { liquidityDrain: false, liquidityBoost: false, volatilitySpike: false };}
    const recentLiquidity = liquidityScores.slice(-3);
    const recentPriceChanges = priceChanges.slice(-3);
    const liquidityDrain = recentLiquidity.every(score => score < 50) && liquidityScores[liquidityScores.length - 4] > 70;
    const liquidityBoost = recentLiquidity.every(score => score > 80) && liquidityScores[liquidityScores.length - 4] < 60;
    const avgPriceChange = recentPriceChanges.reduce((sum, change) => sum + Math.abs(change), 0) / recentPriceChanges.length;
    const avgLiquidity = recentLiquidity.reduce((sum, score) => sum + score, 0) / recentLiquidity.length;
    const volatilitySpike = avgPriceChange > 0.03 && avgLiquidity < 60;
    return { liquidityDrain, liquidityBoost, volatilitySpike };
}

export function generateLiquidityBasedSignal(tokenData: TokenData): ContinuousIndicatorSignal {
    const hasEnhancedData = tokenData.priceAnalysisHistory && tokenData.priceAnalysisHistory.length >= 5;
    if (!hasEnhancedData) {if (tokenData.priceHistory.length < 10) {return { score: 0, strength: 0, timeframeAlignment: false, trendStrength: 0 };}
        const recentPrices = tokenData.priceHistory.slice(-10);
        const priceChanges = recentPrices.slice(1).map((price, i) => (price - recentPrices[i]) / recentPrices[i]);
        const avgVolatility = priceChanges.reduce((sum, change) => sum + Math.abs(change), 0) / priceChanges.length;
        const liquidityScore = Math.max(0, Math.min(100, 100 - (avgVolatility * 1000)));
        let score = 0;
        let strength = 0;
        if (liquidityScore < 30) {score = -0.6; strength = 0.6;} 
        else if (liquidityScore > 70) {score = 0.5;  strength = 0.5;} 
        else {score = 0; strength = 0;}
        return { score, strength, timeframeAlignment: false, trendStrength: strength };
    }
    const latestAnalysis = tokenData.priceAnalysisHistory[tokenData.priceAnalysisHistory.length - 1];
    const spreadAnalysis = calculateSpreadIndicator(tokenData.spreadHistory || []);
    const liquidityEvents = detectLiquidityEvents(tokenData.liquidityScores || [], tokenData.priceHistory.slice(-5).map((price, i, arr) => i > 0 ? (price - arr[i-1]) / arr[i-1] : 0).slice(1));
    let score = 0;
    let strength = 0;
    if (!latestAnalysis.isLiquid || latestAnalysis.confidenceLevel === 'low') {score = 0; strength = 0;} 
    else if (liquidityEvents.liquidityDrain || liquidityEvents.volatilitySpike) {score = -0.8; strength = 0.8;} 
    else if (liquidityEvents.liquidityBoost && spreadAnalysis.spreadTrend === 'TIGHTENING') {score = 0.7; strength = Math.min(latestAnalysis.liquidityScore / 100, 1);} 
    else if (spreadAnalysis.liquiditySignal === 'HIGH' && latestAnalysis.spreadPercentage < 0.1) {score = 0.6; strength = Math.min(latestAnalysis.liquidityScore / 100, 1);} 
    else {score = 0; strength = 0;}
    const timeframeAlignment = Math.abs(score) > 0.1;
    const trendStrength = strength;
    return { score, strength, timeframeAlignment, trendStrength, rawValue: latestAnalysis.liquidityScore };
}

export function calculateArbitrageOpportunities(arbitrageData: ArbitrageData): ArbitrageOpportunity[] {
    const { market, treasury } = arbitrageData;
    const opportunities: ArbitrageOpportunity[] = [];
    const mobileHntMarketRate = market.MOBILE_HNT;
    const mobileHntTreasuryRate = treasury.MOBILE_HNT;
    const mobileHntArb = ((mobileHntTreasuryRate - mobileHntMarketRate) / mobileHntMarketRate * 100);
    if (mobileHntArb > 2) {opportunities.push({type: 'MOBILE_HNT', direction: '📈 BUY MOBILE → Redeem for HNT → Sell HNT', profitPotential: mobileHntArb, marketRate: mobileHntMarketRate, treasuryRate: mobileHntTreasuryRate});}
    const iotHntMarketRate = market.IOT_HNT;
    const iotHntTreasuryRate = treasury.IOT_HNT;
    const iotHntArb = ((iotHntTreasuryRate - iotHntMarketRate) / iotHntMarketRate * 100);
    if (iotHntArb > 2) {opportunities.push({type: 'IOT_HNT', direction: '📈 BUY IOT → Redeem for HNT → Sell HNT', profitPotential: iotHntArb, marketRate: iotHntMarketRate,treasuryRate: iotHntTreasuryRate});}
    return opportunities;
}

export function generateContinuousTokenScores(tokens: TokenData[], chainConfig: any, performanceTracker?: PerformanceTracker): TokenScore[] {
    if (!tokens || tokens.length === 0) {return [];}
    const results: TokenScore[] = [];
    for (const tokenData of tokens) {
        try {
            const network = chainConfig.SOLANA ? 'SOLANA' : 'ECLIPSE';
            const validatedTokens = network === 'SOLANA' ? SolanaCoreValidatedTokens : EclipseCoreValidatedTokens;
            const token = validatedTokens.find((t: any) => t.ticker === tokenData.ticker);
            if (token && (token.isGasToken || token.isStablecoin)) {console.log(`[Signal Aggregator] Skipping ${tokenData.ticker}: gas token or stablecoin`); continue;}
            if (!tokenData.priceHistory || tokenData.priceHistory.length < 5) {console.log(`[Signal Aggregator] Skipping ${tokenData.ticker}: insufficient price history (${tokenData.priceHistory?.length || 0} points)`); continue;}
            const continuousSignal = generateContinuousSignal(tokenData, chainConfig, performanceTracker);
            const marketCondition = detectMarketCondition(tokenData);
            const liquidityScore = calculateLiquidityScore(tokenData);
            const volatilityPenalty = marketCondition.volatility * (chainConfig.RISK_ADJUSTMENT?.volatilityPenalty || 0.5);
            const finalRanking = continuousSignal.score * continuousSignal.strength * continuousSignal.confidence * (1 - volatilityPenalty) * (1 + liquidityScore * 0.2);
            results.push({
                ticker: tokenData.ticker,
                address: tokenData.address,
                score: continuousSignal.score,
                strength: continuousSignal.strength,
                confidence: continuousSignal.confidence,
                indicatorResults: continuousSignal.indicatorResults,
                marketCondition,
                liquidityScore,
                volatilityPenalty,
                finalRanking
            });
        } 
        catch (error) {console.error(`[Signal Aggregator] Error analyzing token ${tokenData.ticker}:`, error);}
    }
    return results.sort((a, b) => b.finalRanking - a.finalRanking);
}

export function generateContinuousSignal(tokenData: TokenData, chainConfig: any, performanceTracker?: PerformanceTracker): ContinuousSignal {
    const indicatorResults: IndicatorResult[] = [];
    const marketCondition = detectMarketCondition(tokenData);
    const liquidityScore = calculateLiquidityScore(tokenData);
    const marketMultiplier = chainConfig.MARKET_CONDITION_MULTIPLIERS?.[marketCondition.type] || 1.0;
    const enabledSignals = chainConfig.SIGNAL_CONFIG?.filter((config: any) => config.enabled) || [];
    for (const signalConfig of enabledSignals) {
        const { name: strategyName, signal_threshold: threshold, signal_weight: baseWeight } = signalConfig;
        const indicatorFunction = STRATEGY_INDICATOR_MAP.get(strategyName);
        if (!indicatorFunction) continue;
        try {
            const signal = indicatorFunction(tokenData);
            const meetsThreshold = signal.strength >= threshold;
            const adaptiveWeight = performanceTracker && chainConfig.PERFORMANCE_TRACKING?.enableAdaptiveWeights ? performanceTracker.getAdaptiveWeight(strategyName, baseWeight) : baseWeight;
            const marketAdjustedWeight = strategyName.includes('Trend') || strategyName.includes('Momentum') ? adaptiveWeight * marketMultiplier : adaptiveWeight;
            const temporalBonus = signal.timeframeAlignment && chainConfig.TEMPORAL_WEIGHTING?.timeframeAlignment ? chainConfig.TEMPORAL_WEIGHTING.timeframeAlignment : 0;
            const adjustedScore = signal.strength * marketAdjustedWeight + temporalBonus;
            const volatilityPenalty = chainConfig.RISK_ADJUSTMENT?.volatilityPenalty ? marketCondition.volatility * chainConfig.RISK_ADJUSTMENT.volatilityPenalty : 0;
            const liquidityBonus = chainConfig.RISK_ADJUSTMENT?.liquidityBonus ? liquidityScore * chainConfig.RISK_ADJUSTMENT.liquidityBonus : 0;
            const riskAdjustedScore = Math.max(0, adjustedScore - volatilityPenalty + liquidityBonus);
            const result: IndicatorResult = {strategyName, signal, meetsThreshold, threshold, weight: marketAdjustedWeight, adjustedScore, riskAdjustedScore };
            indicatorResults.push(result);
        } 
        catch (error) {console.error(`Error processing strategy ${strategyName} for ${tokenData.ticker}:`, error);}
    }
    const totalWeightedScore = indicatorResults.reduce((sum, r) => sum + r.riskAdjustedScore, 0);
    const weightedScoreSum = indicatorResults.reduce((sum, r) => {const continuousSignal = r.signal as ContinuousIndicatorSignal; return sum + (continuousSignal.score * r.riskAdjustedScore);}, 0);
    let score = 0;
    if (totalWeightedScore > 0) {score = weightedScoreSum / totalWeightedScore; score = Math.max(-1, Math.min(1, score));}
    const strength = Math.abs(score);
    const confidence = enabledSignals.length > 0 ? indicatorResults.filter(r => r.meetsThreshold).length / enabledSignals.length : 0;
    return {
        score,
        strength,
        confidence,
        timeframeAlignment: indicatorResults.some(r => (r.signal as ContinuousIndicatorSignal).timeframeAlignment),
        trendStrength: Math.max(...indicatorResults.map(r => (r.signal as ContinuousIndicatorSignal).trendStrength)),
        indicatorResults,
        marketConditionFactor: marketMultiplier,
        temporalScore: indicatorResults.reduce((sum, r) => sum + ((r.signal as ContinuousIndicatorSignal).timeframeAlignment ? 0.1 : 0), 0),
        riskAdjustedScore: score * strength * confidence
    };
}