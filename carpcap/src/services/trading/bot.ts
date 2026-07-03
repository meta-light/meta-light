import dotenv from 'dotenv';
import { TELEGRAM_BOT_TOKEN } from '../../env';
import { getChainConfigs } from './index-old';
import { TelegramTradingService } from './telegram';
import { CombinedPerformanceData } from './models/interfaces';
dotenv.config();

function gatherAllPerformanceData(): CombinedPerformanceData {
    const chainConfigs = getChainConfigs();
    let totalCombinedValue = 0;
    let totalCombinedTrades = 0;
    let isAnyActive = false;
    const chainData = chainConfigs.map(chain => {
        let performance = null;
        let isRunning = false;
        try {
            isRunning = chain.isRunning();
            if (isRunning) {
                performance = chain.getPerformance();
                if (performance && typeof performance === 'object') {
                    const portfolioValue = Math.max(0, performance.totalPortfolioValue ||  performance.portfolioValue ||  0);
                    const trades = performance.strategies?.reduce((sum: number, s: any) => sum + Math.max(0, s.totalTrades || 0), 0) || Math.max(0, performance.totalTrades || 0);
                    totalCombinedValue += portfolioValue;
                    totalCombinedTrades += trades;
                    isAnyActive = true;
                    console.log(`[${chain.name}] (${chain.mode}): Portfolio Value = $${portfolioValue.toFixed(2)}, Trades = ${trades}, Running = ${isRunning}`);
                } 
                else {console.log(`[${chain.name}] (${chain.mode}): No performance data (returned null/undefined), Running = ${isRunning}`);}
            } 
            else {console.log(`${chain.name} (${chain.mode}): Not running`);}
        } 
        catch (error) {console.log(`${chain.name} (${chain.mode}) error:`, error instanceof Error ? error.message : String(error));}
        return {name: chain.name, mode: chain.mode, performance, isRunning};
    });
    return {chains: chainData, totalCombinedValue, totalCombinedTrades, isAnyActive};
}

export function startTelegramClient() {
    if (!TELEGRAM_BOT_TOKEN) {console.error('TELEGRAM_BOT_TOKEN not set in environment variables.'); return { cleanup: () => {} };}
    const telegramService = new TelegramTradingService({botToken: TELEGRAM_BOT_TOKEN}); // DM mode forced in service
    async function initialize() {
        const initialized = await telegramService.initialize();
        if (initialized) {
            console.log('[TradingBot] Telegram service initialized');
            await telegramService.sendStartupMessage();
            telegramService.setPerformanceReportInterval(gatherAllPerformanceData, 8 * 60 * 60 * 1000);
            setTimeout(async () => {try {const combinedData = gatherAllPerformanceData(); await telegramService.sendPerformanceReport(combinedData);} catch (error) {console.error('[TradingBot] Error sending initial performance report:', error);}}, 5000);
        } 
        else {console.error('[TradingBot] Failed to initialize Telegram service');}
    }
    initialize();
    const cleanup = () => {telegramService.cleanup();};
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    return { cleanup,  telegramService, sendPerformanceReport: () => {const combinedData = gatherAllPerformanceData(); return telegramService.sendPerformanceReport(combinedData);}};
}