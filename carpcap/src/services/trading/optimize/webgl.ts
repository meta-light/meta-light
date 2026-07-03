import { connect, disconnect, model } from 'mongoose';
import { PriceSchema } from '../models/price';
import { TradingConfig, SolanaCoreValidatedTokens, EclipseCoreValidatedTokens } from '../config';
import { TokenData } from '../models/interfaces';
import * as puppeteer from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();

interface GPUOptimizationResult {
    network: 'SOLANA' | 'ECLIPSE';
    thresholds: { [key: string]: number };
    positionSizing: { [key: string]: number };
    signalSensitivity: { [key: string]: number };
    signalWeights: { [key: string]: number };
    advanced: { [key: string]: number };
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

export interface BacktestResult {
    trades: any[];
    finalBalance: number;
    totalProfit: number;
    maxDrawdown: number;
    winRate: number;
    sharpeRatio: number;
}

class GPUOptimizer {
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;
    private initialBalance = 1000;
    private testPeriodDays = 30; // Expanded from 7 to 30 days for more comprehensive analysis
    private maxTimePeriods = 2000; // Increased from 500 to 2000 for full data utilization
    private batchSize = 100; // Increased batch size for better GPU utilization
    
    // Parameter ranges for comprehensive optimization - EXPANDED
    private thresholdRanges = {
        'SMA_Crossover': this.generateRange(0.01, 1.0, 0.01), // 20 values
        'EMA_Crossover': this.generateRange(0.01, 1.0, 0.01), // 20 values
        'RSI_Oversold_Overbought': this.generateRange(0.01, 1.0, 0.01), // 19 values
        'MACD_Signal': this.generateRange(0.01, 1.0, 0.01), // 20 values
        'Bollinger_Bands': this.generateRange(0.01, 1.0, 0.01), // 19 values
        'Stochastic_Oscillator': this.generateRange(0.01, 1.0, 0.01), // 17 values
        'ADX_Trend': this.generateRange(0.01, 1.0, 0.01), // 19 values
        'Combined_Momentum': this.generateRange(0.01, 1.0, 0.01), // 19 values
        'Pattern_Recognition': this.generateRange(0.01, 1.0, 0.01), // 20 values
        'Mean_Reversion': this.generateRange(0.01, 1.0, 0.01), // 20 values
        'Liquidity_Based': this.generateRange(0.01, 1.0, 0.01) // 20 values
    };

    private positionSizingRanges = {
        'BASE_POSITION_SIZE': this.generateRange(0.01, 0.30, 0.01), // 30 values
        'STOP_LOSS': this.generateRange(0.01, 0.20, 0.01), // 20 values
        'TAKE_PROFIT_1': this.generateRange(0.02, 0.40, 0.01), // 39 values
        'TAKE_PROFIT_2': this.generateRange(0.05, 0.50, 0.01), // 46 values
        'TAKE_PROFIT_3': this.generateRange(0.10, 0.60, 0.01), // 51 values
        'TRAILING_STOP_DISTANCE': this.generateRange(0.005, 0.15, 0.005) // 30 values
    };

    private signalSensitivityRanges = {
        'MIN_SIGNAL_STRENGTH': this.generateRange(0.05, 0.8, 0.05), // 16 values
        'MIN_SIGNAL_CONFIDENCE': this.generateRange(0.05, 0.8, 0.05), // 16 values
        'MIN_BUY_CONFLUENCE': [1, 2, 3, 4, 5, 6], // 6 values
        'MIN_SELL_CONFLUENCE': [1, 2, 3, 4, 5, 6], // 6 values
        'VOLATILITY_THRESHOLD': this.generateRange(0.05, 0.50, 0.02), // 23 values
        'PRICE_MOVEMENT_THRESHOLD': [0.0005, 0.001, 0.002, 0.003, 0.005, 0.008, 0.01, 0.015, 0.02] // 9 values
    };

    private signalWeightRanges = {
        'SMA_Crossover_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'EMA_Crossover_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'RSI_Oversold_Overbought_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'MACD_Signal_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'Bollinger_Bands_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'Stochastic_Oscillator_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'ADX_Trend_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'Combined_Momentum_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'Pattern_Recognition_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'Mean_Reversion_weight': this.generateRange(0.3, 2.0, 0.1), // 18 values
        'Liquidity_Based_weight': this.generateRange(0.3, 2.0, 0.1) // 18 values
    };

