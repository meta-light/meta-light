import { detectMarketCondition, calculateLiquidityScore } from '../utils';
import {
  TokenData,
  IndicatorResult,
  PerformanceTracker,
  TokenScore,
  ContinuousSignal,
  ContinuousIndicatorSignal,
  MarketCondition
} from '../models/interfaces';
import { STRATEGY_INDICATOR_MAP } from './signals';

type StrategyName = string;

function clamp(value: number, min: number, max: number): number {return Math.max(min, Math.min(max, value));}

function weightedMedian(values: Array<{ value: number; weight: number }>): number {
  if (values.length === 0) return 0;
  const sorted = values
    .filter(v => Number.isFinite(v.value) && Number.isFinite(v.weight) && v.weight > 0)
    .sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((s, v) => s + v.weight, 0);
  if (totalWeight <= 0) return 0;
  let cum = 0;
  for (const v of sorted) {cum += v.weight; if (cum >= totalWeight / 2) return v.value;}
  return sorted[sorted.length - 1].value;
}

function regimeWeights(market: MarketCondition, strategyName: StrategyName): number {
  const type = market.type;
  const s = strategyName;
  // Base mapping per regime
  if (type === 'trending') {
    if (s.includes('ADX') || s.includes('EMA') || s.includes('MACD') || s.includes('Momentum')) return 1.4;
    if (s.includes('SMA')) return 1.2;
    if (s.includes('Bollinger') || s.includes('Mean_Reversion')) return 0.7;
    return 1.0;
  }
  if (type === 'sideways') {
    if (s.includes('Mean_Reversion') || s.includes('Bollinger')) return 1.4;
    if (s.includes('Momentum') || s.includes('ADX')) return 0.7;
    return 1.0;
  }
  // volatile
  if (s.includes('Liquidity') || s.includes('RSI') || s.includes('Stochastic')) return 1.2;
  return 0.9;
}

