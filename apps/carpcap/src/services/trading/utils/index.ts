import { MarketCondition, PriceAnalysis, TokenData } from '../models/interfaces';
import { TradingConfig, PerformanceData } from '../models/interfaces';
import { SolanaCoreValidatedTokens } from '../config';
import { getTokenBalance, getTokenSupply } from './chain';
export { logger, log, Logger, LogLevel, type LogEntry, type LoggerConfig } from './logger';

export function calculateOptimalPositionSize(basePositionSize: number, priceAnalysis: PriceAnalysis, tradeValueUSD: number): number {
    let adjustedSize = basePositionSize;
    if (priceAnalysis.confidenceLevel === 'low') {adjustedSize *= 0.5;} 
    else if (priceAnalysis.confidenceLevel === 'medium') {adjustedSize *= 0.8;}
    if (tradeValueUSD <= 10) {adjustedSize *= Math.max(0.3, 1 - (priceAnalysis.priceImpact10 * 10));} 
    else if (tradeValueUSD <= 100) {adjustedSize *= Math.max(0.3, 1 - (priceAnalysis.priceImpact100 * 5));} 
    else {adjustedSize *= Math.max(0.2, 1 - (priceAnalysis.priceImpact1000 * 2));}
    if (priceAnalysis.spreadPercentage > 0.2) {adjustedSize *= Math.max(0.5, 1 - (priceAnalysis.spreadPercentage * 0.1));}
    adjustedSize *= (priceAnalysis.liquidityScore / 100);
    return Math.max(0.01, adjustedSize);
}

export function delay(ms: number) {return new Promise(resolve => setTimeout(resolve, ms));}

// export function getIndicatorBreakdown(aggregatedSignal: AggregatedSignal): {total: number; buy: number; sell: number; hold: number; metThreshold: number; belowThreshold: number;} {
//     const total = aggregatedSignal.indicatorResults.length;
//     const buy = aggregatedSignal.indicatorResults.filter(r => r.signal.action === 'BUY' && r.meetsThreshold).length;
//     const sell = aggregatedSignal.indicatorResults.filter(r => r.signal.action === 'SELL' && r.meetsThreshold).length;
//     const hold = aggregatedSignal.indicatorResults.filter(r => r.signal.action === 'HOLD' && r.meetsThreshold).length;
//     const metThreshold = aggregatedSignal.indicatorResults.filter(r => r.meetsThreshold).length;
//     const belowThreshold = total - metThreshold;
//     return { total, buy, sell, hold, metThreshold, belowThreshold};
// }

// export function generateMultiTokenRecommendation(tokens: TokenData[],  chainConfig: any,  currentHolding?: TokenData): MultiTokenRecommendation {
//     const enhancedConfig = {
//         ...chainConfig,
//         MARKET_CONDITION_MULTIPLIERS: { trending: 1, sideways: 1, volatile: 1 },
//         RISK_ADJUSTMENT: { volatilityPenalty: 0, liquidityBonus: 0, confidenceMultiplier: 0 },
//         TEMPORAL_WEIGHTING: { recentSignalBonus: 0, timeframeAlignment: 0, momentumDecay: 0 },
//         POSITION_MANAGEMENT: { switchingThreshold: 0.3, holdingBonus: 0, maxPositionRisk: 1 },
//         PERFORMANCE_TRACKING: { enableAdaptiveWeights: false, performanceWindow: 100, minPerformanceSample: 10 }
//     };
//     return generateOptimizedMultiTokenRecommendation(tokens, enhancedConfig, currentHolding);
// }

// export function generateAggregatedSignal(tokenData: TokenData, chainConfig: any, requiredConfluence?: number): AggregatedSignal {
//     const enhancedConfig = {
//         ...chainConfig,
//         MARKET_CONDITION_MULTIPLIERS: { trending: 1, sideways: 1, volatile: 1 },
//         RISK_ADJUSTMENT: { volatilityPenalty: 0, liquidityBonus: 0, confidenceMultiplier: 0 },
//         TEMPORAL_WEIGHTING: { recentSignalBonus: 0, timeframeAlignment: 0, momentumDecay: 0 },
//         POSITION_MANAGEMENT: { switchingThreshold: 0.3, holdingBonus: 0, maxPositionRisk: 1 },
//         PERFORMANCE_TRACKING: { enableAdaptiveWeights: false, performanceWindow: 100, minPerformanceSample: 10 }
//     };
//     return generateEnhancedAggregatedSignal(tokenData, enhancedConfig);
// }

