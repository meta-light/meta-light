import { connect, disconnect, model } from 'mongoose';
import { PriceSchema } from '../../models/price';
import { TradingConfig, SolanaCoreValidatedTokens, EclipseCoreValidatedTokens } from '../../config';
import { TokenData } from '../../models/interfaces';
import { Worker } from 'worker_threads';
import * as os from 'os';
import { WorkerOptimizationResult } from './worker-optimization';
import dotenv from 'dotenv';
dotenv.config();

type MulticoreOptimizationResult = WorkerOptimizationResult;

interface WorkerMessage {
    type: 'result' | 'progress' | 'error';
    data: any;
    workerId: number;
}

class MulticoreOptimizer {
    private initialBalance = 1000;
    private testPeriodDays = 7;
    private maxTimePeriods = 500;
    private numWorkers: number;
    
    // Parameter ranges for comprehensive optimization
    private thresholdRanges = {
        'SMA_Crossover': this.generateRange(0.1, 1.0, 0.05), // 19 values
        'EMA_Crossover': this.generateRange(0.1, 1.0, 0.05),
        'RSI_Oversold_Overbought': this.generateRange(0.2, 1.0, 0.05), // 17 values
        'MACD_Signal': this.generateRange(0.1, 1.0, 0.05),
        'Bollinger_Bands': this.generateRange(0.2, 1.0, 0.05),
        'Stochastic_Oscillator': this.generateRange(0.3, 1.0, 0.05), // 15 values
        'ADX_Trend': this.generateRange(0.2, 1.0, 0.05),
        'Combined_Momentum': this.generateRange(0.2, 1.0, 0.05),
        'Pattern_Recognition': this.generateRange(0.1, 1.0, 0.05),
        'Mean_Reversion': this.generateRange(0.1, 1.0, 0.05),
        'Liquidity_Based': this.generateRange(0.1, 1.0, 0.05)
    };

    private positionSizingRanges = {
        'BASE_POSITION_SIZE': this.generateRange(0.02, 0.25, 0.01), // 24 values
        'STOP_LOSS': this.generateRange(0.02, 0.15, 0.01), // 14 values
        'TAKE_PROFIT_1': this.generateRange(0.05, 0.30, 0.01), // 26 values
        'TAKE_PROFIT_2': this.generateRange(0.10, 0.40, 0.01), // 31 values
        'TAKE_PROFIT_3': this.generateRange(0.20, 0.50, 0.01), // 31 values
        'TRAILING_STOP_DISTANCE': this.generateRange(0.01, 0.10, 0.01) // 10 values
    };

    private signalSensitivityRanges = {
        'MIN_SIGNAL_STRENGTH': this.generateRange(0.1, 0.6, 0.05), // 11 values
        'MIN_SIGNAL_CONFIDENCE': this.generateRange(0.1, 0.6, 0.05), // 11 values
        'MIN_BUY_CONFLUENCE': [1, 2, 3, 4], // 4 values
        'MIN_SELL_CONFLUENCE': [1, 2, 3, 4], // 4 values
        'VOLATILITY_THRESHOLD': this.generateRange(0.10, 0.40, 0.05), // 7 values
        'PRICE_MOVEMENT_THRESHOLD': [0.001, 0.002, 0.003, 0.005, 0.008] // 5 values
    };

    private signalWeightRanges = {
        'SMA_Crossover_weight': this.generateRange(0.5, 1.5, 0.1), // 11 values
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
        // Use all available CPU cores on Apple Silicon
        this.numWorkers = os.cpus().length;
        console.log(`🍎 Apple Silicon detected: ${this.numWorkers} CPU cores available`);
    }

    private generateRange(start: number, end: number, step: number): number[] {
        const range: number[] = [];
        for (let i = start; i <= end; i += step) {
            range.push(parseFloat(i.toFixed(3)));
        }
        return range;
    }

    async optimizeSignalsMulticore(): Promise<MulticoreOptimizationResult[]> {
        console.log('🚀 Starting multi-core signal optimization for Apple Silicon...');
        
        const results: MulticoreOptimizationResult[] = [];
        
        // Optimize for both networks
        for (const network of ['SOLANA', 'ECLIPSE'] as const) {
            console.log(`\nOptimizing ${network} signals with ${this.numWorkers} CPU cores...`);
            const networkResults = await this.optimizeNetworkSignalsMulticore(network);
            results.push(...networkResults);
        }
        
        // Sort by total profit
        results.sort((a, b) => b.totalProfit - a.totalProfit);
        
        console.log('\n🏆 Top 10 Multi-Core Optimization Results:');
        results.slice(0, 10).forEach((result, index) => {
            console.log(`${index + 1}. ${result.network}: $${result.totalProfit.toFixed(2)} profit, ${result.totalTrades} trades, ${(result.winRate * 100).toFixed(1)}% win rate (Worker ${result.workerId}, ${result.executionTime}ms)`);
        });
        
        return results;
    }

