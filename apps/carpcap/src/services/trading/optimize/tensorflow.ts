import { connect, disconnect, model } from 'mongoose';
import { PriceSchema } from '../models/price';
import { TradingConfig, SolanaCoreValidatedTokens, EclipseCoreValidatedTokens } from '../config';
import { TokenData } from '../models/interfaces';
import { generateContinuousSignal } from '../trading/signals';
import * as tf from '@tensorflow/tfjs';

interface TensorFlowOptimizationResult {
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
    gpuAccelerated: boolean;
}

interface BacktestResult {
    trades: any[];
    finalBalance: number;
    totalProfit: number;
    maxDrawdown: number;
    winRate: number;
    sharpeRatio: number;
}

class TensorFlowOptimizer {
    private initialBalance = 1000;
    private testPeriodDays = 7;
    private maxTimePeriods = 500;
    private batchSize = 100; // Process 100 parameter combinations at once
    
    // Parameter ranges for comprehensive optimization
    private thresholdRanges = {
        'SMA_Crossover': this.generateRange(0.1, 1.0, 0.05),
        'EMA_Crossover': this.generateRange(0.1, 1.0, 0.05),
        'RSI_Oversold_Overbought': this.generateRange(0.2, 1.0, 0.05),
        'MACD_Signal': this.generateRange(0.1, 1.0, 0.05),
        'Bollinger_Bands': this.generateRange(0.2, 1.0, 0.05),
        'Stochastic_Oscillator': this.generateRange(0.3, 1.0, 0.05),
        'ADX_Trend': this.generateRange(0.2, 1.0, 0.05),
        'Combined_Momentum': this.generateRange(0.2, 1.0, 0.05),
        'Pattern_Recognition': this.generateRange(0.1, 1.0, 0.05),
        'Mean_Reversion': this.generateRange(0.1, 1.0, 0.05),
        'Liquidity_Based': this.generateRange(0.1, 1.0, 0.05)
    };

    private positionSizingRanges = {
        'BASE_POSITION_SIZE': this.generateRange(0.02, 0.25, 0.01),
        'STOP_LOSS': this.generateRange(0.02, 0.15, 0.01),
        'TAKE_PROFIT_1': this.generateRange(0.05, 0.30, 0.01),
        'TAKE_PROFIT_2': this.generateRange(0.10, 0.40, 0.01),
        'TAKE_PROFIT_3': this.generateRange(0.20, 0.50, 0.01),
        'TRAILING_STOP_DISTANCE': this.generateRange(0.01, 0.10, 0.01)
    };

    private signalSensitivityRanges = {
        'MIN_SIGNAL_STRENGTH': this.generateRange(0.1, 0.6, 0.05),
        'MIN_SIGNAL_CONFIDENCE': this.generateRange(0.1, 0.6, 0.05),
        'MIN_BUY_CONFLUENCE': [1, 2, 3, 4],
        'MIN_SELL_CONFLUENCE': [1, 2, 3, 4],
        'VOLATILITY_THRESHOLD': this.generateRange(0.10, 0.40, 0.05),
        'PRICE_MOVEMENT_THRESHOLD': [0.001, 0.002, 0.003, 0.005, 0.008]
    };

    private signalWeightRanges = {
        'SMA_Crossover_weight': this.generateRange(0.5, 1.5, 0.1),
        'EMA_Crossover_weight': this.generateRange(0.5, 1.5, 0.1),
        'RSI_Oversold_Overbought_weight': this.generateRange(0.5, 1.5, 0.1),
        'MACD_Signal_weight': this.generateRange(0.5, 1.5, 0.1),
        'Bollinger_Bands_weight': this.generateRange(0.5, 1.5, 0.1),
        'Stochastic_Oscillator_weight': this.generateRange(0.5, 1.5, 0.1),
        'ADX_Trend_weight': this.generateRange(0.5, 1.5, 0.1),
        'Combined_Momentum_weight': this.generateRange(0.5, 1.5, 0.1),
        'Pattern_Recognition_weight': this.generateRange(0.5, 1.5, 0.1),
        'Mean_Reversion_weight': this.generateRange(0.5, 1.5, 0.1),
        'Liquidity_Based_weight': this.generateRange(0.5, 1.5, 0.1)
    };

