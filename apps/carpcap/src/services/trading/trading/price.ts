import { PublicKey } from '@solana/web3.js';
import { TradingDatabase } from '../utils/database';
import { TradingConfig, SolanaCoreValidatedTokens, EclipseCoreValidatedTokens } from '../config';
import { TokenData, PriceAnalysis, JupiterEnhancedPriceData, PriceServiceState } from '../models/interfaces';
import axios from 'axios';
import { SwapSDK } from '@deserialize/swap-sdk';

const DeserializeSDK = new SwapSDK();
export const solanaTokenData: Map<string, TokenData> = new Map();
export const eclipseTokenData: Map<string, TokenData> = new Map();
const solanaPriceDB = new TradingDatabase('SOLANA');
const eclipsePriceDB = new TradingDatabase('ECLIPSE');

export async function getPrices(tokenMints: PublicKey[], includeExtraInfo: boolean = true): Promise<{ [mint: string]: number } | null> {
    if (!tokenMints.length) {return {};}
    const ids = tokenMints.map(m => m.toString()).join(',');
    try {
      const params: any = { ids };
      if (includeExtraInfo) {params.showExtraInfo = true;}
      const response = await axios.get('https://lite-api.jup.ag/price/v3', { params });
      if (response.data) {
        const prices: { [mint: string]: number } = {};
        for (const mint of tokenMints) {
          const mintStr = mint.toString();
          if (response.data[mintStr] && response.data[mintStr].usdPrice !== undefined) {
            prices[mintStr] = parseFloat(response.data[mintStr].usdPrice);
          } 
          else if (Math.random() < 0.01) {console.log(`Price data not found for token ${mintStr}`);}
        }
        return prices;
      } 
      else {throw new Error('Price data not found in response');}
    } 
    catch (error: any) {console.error(`Error fetching price: ${error.message}`); return null;}
}

export async function getEnhancedPrices(tokenMints: PublicKey[]): Promise<{ [mint: string]: JupiterEnhancedPriceData } | null> {
  if (!tokenMints.length) {return {};}
  const ids = tokenMints.map(m => m.toString()).join(',');
  try {
    const response = await axios.get('https://lite-api.jup.ag/price/v3', {params: { ids, showExtraInfo: true }});
    if (response.data) {
      const enhancedPrices: { [mint: string]: JupiterEnhancedPriceData } = {};
      for (const mint of tokenMints) {
        const mintStr = mint.toString();
        if (response.data[mintStr]) {enhancedPrices[mintStr] = response.data[mintStr];} 
        else if (Math.random() < 0.01) {console.log(`Enhanced price data not found for token ${mintStr}`);}
      }
      return enhancedPrices;
    } 
    else {throw new Error('Enhanced price data not found in response');}
  } 
  catch (error: any) {console.error(`Error fetching enhanced prices: ${error.message}`); return null;}
}

export function analyzePriceData(priceData: JupiterEnhancedPriceData): PriceAnalysis {
    const price = parseFloat(priceData.price);
    const { extraInfo } = priceData;
    const buyPrice = parseFloat(extraInfo.quotedPrice?.buyPrice || '0');
    const sellPrice = parseFloat(extraInfo.quotedPrice?.sellPrice || '0');
    const bidAskSpread = buyPrice > 0 && sellPrice > 0 ? Math.abs(buyPrice - sellPrice) : 0;
    const spreadPercentage = price > 0 && bidAskSpread > 0 ? (bidAskSpread / price) * 100 : 0;
    const buyImpact10 = extraInfo.depth?.buyPriceImpactRatio?.depth?.['10'] || 0;
    const sellImpact10 = extraInfo.depth?.sellPriceImpactRatio?.depth?.['10'] || 0;
    const buyImpact100 = extraInfo.depth?.buyPriceImpactRatio?.depth?.['100'] || 0;
    const sellImpact100 = extraInfo.depth?.sellPriceImpactRatio?.depth?.['100'] || 0;
    const buyImpact1000 = extraInfo.depth?.buyPriceImpactRatio?.depth?.['1000'] || 0;
    const sellImpact1000 = extraInfo.depth?.sellPriceImpactRatio?.depth?.['1000'] || 0;
    const avgImpact10 = (buyImpact10 + sellImpact10) / 2;
    const liquidityScore = Math.max(0, Math.min(100, 100 - (avgImpact10 * 1000)));
    const currentTime = Date.now() / 1000;
    const lastBuyTime = extraInfo.lastSwappedPrice?.lastJupiterBuyAt || 0;
    const lastSellTime = extraInfo.lastSwappedPrice?.lastJupiterSellAt || 0;
    const lastSwapTime = Math.max(lastBuyTime, lastSellTime);
    const lastSwapAge = lastSwapTime > 0 ? currentTime - lastSwapTime : 0;
    const isStale = lastSwapAge > 30;
    const isLiquid = liquidityScore > 70 && spreadPercentage < 0.5 && !isStale;
    return {price, confidenceLevel: extraInfo.confidenceLevel || 'medium', bidAskSpread, spreadPercentage, liquidityScore, priceImpact10: avgImpact10, priceImpact100: (buyImpact100 + sellImpact100) / 2, priceImpact1000: (buyImpact1000 + sellImpact1000) / 2, isLiquid, isStale, lastSwapAge};
}