export function detectMarketCondition(tokenData: TokenData): MarketCondition {
    const { priceHistory } = tokenData;
    if (priceHistory.length < 20) {return { type: 'sideways', strength: 0.5, volatility: 0.5, trend: 0 };}
    const returns = priceHistory.slice(-20).map((price, i, arr) => i > 0 ? (price - arr[i-1]) / arr[i-1] : 0).slice(1);
    const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
    const recent = priceHistory.slice(-10);
    const older = priceHistory.slice(-20, -10);
    const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p, 0) / older.length;
    const trend = (recentAvg - olderAvg) / olderAvg;
    if (volatility > 0.05) {return { type: 'volatile', strength: Math.min(volatility * 20, 1), volatility, trend };} 
    else if (Math.abs(trend) > 0.02) {return { type: 'trending', strength: Math.min(Math.abs(trend) * 50, 1), volatility, trend };} 
    else {return { type: 'sideways', strength: 1 - Math.abs(trend) * 25, volatility, trend };}
}

export function calculateLiquidityScore(tokenData: TokenData): number {
    const { liquidityScores } = tokenData;
    if (liquidityScores.length === 0) return 0.5;
    const recentLiquidity = liquidityScores.slice(-5);
    return recentLiquidity.reduce((sum, score) => sum + score, 0) / recentLiquidity.length;
}