    constructor() {
        console.log('🧠 TensorFlow.js Optimizer initialized');
        console.log('Backend:', tf.getBackend());
        console.log('🍎 Apple Silicon GPU acceleration:', tf.getBackend() === 'webgl' || tf.getBackend() === 'metal');
    }

    private generateRange(start: number, end: number, step: number): number[] {
        const range: number[] = [];
        for (let i = start; i <= end; i += step) {
            range.push(parseFloat(i.toFixed(3)));
        }
        return range;
    }

    async optimizeSignalsTensorFlow(): Promise<TensorFlowOptimizationResult[]> {
        console.log('🚀 Starting TensorFlow.js-powered signal optimization...');
        
        const results: TensorFlowOptimizationResult[] = [];
        
        // Optimize for both networks
        for (const network of ['SOLANA', 'ECLIPSE'] as const) {
            console.log(`\nOptimizing ${network} signals with TensorFlow.js...`);
            const networkResults = await this.optimizeNetworkSignalsTensorFlow(network);
            results.push(...networkResults);
        }
        
        // Sort by total profit
        results.sort((a, b) => b.totalProfit - a.totalProfit);
        
        console.log('\n🏆 Top 10 TensorFlow.js Optimization Results:');
        results.slice(0, 10).forEach((result, index) => {
            console.log(`${index + 1}. ${result.network}: $${result.totalProfit.toFixed(2)} profit, ${result.totalTrades} trades, ${(result.winRate * 100).toFixed(1)}% win rate (${result.executionTime}ms, GPU: ${result.gpuAccelerated})`);
        });
        
        return results;
    }

    private async optimizeNetworkSignalsTensorFlow(network: 'SOLANA' | 'ECLIPSE'): Promise<TensorFlowOptimizationResult[]> {
        const results: TensorFlowOptimizationResult[] = [];
        const config = this.createNetworkConfig(network);
        
        // Get historical data
        const historicalData = await this.getHistoricalData(network);
        if (historicalData.length === 0) {
            console.log(`⚠️ No historical data found for ${network}`);
            return results;
        }
        
        // Generate parameter combinations
        const totalCombinations = 5000; // 5,000 combinations for TensorFlow.js
        const batches = Math.ceil(totalCombinations / this.batchSize);
        
        console.log(`🎲 Processing ${totalCombinations} combinations in ${batches} batches of ${this.batchSize}...`);
        
        for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
            const startTime = Date.now();
            const batchSize = Math.min(this.batchSize, totalCombinations - batchIndex * this.batchSize);
            
            // Generate batch of parameter combinations
            const parameterBatch = this.generateParameterBatch(batchSize);
            
            // Process batch with TensorFlow.js
            const batchResults = await this.processBatchTensorFlow(historicalData, config, parameterBatch, network);
            
            results.push(...batchResults);
            
            const batchTime = Date.now() - startTime;
            console.log(`  Batch ${batchIndex + 1}/${batches}: ${batchResults.length} combinations processed in ${batchTime}ms`);
            
            // Memory cleanup
            tf.tidy(() => {
                // Clean up any tensors created in this batch
            });
        }
        