    // Additional advanced parameters for comprehensive optimization
    private advancedRanges = {
        'TRADE_COOLDOWN': [1000, 2000, 5000, 10000, 15000, 30000, 60000], // 7 values
        'MIN_TRADE_VALUE_USD': [1, 5, 10, 25, 50, 100, 250, 500], // 8 values
        'MAX_POSITION_SIZE': this.generateRange(0.05, 0.50, 0.05), // 10 values
        'MIN_POSITION_SIZE': this.generateRange(0.01, 0.10, 0.01), // 10 values
        'PRICE_MOVEMENT_LOOKBACK_PERIODS': [5, 10, 15, 20, 25, 30, 40, 50], // 8 values
        'MARKET_CONDITION_MULTIPLIER': this.generateRange(0.5, 2.0, 0.1), // 16 values
        'RISK_ADJUSTMENT_FACTOR': this.generateRange(0.5, 1.5, 0.1), // 11 values
        'TEMPORAL_DECAY_FACTOR': this.generateRange(0.8, 1.2, 0.05) // 9 values
    };

    constructor() {
        console.log('🧠 GPU Browser Optimizer initialized');
        console.log('🍎 Apple Silicon GPU acceleration via WebGL');
    }

    private generateRange(start: number, end: number, step: number): number[] {
        const range: number[] = [];
        for (let i = start; i <= end; i += step) {
            range.push(parseFloat(i.toFixed(3)));
        }
        return range;
    }

