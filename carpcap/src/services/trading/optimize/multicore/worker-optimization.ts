import { generateContinuousSignal } from '../../trading/signals';
import { TokenData, Trade, Position } from '../../models/interfaces';

export interface WorkerOptimizationResult {
    network: 'SOLANA' | 'ECLIPSE';
    thresholds: { [key: string]: number };
    positionSizing: { [key: string]: number };
    signalSensitivity: { [key: string]: number };
    signalWeights: { [key: string]: number };
    totalProfit: number;
    totalTrades: number;
    winRate: number;
    avgProfitPerTrade: number;
    maxDrawdown: number;
    sharpeRatio: number;
    finalBalance: number;
    executionTime: number;
    workerId: number;
}

export function generateParameterCombinations(count: number, ranges: any): Array<{
    thresholds: { [key: string]: number };
    positionSizing: { [key: string]: number };
    signalSensitivity: { [key: string]: number };
    signalWeights: { [key: string]: number };
}> {
    const combinations: Array<{
        thresholds: { [key: string]: number };
        positionSizing: { [key: string]: number };
        signalSensitivity: { [key: string]: number };
        signalWeights: { [key: string]: number };
    }> = [];
    
    for (let i = 0; i < count; i++) {
        const thresholds: { [key: string]: number } = {};
        const positionSizing: { [key: string]: number } = {};
        const signalSensitivity: { [key: string]: number } = {};
        const signalWeights: { [key: string]: number } = {};
        
        // Generate random thresholds
        for (const [signalName, range] of Object.entries(ranges.thresholdRanges)) {
            const randomIndex = Math.floor(Math.random() * (range as number[]).length);
            thresholds[signalName] = (range as number[])[randomIndex];
        }
        
        // Generate random position sizing
        for (const [paramName, range] of Object.entries(ranges.positionSizingRanges)) {
            const randomIndex = Math.floor(Math.random() * (range as number[]).length);
            positionSizing[paramName] = (range as number[])[randomIndex];
        }
        
        // Generate random signal sensitivity
        for (const [paramName, range] of Object.entries(ranges.signalSensitivityRanges)) {
            const randomIndex = Math.floor(Math.random() * (range as number[]).length);
            signalSensitivity[paramName] = (range as number[])[randomIndex];
        }
        
        // Generate random signal weights
        for (const [paramName, range] of Object.entries(ranges.signalWeightRanges)) {
            const randomIndex = Math.floor(Math.random() * (range as number[]).length);
            signalWeights[paramName] = (range as number[])[randomIndex];
        }
        
        combinations.push({ thresholds, positionSizing, signalSensitivity, signalWeights });
    }
    
    return combinations;
}