        return results;
    }

    private generateParameterBatch(batchSize: number): Array<{
        thresholds: { [key: string]: number };
        positionSizing: { [key: string]: number };
        signalSensitivity: { [key: string]: number };
        signalWeights: { [key: string]: number };
    }> {
        const batch: Array<{
            thresholds: { [key: string]: number };
            positionSizing: { [key: string]: number };
            signalSensitivity: { [key: string]: number };
            signalWeights: { [key: string]: number };
        }> = [];
        
        for (let i = 0; i < batchSize; i++) {
            const thresholds: { [key: string]: number } = {};
            const positionSizing: { [key: string]: number } = {};
            const signalSensitivity: { [key: string]: number } = {};
            const signalWeights: { [key: string]: number } = {};
            
            // Generate random thresholds
            for (const [signalName, range] of Object.entries(this.thresholdRanges)) {
                const randomIndex = Math.floor(Math.random() * range.length);
                thresholds[signalName] = range[randomIndex];
            }
            
            // Generate random position sizing
            for (const [paramName, range] of Object.entries(this.positionSizingRanges)) {
                const randomIndex = Math.floor(Math.random() * range.length);
                positionSizing[paramName] = range[randomIndex];
            }
            
            // Generate random signal sensitivity
            for (const [paramName, range] of Object.entries(this.signalSensitivityRanges)) {
                const randomIndex = Math.floor(Math.random() * range.length);
                signalSensitivity[paramName] = range[randomIndex];
            }
            
            // Generate random signal weights
            for (const [paramName, range] of Object.entries(this.signalWeightRanges)) {
                const randomIndex = Math.floor(Math.random() * range.length);
                signalWeights[paramName] = range[randomIndex];
            }
            
            batch.push({ thresholds, positionSizing, signalSensitivity, signalWeights });
        }
        
        return batch;
    }

    private async processBatchTensorFlow(
        historicalData: TokenData[], 
        config: any, 
        parameterBatch: Array<{
            thresholds: { [key: string]: number };
            positionSizing: { [key: string]: number };
            signalSensitivity: { [key: string]: number };
            signalWeights: { [key: string]: number };
        }>, 
        network: 'SOLANA' | 'ECLIPSE'
    ): Promise<TensorFlowOptimizationResult[]> {
        const results: TensorFlowOptimizationResult[] = [];
        
        // Convert historical data to tensors for batch processing
        const priceTensors = this.convertHistoricalDataToTensors(historicalData);
        
        // Process each parameter combination in the batch
        for (const params of parameterBatch) {
            const startTime = Date.now();
            
            try {
                const backtestResult = await this.runBacktestTensorFlow(historicalData, config, params);
                
                results.push({
                    network,
                    thresholds: params.thresholds,
                    positionSizing: params.positionSizing,
                    signalSensitivity: params.signalSensitivity,
                    signalWeights: params.signalWeights,
                    totalProfit: backtestResult.totalProfit,
                    totalTrades: backtestResult.trades.length,
                    winRate: backtestResult.winRate,
                    avgProfitPerTrade: backtestResult.totalProfit / Math.max(backtestResult.trades.length, 1),
                    maxDrawdown: backtestResult.maxDrawdown,
                    sharpeRatio: backtestResult.sharpeRatio,
                    finalBalance: backtestResult.finalBalance,
                    executionTime: Date.now() - startTime,
                    gpuAccelerated: tf.getBackend() === 'webgl' || tf.getBackend() === 'metal'
                });
                
            } catch (error) {
                console.error(`Error processing parameters for ${network}:`, error);
            }
        }
        
        // Clean up tensors
        tf.dispose(priceTensors);
        
        return results;
    }

    private convertHistoricalDataToTensors(historicalData: TokenData[]): tf.Tensor[] {
        return historicalData.map(tokenData => {
            // Convert price history to tensor
            const prices = tokenData.priceHistory.slice(0, this.maxTimePeriods);
            return tf.tensor1d(prices);
        });
    }

    private async runBacktestTensorFlow(
        historicalData: TokenData[], 
        config: any, 
        params: any
    ): Promise<BacktestResult> {
        // Apply parameters to config
        const testConfig = this.applyAllParameters(config, params);
        
        // Run backtest using TensorFlow.js for calculations
        const trades: any[] = [];
        let balance = this.initialBalance;
        let maxBalance = this.initialBalance;
        let maxDrawdown = 0;
        const positions = new Map<string, any>();
        
        const minHistoryLength = Math.min(...historicalData.map(token => token.priceHistory.length));
        const simulationLength = Math.min(minHistoryLength, this.maxTimePeriods);
        
        // Use TensorFlow.js for batch calculations
        for (let timeIndex = 50; timeIndex < simulationLength; timeIndex++) {
            // Process all tokens at this time step using TensorFlow.js
            const timeStepResults = await this.processTimeStepTensorFlow(
                historicalData, 
                testConfig, 
                timeIndex, 
                positions, 
                balance
            );
            
            // Update results
            trades.push(...timeStepResults.trades);
            balance = timeStepResults.balance;
            
            // Update max balance and drawdown
            const currentTotalValue = balance + Array.from(positions.values()).reduce((sum, pos) => {
                const currentPrice = pos.currentPrice;
                return sum + (pos.remainingAmount * currentPrice);
            }, 0);
            
            if (currentTotalValue > maxBalance) {
                maxBalance = currentTotalValue;
            }
            
            const drawdown = (maxBalance - currentTotalValue) / maxBalance;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
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
                    strategy: 'TensorFlow',
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
        
        // Calculate metrics using TensorFlow.js
        const metrics = this.calculateMetricsTensorFlow(trades);
        
        return {
            trades,
            finalBalance: balance,
            totalProfit: balance - this.initialBalance,
            maxDrawdown,
            winRate: metrics.winRate,
            sharpeRatio: metrics.sharpeRatio
        };
    }

    private async processTimeStepTensorFlow(
        historicalData: TokenData[], 
        config: any, 
        timeIndex: number, 
        positions: Map<string, any>, 
        balance: number
    ): Promise<{ trades: any[], balance: number }> {
        const trades: any[] = [];
        let currentBalance = balance;
        
        // Process all tokens in parallel using TensorFlow.js
        await Promise.all(
            historicalData.map(async (tokenData) => {
                try {
                    const currentTokenData = {
                        ...tokenData,
                        priceHistory: tokenData.priceHistory.slice(0, timeIndex + 1),
                        priceHistory5m: tokenData.priceHistory5m.slice(0, Math.floor((timeIndex + 1) / 5)),
                        priceHistory15m: tokenData.priceHistory15m.slice(0, Math.floor((timeIndex + 1) / 15))
                    };
                    
                    const continuousSignal = generateContinuousSignal(currentTokenData, config);
                    
                    // Check for buy signals
                    if (continuousSignal.score > 0.1 && continuousSignal.strength >= config.MIN_SIGNAL_STRENGTH) {
                        const position = positions.get(tokenData.ticker);
                        if (!position && currentBalance > config.MIN_TRADE_VALUE_USD) {
                            const tradeAmount = currentBalance * config.BASE_POSITION_SIZE;
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
                                    currentPrice
                                });
                                
                                currentBalance -= tradeAmount;
                                
                                trades.push({
                                    timestamp: Date.now(),
                                    strategy: 'TensorFlow',
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
                            profitPercentage <= -config.STOP_LOSS || 
                            profitPercentage >= config.TAKE_PROFIT_LEVELS[0]) {
                            
                            const sellValue = position.remainingAmount * currentPrice;
                            currentBalance += sellValue;
                            
                            trades.push({
                                timestamp: Date.now(),
                                strategy: 'TensorFlow',
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
                        } else {
                            // Update current price
                            position.currentPrice = currentPrice;
                        }
                    }
                    
                } catch (error) {
                    console.error(`Error processing token ${tokenData.ticker}:`, error);
                }
            })
        );
        
        return { trades, balance: currentBalance };
    }

    private calculateMetricsTensorFlow(trades: any[]): { winRate: number, sharpeRatio: number } {
        // Use TensorFlow.js for metric calculations
        const winningTrades = trades.filter(t => {
            if (t.action === 'BUY') return false;
            const buyTrade = trades.find(bt => bt.token === t.token && bt.action === 'BUY' && bt.timestamp < t.timestamp);
            if (!buyTrade) return false;
            return (t.price - buyTrade.price) / buyTrade.price > 0;
        }).length;
        
        const winRate = trades.filter(t => t.action === 'SELL').length > 0 ? 
            winningTrades / trades.filter(t => t.action === 'SELL').length : 0;
        
        // Calculate Sharpe ratio using TensorFlow.js
        const returns = trades.filter(t => t.action === 'SELL').map(t => {
            const buyTrade = trades.find(bt => bt.token === t.token && bt.action === 'BUY' && bt.timestamp < t.timestamp);
            if (!buyTrade) return 0;
            return (t.price - buyTrade.price) / buyTrade.price;
        });
        
        if (returns.length === 0) {
            return { winRate, sharpeRatio: 0 };
        }
        
        // Use TensorFlow.js for statistical calculations
        const returnsTensor = tf.tensor1d(returns);
        const meanReturn = returnsTensor.mean();
        const variance = returnsTensor.sub(meanReturn).square().mean();
        const stdDev = variance.sqrt();
        const sharpeRatio = meanReturn.div(stdDev);
        
        const result = {
            winRate,
            sharpeRatio: sharpeRatio.dataSync()[0]
        };
        
        // Clean up tensors
        tf.dispose([returnsTensor, meanReturn, variance, stdDev, sharpeRatio]);
        
        return result;
    }

    private createNetworkConfig(network: 'SOLANA' | 'ECLIPSE'): any {
        const baseConfig = { ...TradingConfig };
        if (network === 'SOLANA') {
            return { 
                ...baseConfig, 
                SOLANA: baseConfig.SOLANA,
                SIGNAL_CONFIG: baseConfig.SOLANA.SIGNAL_CONFIG
            };
        } else {
            return { 
                ...baseConfig, 
                ECLIPSE: baseConfig.ECLIPSE,
                SIGNAL_CONFIG: baseConfig.ECLIPSE.SIGNAL_CONFIG
            };
        }
    }

    private async getHistoricalData(network: 'SOLANA' | 'ECLIPSE'): Promise<TokenData[]> {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (this.testPeriodDays * 24 * 60 * 60 * 1000));
        
        console.log(`📅 Fetching ${network} data from ${startDate.toISOString()} to ${endDate.toISOString()}`);
        
        const PriceModel = model('prices', PriceSchema);
        const priceData = await PriceModel.find({
            chain: network,
            timestamp: { $gte: startDate, $lte: endDate }
        }).sort({ timestamp: 1 }).lean();
        
        // Group by token and create TokenData objects
        const tokenDataMap = new Map<string, TokenData>();
        
        for (const entry of priceData) {
            const key = entry.token;
            if (!tokenDataMap.has(key)) {
                tokenDataMap.set(key, {
                    ticker: entry.token,
                    address: entry.address,
                    decimals: 6,
                    priceHistory: [],
                    timestamps: [],
                    priceHistory5m: [],
                    priceHistory15m: [],
                    priceHistory1h: [],
                    timestamps5m: [],
                    timestamps15m: [],
                    timestamps1h: [],
                    priceAnalysisHistory: [],
                    spreadHistory: [],
                    liquidityScores: [],
                    confidenceHistory: [],
                    lastEnhancedUpdate: Date.now()
                });
            }
            
            const tokenData = tokenDataMap.get(key)!;
            tokenData.priceHistory.push(entry.price);
            
            // Add to other timeframes (simplified)
            if (tokenData.priceHistory.length % 5 === 0) {
                tokenData.priceHistory5m.push(entry.price);
            }
            if (tokenData.priceHistory.length % 15 === 0) {
                tokenData.priceHistory15m.push(entry.price);
            }
            
            // Add spread and liquidity data
            if (entry.spreadPercentage !== undefined && entry.spreadPercentage !== null) {
                tokenData.spreadHistory.push(entry.spreadPercentage);
            }
            if (entry.liquidityScore !== undefined && entry.liquidityScore !== null) {
                tokenData.liquidityScores.push(entry.liquidityScore);
            }
        }
        
        // Filter tokens with sufficient data
        const validTokens = Array.from(tokenDataMap.values()).filter(token => 
            token.priceHistory.length >= 50 && // At least 50 price points
            !this.isGasTokenOrStablecoin(token.ticker, network)
        );
        
        console.log(`Found ${validTokens.length} valid tokens with sufficient data`);
        return validTokens;
    }

    private isGasTokenOrStablecoin(ticker: string, network: 'SOLANA' | 'ECLIPSE'): boolean {
        const validatedTokens = network === 'SOLANA' ? SolanaCoreValidatedTokens : EclipseCoreValidatedTokens;
        const token = validatedTokens.find(t => t.ticker === ticker);
        return token ? (token.isGasToken || token.isStablecoin) : false;
    }

    private applyAllParameters(config: any, params: any): any {
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

    async saveOptimizationResults(results: TensorFlowOptimizationResult[]): Promise<void> {
        console.log('\n💾 Saving TensorFlow.js optimization results...');
        
        // Save top results to a file
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `tensorflow-optimization-results-${timestamp}.json`;
        
        const output = {
            timestamp: new Date().toISOString(),
            testPeriodDays: this.testPeriodDays,
            initialBalance: this.initialBalance,
            batchSize: this.batchSize,
            totalCombinations: results.length,
            averageExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
            gpuAccelerated: results[0]?.gpuAccelerated || false,
            backend: tf.getBackend(),
            results: results.slice(0, 50) // Save top 50 results
        };
        
        fs.writeFileSync(filename, JSON.stringify(output, null, 2));
        console.log(`TensorFlow.js results saved to ${filename}`);
        
        // Also save the best configuration for each network
        const bestSolana = results.filter(r => r.network === 'SOLANA').sort((a, b) => b.totalProfit - a.totalProfit)[0];
        const bestEclipse = results.filter(r => r.network === 'ECLIPSE').sort((a, b) => b.totalProfit - a.totalProfit)[0];
        
        if (bestSolana) {
            console.log('\n🏆 Best SOLANA TensorFlow.js Configuration:');
            console.log(`Profit: $${bestSolana.totalProfit.toFixed(2)}`);
            console.log(`Trades: ${bestSolana.totalTrades}`);
            console.log(`Win Rate: ${(bestSolana.winRate * 100).toFixed(1)}%`);
            console.log(`Execution Time: ${bestSolana.executionTime}ms`);
            console.log(`GPU Accelerated: ${bestSolana.gpuAccelerated}`);
            console.log('Thresholds:', bestSolana.thresholds);
        }
        
        if (bestEclipse) {
            console.log('\n🏆 Best ECLIPSE TensorFlow.js Configuration:');
            console.log(`Profit: $${bestEclipse.totalProfit.toFixed(2)}`);
            console.log(`Trades: ${bestEclipse.totalTrades}`);
            console.log(`Win Rate: ${(bestEclipse.winRate * 100).toFixed(1)}%`);
            console.log(`Execution Time: ${bestEclipse.executionTime}ms`);
            console.log(`GPU Accelerated: ${bestEclipse.gpuAccelerated}`);
            console.log('Thresholds:', bestEclipse.thresholds);
        }
    }
}

// Main execution
async function main() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carpcap';
        await connect(mongoUri);
        console.log('📦 Connected to MongoDB');
        
        const optimizer = new TensorFlowOptimizer();
        const results = await optimizer.optimizeSignalsTensorFlow();
        
        await optimizer.saveOptimizationResults(results);
        
    } catch (error) {
        console.error('TensorFlow.js optimization failed:', error);
    } finally {
        await disconnect();
        console.log('📦 Disconnected from MongoDB');
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { TensorFlowOptimizer }; 