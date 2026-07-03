import { parentPort, workerData } from 'worker_threads';
import { WorkerOptimizationResult, generateParameterCombinations, runBacktest } from './worker-optimization';

// Worker thread code
const { workerId, network, config, historicalData, combinationsPerWorker, parameterRanges } = workerData;

async function workerOptimization() {
    const results: WorkerOptimizationResult[] = [];
    const startTime = Date.now();
    
    try {
        // Generate parameter combinations for this worker
        const combinations = generateParameterCombinations(combinationsPerWorker, parameterRanges);
        
        // Process each combination
        for (let i = 0; i < combinations.length; i++) {
            const params = combinations[i];
            const backtestResult = await runBacktest(historicalData, config, params);
            
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
                workerId
            });
            
            // Report progress every 100 combinations
            if (i % 100 === 0) {
                parentPort?.postMessage({
                    type: 'progress',
                    data: { progress: Math.round((i / combinations.length) * 100) },
                    workerId
                });
            }
        }
        
        // Send results back to main thread
        parentPort?.postMessage({
            type: 'result',
            data: results,
            workerId
        });
        
    } catch (error) {
        parentPort?.postMessage({
            type: 'error',
            data: (error as Error).message,
            workerId
        });
    }
}

// Start worker optimization
workerOptimization(); 