export function applyAllParameters(config: any, params: any): any {
    const newConfig = JSON.parse(JSON.stringify(config));
    
    // Apply signal thresholds
    for (const [signalName, threshold] of Object.entries(params.thresholds)) {
        const signalConfig = newConfig.SIGNAL_CONFIG.find(
            (s: any) => s.name === signalName
        );
        if (signalConfig) {
            signalConfig.signal_threshold = threshold;
        }
    }
    
    // Apply signal weights
    for (const [weightName, weight] of Object.entries(params.signalWeights)) {
        const signalName = weightName.replace('_weight', '');
        const signalConfig = newConfig.SIGNAL_CONFIG.find(
            (s: any) => s.name === signalName
        );
        if (signalConfig) {
            signalConfig.signal_weight = weight;
        }
    }
    
    // Apply position sizing parameters
    if (params.positionSizing.BASE_POSITION_SIZE) {
        newConfig.BASE_POSITION_SIZE = params.positionSizing.BASE_POSITION_SIZE;
    }
    if (params.positionSizing.STOP_LOSS) {
        newConfig.STOP_LOSS = params.positionSizing.STOP_LOSS;
    }
    if (params.positionSizing.TAKE_PROFIT_1) {
        newConfig.TAKE_PROFIT_LEVELS = [
            params.positionSizing.TAKE_PROFIT_1,
            params.positionSizing.TAKE_PROFIT_2 || 0.15,
            params.positionSizing.TAKE_PROFIT_3 || 0.25
        ];
    }
    if (params.positionSizing.TRAILING_STOP_DISTANCE) {
        newConfig.TRAILING_STOP_DISTANCE = params.positionSizing.TRAILING_STOP_DISTANCE;
    }
    
    // Apply signal sensitivity parameters
    if (params.signalSensitivity.MIN_SIGNAL_STRENGTH) {
        newConfig.MIN_SIGNAL_STRENGTH = params.signalSensitivity.MIN_SIGNAL_STRENGTH;
    }
    if (params.signalSensitivity.MIN_SIGNAL_CONFIDENCE) {
        newConfig.MIN_SIGNAL_CONFIDENCE = params.signalSensitivity.MIN_SIGNAL_CONFIDENCE;
    }
    if (params.signalSensitivity.MIN_BUY_CONFLUENCE) {
        newConfig.MIN_BUY_CONFLUENCE = params.signalSensitivity.MIN_BUY_CONFLUENCE;
    }
    if (params.signalSensitivity.MIN_SELL_CONFLUENCE) {
        newConfig.MIN_SELL_CONFLUENCE = params.signalSensitivity.MIN_SELL_CONFLUENCE;
    }
    if (params.signalSensitivity.VOLATILITY_THRESHOLD) {
        newConfig.VOLATILITY_THRESHOLD = params.signalSensitivity.VOLATILITY_THRESHOLD;
    }
    if (params.signalSensitivity.PRICE_MOVEMENT_THRESHOLD) {
        newConfig.PRICE_MOVEMENT_THRESHOLD = params.signalSensitivity.PRICE_MOVEMENT_THRESHOLD;
    }
    
    return newConfig;
}