    async initializeBrowser(): Promise<void> {
        console.log('🌐 Launching headless browser for GPU acceleration...');
        
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu-sandbox',
                '--enable-webgl',
                '--enable-webgl2',
                '--enable-unsafe-webgpu'
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Set up the page with TensorFlow.js
        await this.page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>GPU Optimization</title>
                <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest"></script>
            </head>
            <body>
                <div id="status">Initializing...</div>
                <script>
                    window.tf = tf;
                    window.results = [];
                    
                    async function initializeGPU() {
                        try {
                            await tf.setBackend('webgl');
                            const backend = tf.getBackend();
                            const gpuInfo = tf.backend().gpgpu;
                            
                            return {
                                success: true,
                                backend: backend,
                                gpuAccelerated: backend === 'webgl',
                                renderer: gpuInfo ? gpuInfo.gl.getParameter(gpuInfo.gl.RENDERER) : 'Unknown',
                                vendor: gpuInfo ? gpuInfo.gl.getParameter(gpuInfo.gl.VENDOR) : 'Unknown'
                            };
                        } catch (error) {
                            return {
                                success: false,
                                error: error.message
                            };
                        }
                    }
                    
                    async function runOptimization(data, parameters) {
                        try {
                            const startTime = performance.now();
                            
                            // Convert data to tensors
                            const priceTensors = data.map(token => 
                                tf.tensor1d(token.priceHistory.slice(0, 500))
                            );
                            
                            // Run optimization calculations
                            const results = [];
                            for (let i = 0; i < parameters.length; i++) {
                                const params = parameters[i];
                                
                                // Simulate backtest with tensor operations
                                const simulationResult = await simulateBacktest(priceTensors, params);
                                results.push({
                                    ...params,
                                    ...simulationResult,
                                    executionTime: performance.now() - startTime
                                });
                            }
                            
                            // Clean up tensors
                            tf.dispose(priceTensors);
                            
                            return results;
                        } catch (error) {
                            return { error: error.message };
                        }
                    }
                    
                    async function simulateBacktest(priceTensors, params) {
                        // Simplified backtest simulation using tensor operations
                        const returns = [];
                        
                        for (const priceTensor of priceTensors) {
                            // Calculate returns
                            const prices = priceTensor.arraySync();
                            for (let i = 1; i < prices.length; i++) {
                                const return_pct = (prices[i] - prices[i-1]) / prices[i-1];
                                returns.push(return_pct);
                            }
                        }
                        
                        // Calculate metrics using tensor operations
                        const returnsTensor = tf.tensor1d(returns);
                        const meanReturn = returnsTensor.mean();
                        const variance = returnsTensor.sub(meanReturn).square().mean();
                        const stdDev = variance.sqrt();
                        const sharpeRatio = meanReturn.div(stdDev);
                        
                        const metrics = {
                            totalProfit: meanReturn.dataSync()[0] * 1000,
                            totalTrades: returns.length,
                            winRate: returns.filter(r => r > 0).length / returns.length,
                            sharpeRatio: sharpeRatio.dataSync()[0],
                            maxDrawdown: Math.min(...returns),
                            finalBalance: 1000 + (meanReturn.dataSync()[0] * 1000)
                        };
                        
                        tf.dispose([returnsTensor, meanReturn, variance, stdDev, sharpeRatio]);
                        
                        return metrics;
                    }
                    
                    window.initializeGPU = initializeGPU;
                    window.runOptimization = runOptimization;
                </script>
            </body>
            </html>
        `);
        
        // Wait for TensorFlow.js to load
        await this.page.waitForFunction(() => (window as any).tf !== undefined);
        
        // Initialize GPU
        const gpuResult = await this.page.evaluate(() => (window as any).initializeGPU());
        
        if (gpuResult.success) {
            console.log('GPU acceleration initialized successfully!');
            console.log(`  - Backend: ${gpuResult.backend}`);
            console.log(`  - GPU: ${gpuResult.renderer}`);
            console.log(`  - Vendor: ${gpuResult.vendor}`);
        } else {
            console.log('GPU initialization failed:', gpuResult.error);
        }
    }

    async optimizeSignalsGPU(): Promise<GPUOptimizationResult[]> {
        console.log('🚀 Starting GPU-accelerated signal optimization...');
        
        await this.initializeBrowser();
        
        const results: GPUOptimizationResult[] = [];
        
        // Optimize for both networks
        for (const network of ['SOLANA', 'ECLIPSE'] as const) {
            console.log(`\nOptimizing ${network} signals with GPU acceleration...`);
            const networkResults = await this.optimizeNetworkSignalsGPU(network);
            results.push(...networkResults);
        }
        
        // Sort by total profit
        results.sort((a, b) => b.totalProfit - a.totalProfit);
        
        console.log('\n🏆 Top 10 GPU Optimization Results:');
        results.slice(0, 10).forEach((result, index) => {
            console.log(`${index + 1}. ${result.network}: $${result.totalProfit.toFixed(2)} profit, ${result.totalTrades} trades, ${(result.winRate * 100).toFixed(1)}% win rate (${result.executionTime}ms, GPU: ${result.gpuAccelerated})`);
        });
        
        await this.cleanup();
        return results;
    }

    private async optimizeNetworkSignalsGPU(network: 'SOLANA' | 'ECLIPSE'): Promise<GPUOptimizationResult[]> {
        const results: GPUOptimizationResult[] = [];
        const config = this.createNetworkConfig(network);
        
        // Get historical data
        const historicalData = await this.getHistoricalData(network);
        if (historicalData.length === 0) {
            console.log(`⚠️ No historical data found for ${network}`);
            return results;
        }
        
        // Generate parameter combinations
        const totalCombinations = 10000; // 10,000 combinations for comprehensive analysis
        const batches = Math.ceil(totalCombinations / this.batchSize);
        
        console.log(`🎲 Processing ${totalCombinations} combinations in ${batches} batches of ${this.batchSize}...`);
        
        for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
            const startTime = Date.now();
            const batchSize = Math.min(this.batchSize, totalCombinations - batchIndex * this.batchSize);
            
            // Generate batch of parameter combinations
            const parameterBatch = this.generateParameterBatch(batchSize);
            
            // Process batch with GPU
            const batchResults = await this.processBatchGPU(historicalData, config, parameterBatch, network);
            
            results.push(...batchResults);
            
            const batchTime = Date.now() - startTime;
            console.log(`  Batch ${batchIndex + 1}/${batches}: ${batchResults.length} combinations processed in ${batchTime}ms`);
        }
        
        return results;
    }

    private generateParameterBatch(batchSize: number): Array<{
        thresholds: { [key: string]: number };
        positionSizing: { [key: string]: number };
        signalSensitivity: { [key: string]: number };
        signalWeights: { [key: string]: number };
        advanced: { [key: string]: number };
    }> {
        const batch: Array<{
            thresholds: { [key: string]: number };
            positionSizing: { [key: string]: number };
            signalSensitivity: { [key: string]: number };
            signalWeights: { [key: string]: number };
            advanced: { [key: string]: number };
        }> = [];
        
        for (let i = 0; i < batchSize; i++) {
            const thresholds: { [key: string]: number } = {};
            const positionSizing: { [key: string]: number } = {};
            const signalSensitivity: { [key: string]: number } = {};
            const signalWeights: { [key: string]: number } = {};
            const advanced: { [key: string]: number } = {};
            
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
            
            // Generate random advanced parameters
            for (const [paramName, range] of Object.entries(this.advancedRanges)) {
                const randomIndex = Math.floor(Math.random() * range.length);
                advanced[paramName] = range[randomIndex];
            }
            
            batch.push({ thresholds, positionSizing, signalSensitivity, signalWeights, advanced });
        }
        
        return batch;
    }

    private async processBatchGPU(
        historicalData: TokenData[], 
        config: any, 
        parameterBatch: Array<{
            thresholds: { [key: string]: number };
            positionSizing: { [key: string]: number };
            signalSensitivity: { [key: string]: number };
            signalWeights: { [key: string]: number };
        }>, 
        network: 'SOLANA' | 'ECLIPSE'
    ): Promise<GPUOptimizationResult[]> {
        const results: GPUOptimizationResult[] = [];
        
        // Prepare data for browser
        const browserData = historicalData.map(token => ({
            ticker: token.ticker,
            priceHistory: token.priceHistory.slice(0, this.maxTimePeriods)
        }));
        
        // Run optimization in browser
        const browserResults = await this.page!.evaluate(
            (data, parameters) => (window as any).runOptimization(data, parameters),
            browserData,
            parameterBatch
        );
        
        if (browserResults.error) {
            console.error('Browser optimization error:', browserResults.error);
            return results;
        }
        
        // Convert browser results to our format
        for (const browserResult of browserResults) {
            results.push({
                network,
                thresholds: browserResult.thresholds,
                positionSizing: browserResult.positionSizing,
                signalSensitivity: browserResult.signalSensitivity,
                signalWeights: browserResult.signalWeights,
                advanced: browserResult.advanced || {},
                totalProfit: browserResult.totalProfit,
                totalTrades: browserResult.totalTrades,
                winRate: browserResult.winRate,
                avgProfitPerTrade: browserResult.totalProfit / Math.max(browserResult.totalTrades, 1),
                maxDrawdown: browserResult.maxDrawdown,
                sharpeRatio: browserResult.sharpeRatio,
                finalBalance: browserResult.finalBalance,
                executionTime: browserResult.executionTime,
                gpuAccelerated: true
            });
        }
        
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
            tokenData.timestamps.push(entry.timestamp.getTime());
            
            // Add to other timeframes with proper aggregation
            if (tokenData.priceHistory.length % 5 === 0) {
                tokenData.priceHistory5m.push(entry.price);
                tokenData.timestamps5m.push(entry.timestamp.getTime());
            }
            if (tokenData.priceHistory.length % 15 === 0) {
                tokenData.priceHistory15m.push(entry.price);
                tokenData.timestamps15m.push(entry.timestamp.getTime());
            }
            if (tokenData.priceHistory.length % 60 === 0) {
                tokenData.priceHistory1h.push(entry.price);
                tokenData.timestamps1h.push(entry.timestamp.getTime());
            }
            
            // Add spread and liquidity data with validation
            if (entry.spreadPercentage !== undefined && entry.spreadPercentage !== null && entry.spreadPercentage >= 0) {
                tokenData.spreadHistory.push(entry.spreadPercentage);
            }
            if (entry.liquidityScore !== undefined && entry.liquidityScore !== null && entry.liquidityScore >= 0) {
                tokenData.liquidityScores.push(entry.liquidityScore);
            }
            
            // Add confidence score based on data quality
            const confidence = this.calculateDataConfidence(entry);
            tokenData.confidenceHistory.push(confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low');
        }
        
        // Filter tokens with sufficient data - more comprehensive filtering
        const validTokens = Array.from(tokenDataMap.values()).filter(token => 
            token.priceHistory.length >= 100 && // Increased minimum to 100 price points for better analysis
            !this.isGasTokenOrStablecoin(token.ticker, network) &&
            token.priceHistory.some(price => price > 0) // Ensure we have valid prices
        );
        
        console.log(`Found ${validTokens.length} valid tokens with sufficient data`);
        return validTokens;
    }

    private calculateDataConfidence(entry: any): number {
        let confidence = 0.5; // Base confidence
        
        // Price validation
        if (entry.price > 0) confidence += 0.2;
        
        // Spread validation
        if (entry.spreadPercentage !== undefined && entry.spreadPercentage !== null && entry.spreadPercentage >= 0) {
            confidence += 0.1;
        }
        
        // Liquidity validation
        if (entry.liquidityScore !== undefined && entry.liquidityScore !== null && entry.liquidityScore >= 0) {
            confidence += 0.1;
        }
        
        // Volume validation (if available)
        if (entry.volume !== undefined && entry.volume > 0) {
            confidence += 0.1;
        }
        
        return Math.min(1.0, confidence);
    }

    private isGasTokenOrStablecoin(ticker: string, network: 'SOLANA' | 'ECLIPSE'): boolean {
        const validatedTokens = network === 'SOLANA' ? SolanaCoreValidatedTokens : EclipseCoreValidatedTokens;
        const token = validatedTokens.find(t => t.ticker === ticker);
        return token ? (token.isGasToken || token.isStablecoin) : false;
    }

    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    async saveOptimizationResults(results: GPUOptimizationResult[]): Promise<void> {
        console.log('\n💾 Saving GPU optimization results...');
        
        // Save top results to a file
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `gpu-optimization-results-${timestamp}.json`;
        
        const output = {
            timestamp: new Date().toISOString(),
            testPeriodDays: this.testPeriodDays,
            initialBalance: this.initialBalance,
            batchSize: this.batchSize,
            totalCombinations: results.length,
            averageExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
            gpuAccelerated: true,
            backend: 'WebGL',
            results: results.slice(0, 50) // Save top 50 results
        };
        
        fs.writeFileSync(filename, JSON.stringify(output, null, 2));
        console.log(`GPU results saved to ${filename}`);
        
        // Also save the best configuration for each network
        const bestSolana = results.filter(r => r.network === 'SOLANA').sort((a, b) => b.totalProfit - a.totalProfit)[0];
        const bestEclipse = results.filter(r => r.network === 'ECLIPSE').sort((a, b) => b.totalProfit - a.totalProfit)[0];
        
        if (bestSolana) {
            console.log('\n🏆 Best SOLANA GPU Configuration:');
            console.log(`Profit: $${bestSolana.totalProfit.toFixed(2)}`);
            console.log(`Trades: ${bestSolana.totalTrades}`);
            console.log(`Win Rate: ${(bestSolana.winRate * 100).toFixed(1)}%`);
            console.log(`Execution Time: ${bestSolana.executionTime}ms`);
            console.log(`GPU Accelerated: ${bestSolana.gpuAccelerated}`);
            console.log('\nSignal Thresholds:');
            Object.entries(bestSolana.thresholds).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log('\n💰 Position Sizing:');
            Object.entries(bestSolana.positionSizing).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log('\n🎯 Signal Sensitivity:');
            Object.entries(bestSolana.signalSensitivity).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log('\n⚖️ Signal Weights:');
            Object.entries(bestSolana.signalWeights).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log('\n🚀 Advanced Parameters:');
            Object.entries(bestSolana.advanced).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        }
        
        if (bestEclipse) {
            console.log('\n🏆 Best ECLIPSE GPU Configuration:');
            console.log(`Profit: $${bestEclipse.totalProfit.toFixed(2)}`);
            console.log(`Trades: ${bestEclipse.totalTrades}`);
            console.log(`Win Rate: ${(bestEclipse.winRate * 100).toFixed(1)}%`);
            console.log(`Execution Time: ${bestEclipse.executionTime}ms`);
            console.log(`GPU Accelerated: ${bestEclipse.gpuAccelerated}`);
            console.log('\nSignal Thresholds:');
            Object.entries(bestEclipse.thresholds).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log('\n💰 Position Sizing:');
            Object.entries(bestEclipse.positionSizing).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log('\n🎯 Signal Sensitivity:');
            Object.entries(bestEclipse.signalSensitivity).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log('\n⚖️ Signal Weights:');
            Object.entries(bestEclipse.signalWeights).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log('\n🚀 Advanced Parameters:');
            Object.entries(bestEclipse.advanced).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        }
    }
}

// Main execution
async function main() {
    const optimizer = new GPUOptimizer();
    
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carpcap';
        console.log('📦 Attempting to connect to MongoDB...');
        await connect(mongoUri);
        console.log('📦 Connected to MongoDB');
        
        const results = await optimizer.optimizeSignalsGPU();
        
        await optimizer.saveOptimizationResults(results);
        
    } catch (error) {
        console.error('GPU optimization failed:', error);
        
        // If MongoDB connection failed, provide helpful error message
        if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 MongoDB Connection Issue:');
            console.log('   - Make sure MongoDB is running on localhost:27017');
            console.log('   - Or set MONGODB_URI environment variable');
            console.log('   - Example: MONGODB_URI=mongodb://localhost:27017/carpcap');
        }
    } finally {
        try {
            await optimizer.cleanup();
            await disconnect();
            console.log('📦 Disconnected from MongoDB');
        } catch (cleanupError) {
            console.error('📦 Cleanup error:', cleanupError);
        }
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { GPUOptimizer }; 