async function fetchWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isRetryable = error?.message?.includes('Bad Gateway') || 
                               error?.message?.includes('timeout') ||
                               error?.message?.includes('ECONNREFUSED') ||
                               error?.message?.includes('ETIMEDOUT');
            
            if (i < retries - 1 && isRetryable) {
                const delay = delayMs * Math.pow(backoffMultiplier, i);
                console.log(`[deserialize]: Retry ${i + 1}/${retries} after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else if (!isRetryable) {
                throw error;
            }
        }
    }
    throw lastError;
}

export async function getTokenPrices() {
    try {
        const prices = [];
        for (const token of EclipseCoreValidatedTokens) {
            try {
                const price = await fetchWithRetry(() => DeserializeSDK.tokenPrice(token.address));
                prices.push({token: token.address, price});
            } catch (error: any) {
                console.warn(`[deserialize]: Failed to fetch price for ${token.ticker} (${token.address}):`, error.message);
                // Continue with other tokens instead of failing completely
            }
        }
        if (prices.length === 0) {
            throw new Error('Failed to fetch prices for any tokens');
        }
        return prices;
    } 
    catch (error) {console.error('[deserialize]: Error fetching token prices:', error); throw error;}
}

export async function getJupiterTokenPrices() {
    try {
        const tokenMints = EclipseCoreValidatedTokens.map(token => new PublicKey(token.address));
        const priceData = await getPrices(tokenMints, false);
        
        if (!priceData) {
            throw new Error('Failed to fetch prices from Jupiter');
        }
        
        const prices = [];
        for (const token of EclipseCoreValidatedTokens) {
            const price = priceData[token.address];
            if (price && !isNaN(price) && price > 0) {
                prices.push({token: token.address, price});
            } else {
                console.warn(`[jupiter]: No price data for ${token.ticker} (${token.address})`);
            }
        }
        
        return prices;
    } 
    catch (error) {
        console.error('[jupiter]: Error fetching token prices:', error);
        throw error;
    }
}

export async function getHeliumTokenPrices(): Promise<{ [address: string]: number }> {
    try {
        // Helium token addresses on Solana
        const heliumTokens = {
            HNT: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
            MOBILE: 'mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6',
            IOT: 'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns'
        };
        
        const ids = Object.values(heliumTokens).join(',');
        const response = await axios.get('https://lite-api.jup.ag/price/v3', { params: { ids } });
        
        if (!response.data) {
            throw new Error('Failed to fetch Helium token prices from Jupiter');
        }
        
        const prices: { [address: string]: number } = {};
        for (const [ticker, address] of Object.entries(heliumTokens)) {
            if (response.data[address] && response.data[address].usdPrice !== undefined) {
                const price = parseFloat(response.data[address].usdPrice);
                prices[address] = price;
                console.log(`[jupiter]: ${ticker} = $${price.toFixed(6)}`);
            } else {
                console.warn(`[jupiter]: No price data for ${ticker} (${address})`);
            }
        }
        
        if (Object.keys(prices).length !== 3) {
            throw new Error(`Failed to fetch all Helium token prices. Got ${Object.keys(prices).length}/3`);
        }
        
        return prices;
    } 
    catch (error) {
        console.error('[jupiter]: Error fetching Helium token prices:', error);
        throw error;
    }
}

const state: PriceServiceState = {isRunning: false, priceWarningTracker: new Map(), PRICE_WARNING_COOLDOWN: 24 * 60 * 60 * 1000};

function log(message: string, chain?: 'SOLANA' | 'ECLIPSE') {const chainPrefix = chain ? `[${chain.toUpperCase()}]` : '[PRICE]'; console.log(`${chainPrefix} ${message}`);}

function initializeSolanaTokens(): void {
    for (const token of SolanaCoreValidatedTokens) {
        if (!solanaTokenData.has(token.ticker)) {
            solanaTokenData.set(token.ticker, {
                ticker: token.ticker,
                address: token.address,
                decimals: token.decimals,
                priceHistory: [],
                timestamps: [],
                priceHistory5m: [],
                priceHistory15m: [],
                priceHistory1h: [],
                timestamps5m: [],
                timestamps15m: [],
                timestamps1h: [],
                priceAnalysisHistory: [],
                liquidityScores: [],
                spreadHistory: [],
                confidenceHistory: [],
                lastEnhancedUpdate: 0
            });
        }
    }
}

async function initializeEclipseTokens(): Promise<void> {
    try {
        for (const token of EclipseCoreValidatedTokens) {
            if (!eclipseTokenData.has(token.ticker)) {
                eclipseTokenData.set(token.ticker, {
                    ticker: token.ticker,
                    address: token.address,
                    decimals: token.decimals,
                    priceHistory: [],
                    timestamps: [],
                    priceHistory5m: [],
                    priceHistory15m: [],
                    priceHistory1h: [],
                    timestamps5m: [],
                    timestamps15m: [],
                    timestamps1h: [],
                    priceAnalysisHistory: [],
                    liquidityScores: [],
                    spreadHistory: [],
                    confidenceHistory: [],
                    lastEnhancedUpdate: 0
                });
            }
        }
    } 
    catch (error) {log(`Error initializing Eclipse tokens: ${error}`, 'ECLIPSE');}
}

function updateMultiTimeframeData(tokenData: TokenData): void {
    const now = Date.now();
    const currentPrice = tokenData.priceHistory[tokenData.priceHistory.length - 1];
    if (tokenData.timestamps5m.length === 0 || now - tokenData.timestamps5m[tokenData.timestamps5m.length - 1] >= 5 * 60 * 1000) {
        tokenData.priceHistory5m.push(currentPrice);
        tokenData.timestamps5m.push(now);
        if (tokenData.priceHistory5m.length > 200) {tokenData.priceHistory5m.shift(); tokenData.timestamps5m.shift();}
    }
    if (tokenData.timestamps15m.length === 0 || now - tokenData.timestamps15m[tokenData.timestamps15m.length - 1] >= 15 * 60 * 1000) {
        tokenData.priceHistory15m.push(currentPrice);
        tokenData.timestamps15m.push(now);
        if (tokenData.priceHistory15m.length > 200) {tokenData.priceHistory15m.shift(); tokenData.timestamps15m.shift();}
    }
    if (tokenData.timestamps1h.length === 0 || now - tokenData.timestamps1h[tokenData.timestamps1h.length - 1] >= 60 * 60 * 1000) {
        tokenData.priceHistory1h.push(currentPrice);
        tokenData.timestamps1h.push(now);
        if (tokenData.priceHistory1h.length > 200) {tokenData.priceHistory1h.shift(); tokenData.timestamps1h.shift();}
    }
}

async function updateSolanaPrices(): Promise<void> {
    try {
        const tokensToUpdate = Array.from(solanaTokenData.keys()).filter(ticker => ticker !== 'USDC');
        if (tokensToUpdate.length === 0) return;
        const tokenAddresses = tokensToUpdate.map(ticker => {const tokenData = solanaTokenData.get(ticker); return new PublicKey(tokenData?.address || '');});
        const priceData = await getPrices(tokenAddresses, false);
        if (!priceData) {log('Failed to fetch Solana prices, retrying...', 'SOLANA'); return;}
        const shouldGetEnhancedData = Math.floor(Date.now() / TradingConfig.PRICE_UPDATE_INTERVAL) % 5 === 0;
        let enhancedPrices: { [mint: string]: JupiterEnhancedPriceData } | null = null;
        if (shouldGetEnhancedData) {enhancedPrices = await getEnhancedPrices(tokenAddresses);}
        const timestamp = new Date();
        const priceEntries = [];
        let updatedTokens = 0;
        let enhancedUpdates = 0;
        for (const [ticker, tokenData] of solanaTokenData) {
            const rawPrice = priceData[tokenData.address];
            if (rawPrice) {
                const price = Number(rawPrice);
                if (!isNaN(price) && price > 0) {
                    tokenData.priceHistory.push(price);
                    tokenData.timestamps.push(timestamp.getTime());
                    priceEntries.push({timestamp, token: ticker, address: tokenData.address, price, source: 'jupiter' as const});
                    if (enhancedPrices && enhancedPrices[tokenData.address]) {
                        const priceAnalysis = analyzePriceData(enhancedPrices[tokenData.address]);
                        tokenData.priceAnalysisHistory.push(priceAnalysis);
                        tokenData.liquidityScores.push(priceAnalysis.liquidityScore);
                        tokenData.spreadHistory.push(priceAnalysis.spreadPercentage);
                        tokenData.confidenceHistory.push(priceAnalysis.confidenceLevel);
                        tokenData.lastEnhancedUpdate = timestamp.getTime();
                        if (tokenData.priceAnalysisHistory.length > 100) {
                            tokenData.priceAnalysisHistory.shift();
                            tokenData.liquidityScores.shift();
                            tokenData.spreadHistory.shift();
                            tokenData.confidenceHistory.shift();
                        }
                        enhancedUpdates++;
                    }
                    updateMultiTimeframeData(tokenData);
                    updatedTokens++;
                } 
                else {if (tokenData.priceHistory.length < 3) {log(`Invalid price data for ${ticker}: ${rawPrice}`, 'SOLANA');}}
            } 
            else {
                if (tokenData.priceHistory.length < 3) {
                    const now = Date.now();
                    const lastWarning = state.priceWarningTracker.get(ticker) || 0;
                    if (now - lastWarning > state.PRICE_WARNING_COOLDOWN) {log(`No price data found for ${ticker} (${tokenData.address})`, 'SOLANA'); state.priceWarningTracker.set(ticker, now);}
                }
            }
        }
        if (priceEntries.length > 0) {
            await solanaPriceDB.logPrices(priceEntries);
            const shouldLog = Math.floor(Date.now() / TradingConfig.PRICE_UPDATE_INTERVAL) % 10 === 0;
            if (shouldLog) {log(`${updatedTokens}/${solanaTokenData.size} tokens updated${enhancedUpdates > 0 ? ` (${enhancedUpdates} enhanced)` : ''}`, 'SOLANA');}
        }
    } 
    catch (error) {log(`Error updating Solana prices: ${error}`, 'SOLANA');}
}

async function updateEclipsePrices(): Promise<void> {
    try {
        const priceData = await getTokenPrices();
        const priceMap = new Map(priceData.map((p: any) => [p.token, p.price]));
        const timestamp = new Date();
        const priceEntries = [];
        let updatedTokens = 0;
        for (const [ticker, tokenData] of eclipseTokenData) {
            const price = priceMap.get(tokenData.address);
            if (price && !isNaN(price) && price > 0) {
                tokenData.priceHistory.push(price);
                tokenData.timestamps.push(timestamp.getTime());
                priceEntries.push({timestamp, token: ticker, address: tokenData.address, price, source: 'manual' as const});
                updateMultiTimeframeData(tokenData);
                updatedTokens++;
            } 
            else {if (tokenData.priceHistory.length < 3) {log(`No price data found for ${ticker} (${tokenData.address})`, 'ECLIPSE');}}
        }
        if (priceEntries.length > 0) {
            await eclipsePriceDB.logPrices(priceEntries);
            const shouldLog = Math.floor(Date.now() / TradingConfig.PRICE_UPDATE_INTERVAL) % 10 === 0;
            if (shouldLog) {log(`${updatedTokens}/${eclipseTokenData.size} tokens updated`, 'ECLIPSE');}
        }
    } 
    catch (error) {log(`Error updating Eclipse prices: ${error}`, 'ECLIPSE');}
}

export async function startPriceService(): Promise<void> {
    if (state.isRunning) {log('Price service is already running'); return;}
    try {
        await solanaPriceDB.connect();
        await eclipsePriceDB.connect();
        initializeSolanaTokens();
        await initializeEclipseTokens();
        state.solanaInterval = setInterval(async () => {
            if (!state.isRunning) { if (state.solanaInterval) clearInterval(state.solanaInterval); return;}
            try {await updateSolanaPrices();} 
            catch (error) {log(`Error in Solana price update cycle: ${error}`, 'SOLANA');}
        }, TradingConfig.PRICE_UPDATE_INTERVAL);
        state.eclipseInterval = setInterval(async () => {
            if (!state.isRunning) {if (state.eclipseInterval) clearInterval(state.eclipseInterval); return;}
            try {await updateEclipsePrices();} 
            catch (error) {log(`Error in Eclipse price update cycle: ${error}`, 'ECLIPSE');}
        }, TradingConfig.PRICE_UPDATE_INTERVAL);
        state.isRunning = true;
        await Promise.all([updateSolanaPrices(), updateEclipsePrices()]);
        log(`Monitoring ${solanaTokenData.size} Solana tokens and ${eclipseTokenData.size} Eclipse tokens`);
    } 
    catch (error) {log(`Failed to start price service: ${error}`); throw error;}
}

export async function stopPriceService(): Promise<void> {
    if (!state.isRunning) {log('Price service is not running'); return;}
    state.isRunning = false;
    if (state.solanaInterval) {clearInterval(state.solanaInterval); state.solanaInterval = undefined;}
    if (state.eclipseInterval) {clearInterval(state.eclipseInterval); state.eclipseInterval = undefined;}
    try {await solanaPriceDB.disconnect(); await eclipsePriceDB.disconnect();} 
    catch (error) {log(`Error disconnecting databases: ${error}`);}
    log('Price service stopped');
}

export function isPriceServiceRunning(): boolean {return state.isRunning;}
export function getPriceServiceStatus() {return {isRunning: state.isRunning, solanaTokenCount: solanaTokenData.size, eclipseTokenCount: eclipseTokenData.size, lastWarningCount: state.priceWarningTracker.size};}
export function getSolanaTokenData(): Map<string, TokenData> {return solanaTokenData;}
export function getEclipseTokenData(): Map<string, TokenData> {return eclipseTokenData;}

export function addSolanaToken(token: {ticker: string, address: string, decimals: number}): void {
    if (!solanaTokenData.has(token.ticker)) {
        solanaTokenData.set(token.ticker, {
            ticker: token.ticker,
            address: token.address,
            decimals: token.decimals,
            priceHistory: [],
            timestamps: [],
            priceHistory5m: [],
            priceHistory15m: [],
            priceHistory1h: [],
            timestamps5m: [],
            timestamps15m: [],
            timestamps1h: [],
            priceAnalysisHistory: [],
            liquidityScores: [],
            spreadHistory: [],
            confidenceHistory: [],
            lastEnhancedUpdate: 0
        });
    }
}

export function addEclipseToken(token: {ticker: string, address: string, decimals: number}): void {
    if (!eclipseTokenData.has(token.ticker)) {
        eclipseTokenData.set(token.ticker, {
            ticker: token.ticker,
            address: token.address,
            decimals: token.decimals,
            priceHistory: [],
            timestamps: [],
            priceHistory5m: [],
            priceHistory15m: [],
            priceHistory1h: [],
            timestamps5m: [],
            timestamps15m: [],
            timestamps1h: [],
            priceAnalysisHistory: [],
            liquidityScores: [],
            spreadHistory: [],
            confidenceHistory: [],
            lastEnhancedUpdate: 0
        });
    }
} 