    private async optimizeNetworkSignalsMulticore(network: 'SOLANA' | 'ECLIPSE'): Promise<MulticoreOptimizationResult[]> {
        const results: MulticoreOptimizationResult[] = [];
        const config = this.createNetworkConfig(network);
        
        // Get historical data
        const historicalData = await this.getHistoricalData(network);
        if (historicalData.length === 0) {
            console.log(`⚠️ No historical data found for ${network}`);
            return results;
        }
        
        // Generate parameter combinations
        const totalCombinations = 10000; // 10,000 combinations
        const combinationsPerWorker = Math.ceil(totalCombinations / this.numWorkers);
        
        console.log(`🎲 Distributing ${totalCombinations} combinations across ${this.numWorkers} workers (${combinationsPerWorker} per worker)`);
        
        // Create workers
        const workers: Worker[] = [];
        const promises: Promise<void>[] = [];
        
        for (let i = 0; i < this.numWorkers; i++) {
            const worker = new Worker('./src/worker.ts', {
                workerData: {
                    workerId: i,
                    network,
                    config,
                    historicalData,
                    combinationsPerWorker,
                    parameterRanges: {
                        thresholdRanges: this.thresholdRanges,
                        positionSizingRanges: this.positionSizingRanges,
                        signalSensitivityRanges: this.signalSensitivityRanges,
                        signalWeightRanges: this.signalWeightRanges
                    }
                }
            });
            
            workers.push(worker);
            
            const promise = new Promise<void>((resolve, reject) => {
                worker.on('message', (message: WorkerMessage) => {
                    if (message.type === 'result') {
                        results.push(...message.data);
                        console.log(`  Worker ${message.workerId}: Completed ${message.data.length} combinations`);
                    } else if (message.type === 'progress') {
                        console.log(`  Worker ${message.workerId}: ${message.data.progress}% complete`);
                    } else if (message.type === 'error') {
                        console.error(`  Worker ${message.workerId} error:`, message.data);
                    }
                });
                
                worker.on('error', reject);
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker ${i} stopped with exit code ${code}`));
                    } else {
                        resolve();
                    }
                });
            });
            
            promises.push(promise);
        }
        
        // Wait for all workers to complete
        await Promise.all(promises);
        
        // Clean up workers
        workers.forEach(worker => worker.terminate());
        
        return results;
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

    async saveOptimizationResults(results: MulticoreOptimizationResult[]): Promise<void> {
        console.log('\n💾 Saving multi-core optimization results...');
        
        // Save top results to a file
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `multicore-optimization-results-${timestamp}.json`;
        
        const output = {
            timestamp: new Date().toISOString(),
            testPeriodDays: this.testPeriodDays,
            initialBalance: this.initialBalance,
            numWorkers: this.numWorkers,
            totalCombinations: results.length,
            averageExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
            results: results.slice(0, 50) // Save top 50 results
        };
        
        fs.writeFileSync(filename, JSON.stringify(output, null, 2));
        console.log(`Multi-core results saved to ${filename}`);
        
        // Also save the best configuration for each network
        const bestSolana = results.filter(r => r.network === 'SOLANA').sort((a, b) => b.totalProfit - a.totalProfit)[0];
        const bestEclipse = results.filter(r => r.network === 'ECLIPSE').sort((a, b) => b.totalProfit - a.totalProfit)[0];
        
        if (bestSolana) {
            console.log('\n🏆 Best SOLANA Multi-Core Configuration:');
            console.log(`Profit: $${bestSolana.totalProfit.toFixed(2)}`);
            console.log(`Trades: ${bestSolana.totalTrades}`);
            console.log(`Win Rate: ${(bestSolana.winRate * 100).toFixed(1)}%`);
            console.log(`Worker: ${bestSolana.workerId}`);
            console.log(`Execution Time: ${bestSolana.executionTime}ms`);
            console.log('Thresholds:', bestSolana.thresholds);
        }
        
        if (bestEclipse) {
            console.log('\n🏆 Best ECLIPSE Multi-Core Configuration:');
            console.log(`Profit: $${bestEclipse.totalProfit.toFixed(2)}`);
            console.log(`Trades: ${bestEclipse.totalTrades}`);
            console.log(`Win Rate: ${(bestEclipse.winRate * 100).toFixed(1)}%`);
            console.log(`Worker: ${bestEclipse.workerId}`);
            console.log(`Execution Time: ${bestEclipse.executionTime}ms`);
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
        
        const optimizer = new MulticoreOptimizer();
        const results = await optimizer.optimizeSignalsMulticore();
        
        await optimizer.saveOptimizationResults(results);
        
    } catch (error) {
        console.error('Multi-core optimization failed:', error);
    } finally {
        await disconnect();
        console.log('📦 Disconnected from MongoDB');
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { MulticoreOptimizer }; 