export function generateContinuousSignalV2(tokenData: TokenData, chainConfig: any, performanceTracker?: PerformanceTracker): ContinuousSignal {
  const marketCondition = detectMarketCondition(tokenData);
  const liquidityScore = calculateLiquidityScore(tokenData);
  const enabledConfigs = (chainConfig.SIGNAL_CONFIG || []).filter((c: any) => c.enabled);
  const indicatorResults: IndicatorResult[] = [];

  // 1) Compute per-signal raw and adjusted contributions
  for (const cfg of enabledConfigs) {
    const { name: strategyName, signal_threshold: threshold, signal_weight: baseWeight } = cfg;
    const fn = STRATEGY_INDICATOR_MAP.get(strategyName);
    if (!fn) continue;
    try {
      const sig: ContinuousIndicatorSignal = fn(tokenData);
      const meetsThreshold = sig.strength >= threshold;
      const regimeWeight = regimeWeights(marketCondition, strategyName);
      const perfWeight = performanceTracker && chainConfig.PERFORMANCE_TRACKING?.enableAdaptiveWeights
        ? performanceTracker.getAdaptiveWeight(strategyName, baseWeight)
        : baseWeight;
      // Upweight timeframe alignment and trend strength
      const alignmentBonus = sig.timeframeAlignment ? (chainConfig.TEMPORAL_WEIGHTING?.timeframeAlignment || 0.1) : 0;
      const trendBonus = clamp(sig.trendStrength || 0, 0, 1) * 0.1;
      const weight = Math.max(0, perfWeight * regimeWeight + alignmentBonus + trendBonus);
      const adjustedScore = sig.score * weight;
      // Volatility/liquidity adjustments
      const volatilityPenalty = (marketCondition.volatility || 0) * (chainConfig.RISK_ADJUSTMENT?.volatilityPenalty || 0.5);
      const liquidityBonus = (liquidityScore || 0) * (chainConfig.RISK_ADJUSTMENT?.liquidityBonus || 0.1);
      const riskAdjustedScore = clamp(adjustedScore - volatilityPenalty + (liquidityBonus / 100), -1, 1);
      indicatorResults.push({
        strategyName,
        signal: sig,
        meetsThreshold,
        threshold,
        weight,
        adjustedScore,
        riskAdjustedScore
      });
    } catch {}
  }

  // 2) Confluence and disagreement handling
  const total = indicatorResults.length;
  const met = indicatorResults.filter(r => r.meetsThreshold);
  const requiredConfluence = chainConfig.MIN_SIGNAL_CONFLUENCE ?? chainConfig.MIN_BUY_CONFLUENCE ?? 2;
  const actualConfluence = met.length;
  const metRatio = total > 0 ? actualConfluence / total : 0;

  // Agreement: penalize when weights disagree in sign
  const positives = indicatorResults.filter(r => r.riskAdjustedScore > 0);
  const negatives = indicatorResults.filter(r => r.riskAdjustedScore < 0);
  const disagreement = total > 0 ? Math.min(1, Math.abs(positives.length - negatives.length) / total) : 0;
  const disagreementPenalty = negatives.length > 0 && positives.length > 0 ? 0.15 * (1 - disagreement) : 0;

  // 3) Aggregate using weighted median for robustness, blended with trimmed mean
  const weightsForAgg = indicatorResults.map(r => ({ value: r.signal.score, weight: Math.max(0.0001, r.weight) }));
  const med = weightedMedian(weightsForAgg);
  const sortedScores = weightsForAgg.sort((a, b) => a.value - b.value);
  const trimN = Math.floor(sortedScores.length * 0.1);
  const trimmed = sortedScores.slice(trimN, sortedScores.length - trimN);
  const mean = trimmed.length > 0 ? trimmed.reduce((s, v) => s + v.value * v.weight, 0) / trimmed.reduce((s, v) => s + v.weight, 0) : med;
  let score = clamp(0.6 * med + 0.4 * mean, -1, 1);

  // 4) Confidence/strength computation
  const confidence = metRatio; // fraction of signals over threshold
  let strength = clamp(Math.abs(score) * (0.5 + 0.5 * confidence), 0, 1);
  if (actualConfluence < requiredConfluence) {score *= 0.4; strength *= 0.6;}
  score = clamp(score - disagreementPenalty, -1, 1);

  // 5) Timeframe alignment flag and final trend strength
  const timeframeAlignment = indicatorResults.some(r => (r.signal as ContinuousIndicatorSignal).timeframeAlignment);
  const trendStrength = clamp(Math.max(...indicatorResults.map(r => (r.signal as ContinuousIndicatorSignal).trendStrength || 0)), 0, 1);

  return {
    score,
    strength,
    confidence,
    timeframeAlignment,
    trendStrength,
    indicatorResults,
    marketConditionFactor: chainConfig.MARKET_CONDITION_MULTIPLIERS?.[marketCondition.type] || 1.0,
    temporalScore: timeframeAlignment ? (chainConfig.TEMPORAL_WEIGHTING?.timeframeAlignment || 0.1) : 0,
    riskAdjustedScore: score * strength * (0.5 + 0.5 * confidence)
  };
}

export function generateContinuousTokenScoresV2(tokens: TokenData[], chainConfig: any, performanceTracker?: PerformanceTracker): TokenScore[] {
  if (!tokens || tokens.length === 0) return [];
  const results: TokenScore[] = [];
  for (const token of tokens) {
    try {
      const signal = generateContinuousSignalV2(token, chainConfig, performanceTracker);
      const market = detectMarketCondition(token);
      const liquidity = calculateLiquidityScore(token);
      const volatilityPenalty = market.volatility * (chainConfig.RISK_ADJUSTMENT?.volatilityPenalty || 0.5);
      const finalRanking = signal.score * signal.strength * signal.confidence * (1 - volatilityPenalty) * (1 + liquidity * 0.2);
      results.push({
        ticker: token.ticker,
        address: token.address,
        score: signal.score,
        strength: signal.strength,
        confidence: signal.confidence,
        indicatorResults: signal.indicatorResults as any,
        marketCondition: market,
        liquidityScore: liquidity,
        volatilityPenalty,
        finalRanking
      });
    } catch {}
  }
  return results.sort((a, b) => b.finalRanking - a.finalRanking);
}