export async function runBacktest(historicalData: TokenData[], config: any, params: any): Promise<{
    trades: Trade[];
    totalProfit: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    finalBalance: number;
}> {
    // Apply parameters to config
    const testConfig = applyAllParameters(config, params);
    
    // Run backtest (simplified version)
    const trades: Trade[] = [];
    let balance = 1000;
    let maxBalance = 1000;
    let maxDrawdown = 0;
    const positions = new Map<string, Position>();
    
    const minHistoryLength = Math.min(...historicalData.map(token => token.priceHistory.length));
    const simulationLength = Math.min(minHistoryLength, 500);
    
    for (let timeIndex = 50; timeIndex < simulationLength; timeIndex++) {
        for (const tokenData of historicalData) {
            try {
                const currentTokenData = {
                    ...tokenData,
                    priceHistory: tokenData.priceHistory.slice(0, timeIndex + 1),
                    priceHistory5m: tokenData.priceHistory5m.slice(0, Math.floor((timeIndex + 1) / 5)),
                    priceHistory15m: tokenData.priceHistory15m.slice(0, Math.floor((timeIndex + 1) / 15))
                };
                
                const continuousSignal = generateContinuousSignal(currentTokenData, testConfig);
                
                // Check for buy signals
                if (continuousSignal.score > 0.1 && continuousSignal.strength >= testConfig.MIN_SIGNAL_STRENGTH) {
                    const position = positions.get(tokenData.ticker);
                    if (!position && balance > testConfig.MIN_TRADE_VALUE_USD) {
                        const tradeAmount = balance * testConfig.BASE_POSITION_SIZE;
                        const currentPrice = currentTokenData.priceHistory[currentTokenData.priceHistory.length - 1];
                        
                        if (currentPrice > 0) {
                            const shares = tradeAmount / currentPrice;
                            positions.set(tokenData.ticker, {
                                token: tokenData.ticker,
                                amount: shares,
                                averagePrice: currentPrice,
                                entryTime: Date.now(),
                                remainingAmount: shares,
                                highestPrice: currentPrice,
                                trailingStopPrice: currentPrice * 0.97,
                                partialExits: [],
                                strategyAllocations: new Map()
                            });
                            
                            balance -= tradeAmount;
                            
                            trades.push({
                                timestamp: Date.now(),
                                strategy: 'Multicore',
                                token: tokenData.ticker,
                                action: 'BUY',
                                amount: shares,
                                price: currentPrice,
                                reason: `Signal: ${continuousSignal.score.toFixed(3)}`,
                                gasFee: 0,
                                swapFee: 0,
                                totalFees: 0
                            });
                        }
                    }
                }
                
                // Check for sell signals
                const position = positions.get(tokenData.ticker);
                if (position) {
                    const currentPrice = currentTokenData.priceHistory[currentTokenData.priceHistory.length - 1];
                    const profitPercentage = (currentPrice - position.averagePrice) / position.averagePrice;
                    
                    if (continuousSignal.score < -0.1 || 
                        profitPercentage <= -testConfig.STOP_LOSS || 
                        profitPercentage >= testConfig.TAKE_PROFIT_LEVELS[0]) {
                        
                        const sellValue = position.remainingAmount * currentPrice;
                        balance += sellValue;
                        
                        trades.push({
                            timestamp: Date.now(),
                            strategy: 'Multicore',
                            token: tokenData.ticker,
                            action: 'SELL',
                            amount: position.remainingAmount,
                            price: currentPrice,
                            reason: `Signal: ${continuousSignal.score.toFixed(3)}`,
                            gasFee: 0,
                            swapFee: 0,
                            totalFees: 0
                        });
                        
                        positions.delete(tokenData.ticker);
                    }
                }
                
                // Update max balance and drawdown
                const currentTotalValue = balance + Array.from(positions.values()).reduce((sum, pos) => {
                    const currentPrice = currentTokenData.priceHistory[currentTokenData.priceHistory.length - 1];
                    return sum + (pos.remainingAmount * currentPrice);
                }, 0);
                
                if (currentTotalValue > maxBalance) {
                    maxBalance = currentTotalValue;
                }
                
                const drawdown = (maxBalance - currentTotalValue) / maxBalance;
                if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                }
                
            } catch (error) {
                console.error('[runBacktest]: Error processing token data:', error);
                continue;
            }
        }
    }
    
    // Close remaining positions
    for (const [ticker, position] of positions) {
        const lastData = historicalData.find(d => d.ticker === ticker);
        if (lastData && lastData.priceHistory.length > 0) {
            const finalPrice = lastData.priceHistory[lastData.priceHistory.length - 1];
            const sellValue = position.remainingAmount * finalPrice;
            balance += sellValue;
            
            trades.push({
                timestamp: Date.now(),
                strategy: 'Multicore',
                token: ticker,
                action: 'SELL',
                amount: position.remainingAmount,
                price: finalPrice,
                reason: 'End of backtest',
                gasFee: 0,
                swapFee: 0,
                totalFees: 0
            });
        }
    }
    
    // Calculate metrics
    const totalProfit = balance - 1000;
    const winningTrades = trades.filter(t => {
        if (t.action === 'BUY') return false;
        const buyTrade = trades.find(bt => bt.token === t.token && bt.action === 'BUY' && bt.timestamp < t.timestamp);
        if (!buyTrade) return false;
        return (t.price - buyTrade.price) / buyTrade.price > 0;
    }).length;
    
    const winRate = trades.filter(t => t.action === 'SELL').length > 0 ? 
        winningTrades / trades.filter(t => t.action === 'SELL').length : 0;
    
    // Calculate Sharpe ratio (simplified)
    const returns = trades.filter(t => t.action === 'SELL').map(t => {
        const buyTrade = trades.find(bt => bt.token === t.token && bt.action === 'BUY' && bt.timestamp < t.timestamp);
        if (!buyTrade) return 0;
        return (t.price - buyTrade.price) / buyTrade.price;
    });
    
    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const returnVariance = returns.length > 0 ? 
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
    const sharpeRatio = returnVariance > 0 ? avgReturn / Math.sqrt(returnVariance) : 0;
    
    return {
        trades,
        totalProfit,
        winRate,
        maxDrawdown,
        sharpeRatio,
        finalBalance: balance
    };
} 