export function calculateDiversificationScore(strategies: any[]): number {
    const allocations = strategies.map(s => s.contributedValue || 0);
    const totalValue = allocations.reduce((sum, val) => sum + val, 0);
    if (totalValue === 0) return 0;
    const weights = allocations.map(val => val / totalValue);
    const entropy = -weights.reduce((sum, w) => w > 0 ? sum + w * Math.log(w) : sum, 0);
    const maxEntropy = Math.log(strategies.length);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

export function calculateRiskScore(strategies: any[]): number {
    const maxDrawdowns = strategies.map(s => s.maxDrawdown || 0);
    const avgDrawdown = maxDrawdowns.reduce((sum, dd) => sum + dd, 0) / maxDrawdowns.length;
    const volatilities = strategies.map(s => {
        const recentPerformance = s.recentPerformance || [];
        if (recentPerformance.length < 2) return 0;
        const returns = recentPerformance;
        const mean = returns.reduce((sum: number, r: number) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum: number, r: number) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    });
    const avgVolatility = volatilities.reduce((sum, vol) => sum + vol, 0) / volatilities.length;
    return Math.min(1, (avgDrawdown * 0.6) + (avgVolatility * 0.4));
}

export function processPerformanceData(strategies: any[], totalPortfolioValue: number, tradingConfig: TradingConfig): PerformanceData {
    if (!Array.isArray(strategies)) {throw new Error('strategies parameter must be an array');}
    const sortedStrategies = strategies.sort((a: any, b: any) => b.totalReturn - a.totalReturn);
    const totalTrades = strategies.reduce((sum, s) => sum + s.totalTrades, 0);
    const totalInitialBalance = tradingConfig.INITIAL_PAPER_BALANCE;
    const totalReturn = totalInitialBalance > 0 ? (totalPortfolioValue - totalInitialBalance) / totalInitialBalance : 0;
    const strategyInitialAllocation = tradingConfig.INITIAL_PAPER_BALANCE / strategies.length;
    const activePositionsCount = strategies.filter(s => s.contributedValue > strategyInitialAllocation).length;
    const activeStrategies = sortedStrategies.filter((s: any) => s.totalTrades > 0);
    const avgReturn = sortedStrategies.reduce((sum: number, s: any) => sum + s.totalReturn, 0) / sortedStrategies.length;
    const totalSuccessfulTrades = sortedStrategies.reduce((sum: number, s: any) => sum + s.successfulTrades, 0);
    const overallWinRate = totalTrades > 0 ? (totalSuccessfulTrades / totalTrades) : 0;
    const underperformingStrategies = sortedStrategies.filter((s: any) => s.totalReturn < -0.02).slice(-3);
    const totalRealizedPnL = strategies.reduce((sum, s) => sum + s.realizedPnL, 0);
    const totalUnrealizedPnL = strategies.reduce((sum, s) => sum + s.unrealizedPnL, 0);
    const totalFeesPaid = strategies.reduce((sum, s) => sum + s.totalFeesPaid, 0);
    const avgFeePerTrade = totalTrades > 0 ? totalFeesPaid / totalTrades : 0;
    return {
        strategies, 
        portfolioValue: totalPortfolioValue, 
        totalTrades, 
        totalReturn, 
        activePositions: activePositionsCount, 
        sortedStrategies, 
        activeStrategies, 
        avgReturn, 
        overallWinRate, 
        underperformingStrategies,
        totalRealizedPnL,
        totalUnrealizedPnL,
        totalFeesPaid,
        avgFeePerTrade,
        portfolioMetrics: {
            totalCash: 0,
            totalPositions: 0,
            diversificationScore: calculateDiversificationScore(strategies),
            riskScore: calculateRiskScore(strategies)
        }
    };
}

export const getHeliumSwapRates = async (prices: any) => {
    const HELIUM_TREASURY_ADDRESSES = {MOBILE: 'AguTdjmW5SkhepT9qsKsj29SEqiVKsJchsap6Kma9i98', IOT: '4UiT93tyCivCHetditvH15wqWxYrHcoPWzQiKDQYF7Uo'};
    const tokens = SolanaCoreValidatedTokens.filter((token: any) => ['HNT', 'MOBILE', 'IOT'].includes(token.ticker));
    if (!tokens || tokens.length < 3) {console.error('Missing token information for HNT, MOBILE, or IOT'); return null;}
    const hntToken = tokens.find((token: any) => token.ticker === 'HNT');
    const mobileToken = tokens.find((token: any) => token.ticker === 'MOBILE');
    const iotToken = tokens.find((token: any) => token.ticker === 'IOT');
    if (!hntToken?.address || !mobileToken?.address || !iotToken?.address) {console.error('Missing token addresses'); return null;}
    if (!prices) {console.error('Failed to fetch token prices from Jupiter'); return null;}
    const HNT_MARKET_PRICE = prices[hntToken.address] || 0;
    const MOBILE_MARKET_PRICE = prices[mobileToken.address] || 0;
    const IOT_MARKET_PRICE = prices[iotToken.address] || 0;
    if (HNT_MARKET_PRICE === 0 || MOBILE_MARKET_PRICE === 0 || IOT_MARKET_PRICE === 0) {console.error('One or more token prices are zero'); return null;}
    const [actualMobileTreasury, actualIotTreasury, mobileSupply, iotSupply] = await Promise.all([
      getTokenBalance(hntToken.address, HELIUM_TREASURY_ADDRESSES.MOBILE),
      getTokenBalance(hntToken.address, HELIUM_TREASURY_ADDRESSES.IOT),
      getTokenSupply(mobileToken.address),
      getTokenSupply(iotToken.address)
    ]);
    if (!actualMobileTreasury || actualMobileTreasury === 0) {console.error('MOBILE treasury balance is zero or invalid:', actualMobileTreasury); return null;}
    if (!actualIotTreasury || actualIotTreasury === 0) {console.error('IOT treasury balance is zero or invalid:', actualIotTreasury); return null;}
    if (!mobileSupply || mobileSupply === 0) {console.error('MOBILE supply is zero or invalid:', mobileSupply); return null;}
    if (!iotSupply || iotSupply === 0) {console.error('IOT supply is zero or invalid:', iotSupply); return null;}
    const marketRates = {
      HNT_MOBILE: HNT_MARKET_PRICE / MOBILE_MARKET_PRICE,
      HNT_IOT: HNT_MARKET_PRICE / IOT_MARKET_PRICE,
      MOBILE_HNT: MOBILE_MARKET_PRICE / HNT_MARKET_PRICE,
      IOT_HNT: IOT_MARKET_PRICE / HNT_MARKET_PRICE
    };
    const treasuryRates = {
      HNT_MOBILE: actualMobileTreasury > 0 ? mobileSupply / actualMobileTreasury : 0,
      HNT_IOT: actualIotTreasury > 0 ? iotSupply / actualIotTreasury : 0,
      MOBILE_HNT: mobileSupply > 0 ? actualMobileTreasury / mobileSupply : 0,
      IOT_HNT: iotSupply > 0 ? actualIotTreasury / iotSupply : 0
    };
    if (!isFinite(treasuryRates.HNT_MOBILE) || !isFinite(treasuryRates.HNT_IOT) || !isFinite(treasuryRates.MOBILE_HNT) || !isFinite(treasuryRates.IOT_HNT)) {
        console.error('Treasury rates contain invalid values (Infinity/NaN):', treasuryRates);
        return null;
    }
    const marketPrices = {HNT: HNT_MARKET_PRICE, MOBILE: MOBILE_MARKET_PRICE, IOT: IOT_MARKET_PRICE};
    const treasuryBalances = {MOBILE: actualMobileTreasury, IOT: actualIotTreasury};
    const supplies = {MOBILE: mobileSupply, IOT: iotSupply};
    return {market: marketRates, treasury: treasuryRates, marketPrices, treasuryBalances, supplies, date: new Date().toISOString()};
};