import { startEclipsePaperTrading, stopEclipsePaperTrading, getEclipsePaperTradingPerformance } from './trading/paper';
import { startSolanaPaperTrading, stopSolanaPaperTrading, getSolanaPaperTradingPerformance } from './trading/paper';
import { startPriceService, stopPriceService, isPriceServiceRunning } from './trading/price';
import { startTelegramClient } from './bot';
import { ChainConfig } from './models/interfaces';

const chainConfigs: ChainConfig[] = [
    {
        name: 'SOLANA',
        mode: 'PAPER',
        enabled: true,
        start: startSolanaPaperTrading,
        stop: stopSolanaPaperTrading,
        getPerformance: getSolanaPaperTradingPerformance,
        isRunning: () => {try {const perf = getSolanaPaperTradingPerformance(); return perf !== null && perf !== undefined;} catch {return false;}}
    },
    {
        name: 'ECLIPSE',
        mode: 'PAPER',
        enabled: true,
        start: startEclipsePaperTrading,
        stop: stopEclipsePaperTrading,
        getPerformance: getEclipsePaperTradingPerformance,
        isRunning: () => {try {const perf = getEclipsePaperTradingPerformance(); return perf !== null && perf !== undefined;} catch {return false;}}
    }
];

export function setChainMode(chainName: string, mode: 'PAPER' | 'LIVE') {
    const config = chainConfigs.find(c => c.name === chainName);
    if (!config) {console.error(`Chain ${chainName} not found`); return;}
    config.mode = mode;
    if (chainName === 'SOLANA') {
        config.start = startSolanaPaperTrading;
        config.stop = stopSolanaPaperTrading;
        config.getPerformance = getSolanaPaperTradingPerformance;
        config.isRunning = () => {try {const perf = getSolanaPaperTradingPerformance(); return perf !== null && perf !== undefined;} catch {return false;}};
    } 
    else if (chainName === 'ECLIPSE') {
        config.start = startEclipsePaperTrading;
        config.stop = stopEclipsePaperTrading;
        config.getPerformance = getEclipsePaperTradingPerformance;
        config.isRunning = () => {try {const perf = getEclipsePaperTradingPerformance(); return perf !== null && perf !== undefined;} catch {return false;}};
    }
    console.log(`${chainName} chain set to ${mode} mode`);
}

export function getChainConfigs(): ChainConfig[] {return chainConfigs;}

export async function startTradingBot() {
    try {

        await startPriceService();
        const telegramBot = startTelegramClient();
        for (const chain of chainConfigs) {
            if (chain.enabled) {try {await chain.start(); console.log(`[Trading] Started ${chain.name} chain in ${chain.mode} mode`);} catch (error) {console.error(`Error starting ${chain.name} chain:`, error);}} 
            else {console.log(`[${chain.name}] chain is disabled`);}
        }
        console.log('[Trading] System fully operational!');
        process.on('SIGINT', () => {
            console.log('\n🛑 Received SIGINT, shutting down gracefully...');
            for (const chain of chainConfigs) {if (chain.enabled) {try {chain.stop(); console.log(`🛑 ${chain.name} chain stopped`);} catch (error) {console.error(`Error stopping ${chain.name} chain:`, error);}}}
            if (isPriceServiceRunning()) {try {stopPriceService(); console.log('🛑 Price service stopped');} catch (error) {console.error('Error stopping price service:', error);}} 
            if (telegramBot) {telegramBot.cleanup();}
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            console.log('\n🛑 Received SIGTERM, shutting down...');
            for (const chain of chainConfigs) {if (chain.enabled) {try {chain.stop(); console.log(`🛑 ${chain.name} chain stopped`);}  catch (error) {console.error(`Error stopping ${chain.name} chain:`, error);}}}
            if (isPriceServiceRunning()) {try {stopPriceService(); console.log('🛑 Price service stopped');} catch (error) {console.error('Error stopping price service:', error);}}
            if (telegramBot) {telegramBot.cleanup();}
            process.exit(0);
        });
    } 
    catch (error) {console.error('Error starting system:', error); process.exit(1);}
}