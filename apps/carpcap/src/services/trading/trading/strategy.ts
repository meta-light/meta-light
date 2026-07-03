import { Position, TokenData, TradingFees, TradeExecutionResult, MultiTimeframeAnalysis, Trade, TradingSignal, AggregatedSignal, MultiTokenRecommendation, TokenIndicatorScore, LogEntry, BlockedToken, TokenScore } from '../models/interfaces';
import { calculateOptimalPositionSize } from '../utils';
import { generateContinuousTokenScores, generateContinuousSignal } from './signals';
import { SolanaCoreValidatedTokens, EclipseCoreValidatedTokens } from '../config';

function isGasTokenOrStablecoin(ticker: string, network: 'SOLANA' | 'ECLIPSE'): boolean {
    const validatedTokens = network === 'SOLANA' ? SolanaCoreValidatedTokens : EclipseCoreValidatedTokens;
    const token = validatedTokens.find(t => t.ticker === ticker);
    return token ? (token.isGasToken || token.isStablecoin) : false;
}

export class PortfolioManager {
    private cashBalance: number;
    private positions: Map<string, Position> = new Map();
    private config: any;
    private totalFeesPaid: number = 0;
    private logger: {
        log: (message: string, token?: string, strategy?: string, data?: any) => void;
        logError: (message: string, token?: string, strategy?: string, data?: any) => void;
        logDebug: (message: string, token?: string, strategy?: string, data?: any) => void;
    };

    constructor(config: any, logger: {log: (message: string, token?: string, strategy?: string, data?: any) => void; logError: (message: string, token?: string, strategy?: string, data?: any) => void; logDebug: (message: string, token?: string, strategy?: string, data?: any) => void;}) {
        this.config = config;
        this.cashBalance = config.INITIAL_BALANCE;
        this.logger = logger;
    }

    getCashBalance(): number {return this.cashBalance;}
    getPosition(token: string): Position | undefined {return this.positions.get(token);}
    getAllPositions(): Map<string, Position> {return new Map(this.positions);}
    getTotalFeesPaid(): number {return this.totalFeesPaid;}

    getTotalPortfolioValue(tokenData: Map<string, TokenData>): number {
        let totalValue = this.cashBalance;
        for (const [token, position] of this.positions) {
            const tokenDataItem = tokenData.get(token);
            if (tokenDataItem && tokenDataItem.priceHistory.length > 0) {const currentPrice = tokenDataItem.priceHistory[tokenDataItem.priceHistory.length - 1]; totalValue += position.remainingAmount * currentPrice;}
        }
        return totalValue;
    }

    canExecuteTrade(tradeValue: number): boolean {return this.cashBalance >= tradeValue;}

    executeBuy(token: string, amount: number, price: number, fees: TradingFees): boolean {
        const totalCost = (amount * price) + fees.totalFees;
        if (this.cashBalance < totalCost) {this.logger.logError(`Insufficient funds for buy: need ${totalCost}, have ${this.cashBalance}`, token); return false;}
        this.cashBalance -= totalCost;
        this.totalFeesPaid += fees.totalFees;
        const existingPosition = this.positions.get(token);
        if (existingPosition) {
            const totalAmount = existingPosition.remainingAmount + amount;
            const totalCostBasis = (existingPosition.remainingAmount * existingPosition.averagePrice) + (amount * price);
            existingPosition.averagePrice = totalCostBasis / totalAmount;
            existingPosition.remainingAmount = totalAmount;
            existingPosition.amount = totalAmount;
        } 
        else {this.positions.set(token, {token, amount, averagePrice: price, entryTime: Date.now(), remainingAmount: amount, highestPrice: price, trailingStopPrice: price * (1 - this.config.TRAILING_STOP_DISTANCE), partialExits: [], strategyAllocations: new Map()});}
        this.logger.log(`Buy executed: ${amount} ${token} at $${price}`, token);
        return true;
    }

    executeSell(token: string, amount: number, price: number, fees: TradingFees): { success: boolean; pnl: number } {
        const position = this.positions.get(token);
        if (!position || position.remainingAmount < amount) {this.logger.logError(`Cannot sell: insufficient position or no position for ${token}`, token); return { success: false, pnl: 0 };}
        const sellValue = amount * price;
        const costBasis = amount * position.averagePrice;
        const pnl = sellValue - costBasis - fees.totalFees;
        this.cashBalance += sellValue - fees.totalFees;
        this.totalFeesPaid += fees.totalFees;
        position.remainingAmount -= amount;
        if (position.remainingAmount === 0) {this.positions.delete(token);}
        this.logger.log(`Sell executed: ${amount} ${token} at $${price}, PnL: $${pnl}`, token);
        return { success: true, pnl };
    }

    updateTrailingStops(tokenData: Map<string, TokenData>): Array<{token: string, price: number}> {
        const updates: Array<{token: string, price: number}> = [];
        for (const [token, position] of this.positions) {
            const tokenDataItem = tokenData.get(token);
            if (tokenDataItem && tokenDataItem.priceHistory.length > 0) {
                const currentPrice = tokenDataItem.priceHistory[tokenDataItem.priceHistory.length - 1];
                if (currentPrice > position.highestPrice) {
                    position.highestPrice = currentPrice;
                    const newTrailingStop = currentPrice * (1 - this.config.TRAILING_STOP_DISTANCE);
                    if (newTrailingStop > position.trailingStopPrice) {position.trailingStopPrice = newTrailingStop; updates.push({ token, price: newTrailingStop });}
                }
            }
        }
        return updates;
    }
}

export class TradingCore {
    private lastTradeTime: Map<string, number> = new Map();
    private portfolioManager: PortfolioManager;
    private config: any;
    private logQueue: LogEntry[] = [];
    private maxLogSize: number = 1000;
    constructor(config: any) {this.config = config; this.portfolioManager = new PortfolioManager(config, {log: this.log.bind(this), logError: this.logError.bind(this), logDebug: this.logDebug.bind(this)});}

    private addLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, token?: string, strategy?: string, data?: any): void {
        this.logQueue.push({ timestamp: Date.now(), level, message, token, strategy, data });
        if (this.logQueue.length > this.maxLogSize) {this.logQueue.shift();}
    }

    public log(message: string, token?: string, strategy?: string, data?: any): void {this.addLog('INFO', message, token, strategy, data);}
    public logWarning(message: string, token?: string, strategy?: string, data?: any): void {this.addLog('WARN', message, token, strategy, data);}
    public logError(message: string, token?: string, strategy?: string, data?: any): void {this.addLog('ERROR', message, token, strategy, data);}
    public logDebug(message: string, token?: string, strategy?: string, data?: any): void {this.addLog('DEBUG', message, token, strategy, data);}

    public getLogs(level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', token?: string, strategy?: string, limit?: number): LogEntry[] {
        let filteredLogs = this.logQueue;
        if (level) {filteredLogs = filteredLogs.filter(log => log.level === level);}
        if (token) {filteredLogs = filteredLogs.filter(log => log.token === token);}
        if (strategy) {filteredLogs = filteredLogs.filter(log => log.strategy === strategy);}
        if (limit) {filteredLogs = filteredLogs.slice(-limit);}
        return filteredLogs;
    }

    public clearLogs(): void {this.logQueue = [];}
    public getLogCount(): number {return this.logQueue.length;}

    public flushLogsToConsole(level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'): void {
        const logs = this.getLogs(level);
        logs.forEach(log => {
            const message = `[${new Date(log.timestamp).toISOString()}] ${log.level}: ${log.message}`;
            switch (log.level) {
                case 'ERROR': console.error(message, log.data || ''); break;
                case 'WARN': console.warn(message, log.data || '');
                case 'DEBUG': console.debug(message, log.data || '');
                default: console.log(message, log.data || '');
            }
        });
    }

    getPortfolioManager(): PortfolioManager {return this.portfolioManager;}

    hasSignificantPriceMovement(tokenData: TokenData): boolean {
        const lookbackPeriods = this.config.PRICE_MOVEMENT_LOOKBACK_PERIODS;
        const threshold = this.config.PRICE_MOVEMENT_THRESHOLD;
        if (tokenData.priceHistory.length < lookbackPeriods) return false;
        const recentPrices = tokenData.priceHistory.slice(-lookbackPeriods);
        const priceRange = Math.max(...recentPrices) - Math.min(...recentPrices);
        const avgPrice = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
        const movementPercent = (priceRange / avgPrice);
        return movementPercent > threshold;
    }

    isVolatilityAcceptable(tokenData: TokenData): boolean {
        if (tokenData.priceHistory.length < 20) return false;
        const recent20Prices = tokenData.priceHistory.slice(-20);
        const returns = [];
        for (let i = 1; i < recent20Prices.length; i++) {const returnPct = (recent20Prices[i] - recent20Prices[i-1]) / recent20Prices[i-1]; returns.push(Math.abs(returnPct));}
        const avgVolatility = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const volatilityThreshold = this.config.VOLATILITY_THRESHOLD || 0.25;
        return avgVolatility < volatilityThreshold;
    }

    analyzeMultiTimeframe(tokenData: TokenData): MultiTimeframeAnalysis {
        const shortTermTrend = this.getTrendDirection(tokenData.priceHistory.slice(-20));
        const mediumTermTrend = this.getTrendDirection(tokenData.priceHistory5m.slice(-10));
        const longTermTrend = this.getTrendDirection(tokenData.priceHistory15m.slice(-5));
        const alignment = shortTermTrend === mediumTermTrend && mediumTermTrend === longTermTrend;
        const confidence = alignment ? 0.9 : (shortTermTrend === mediumTermTrend || mediumTermTrend === longTermTrend) ? 0.6 : 0.3;
        return {shortTerm: shortTermTrend, mediumTerm: mediumTermTrend, longTerm: longTermTrend, alignment, confidence};
    }

    private getTrendDirection(prices: number[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
        if (prices.length < 3) return 'NEUTRAL';
        const start = prices[0];
        const end = prices[prices.length - 1];
        const change = (end - start) / start;
        if (change > 0.01) return 'BULLISH';
        if (change < -0.01) return 'BEARISH';
        return 'NEUTRAL';
    }

    calculateDynamicPositionSize(aggregatedSignal: AggregatedSignal, tokenData: TokenData, tradeValueUSD: number): number {
        let positionSize = this.config.BASE_POSITION_SIZE;
        const strengthMultiplier = 0.5 + (aggregatedSignal.strength * 1.0);
        positionSize *= strengthMultiplier;
        if (aggregatedSignal.metConfluence) {positionSize *= 1.2;}
        positionSize *= (0.8 + (aggregatedSignal.confidence * 0.4));
        if (tokenData.priceAnalysisHistory.length > 0) {
            const latestAnalysis = tokenData.priceAnalysisHistory[tokenData.priceAnalysisHistory.length - 1];
            positionSize = calculateOptimalPositionSize(positionSize, latestAnalysis, tradeValueUSD);
        }
        return Math.max(this.config.MIN_POSITION_SIZE, Math.min(this.config.MAX_POSITION_SIZE, positionSize));
    }

    calculateTradingFees(tradeValueUSD: number): TradingFees {
        const chainConfig = this.config.SOLANA || this.config.ECLIPSE;
        const baseTxFee = chainConfig.BASE_TRANSACTION_FEE;
        const priorityFeeRange = chainConfig.PRIORITY_FEE_RANGE;
        const dexSwapFeeRate = chainConfig.DEX_SWAP_FEE_RATE;
        const gasPriceUSD = chainConfig.GAS_PRICE_USD;
        const avgPriorityFeeUnits = (priorityFeeRange[0] + priorityFeeRange[1]) / 2;
        const gasUnits = baseTxFee + avgPriorityFeeUnits;
        const gasFeeUSD = gasUnits * gasPriceUSD;
        const swapFee = tradeValueUSD * dexSwapFeeRate;
        const totalFees = gasFeeUSD + swapFee;
        return { gasFee: gasFeeUSD, swapFee, totalFees };
    }

    isInCooldown(token: string): boolean {const lastTrade = this.lastTradeTime.get(token) || 0; return Date.now() - lastTrade < this.config.TRADE_COOLDOWN;}
    updateLastTradeTime(token: string): void {this.lastTradeTime.set(token, Date.now());}
    generateAggregatedSignalForStrategy(tokenData: TokenData): AggregatedSignal {
        const continuousSignal = generateContinuousSignal(tokenData, this.config);
        return {
            action: continuousSignal.score > 0.1 ? 'BUY' : continuousSignal.score < -0.1 ? 'SELL' : 'HOLD',
            confidence: continuousSignal.confidence,
            strength: continuousSignal.strength,
            indicatorResults: continuousSignal.indicatorResults,
            metConfluence: Math.abs(continuousSignal.score) > 0.1,
            requiredConfluence: 1,
            actualConfluence: continuousSignal.indicatorResults.filter(r => r.meetsThreshold).length,
            weightedScore: continuousSignal.score,
            riskAdjustedScore: continuousSignal.riskAdjustedScore,
            marketConditionFactor: continuousSignal.marketConditionFactor,
            temporalScore: continuousSignal.temporalScore
        };
    }
    
    generateMultiTokenRecommendationForStrategy(tokens: TokenData[], currentHolding?: TokenData): MultiTokenRecommendation {
        const tokenScores = generateContinuousTokenScores(tokens, this.config);
        const buyEligibleTokens = tokenScores.filter(score => score.score > 0.1);
        let recommendedAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let recommendedToken: any = undefined;
        let currentTokenShouldSell = false;
        if (currentHolding) {const currentTokenScore = tokenScores.find(score => score.ticker === currentHolding.ticker); if (currentTokenScore && currentTokenScore.score < -0.1) {currentTokenShouldSell = true; recommendedAction = 'SELL';}}
        if (!currentTokenShouldSell && buyEligibleTokens.length > 0) {recommendedAction = 'BUY'; recommendedToken = buyEligibleTokens[0];}
        return {
            recommendedAction,
            recommendedToken,
            currentTokenShouldSell,
            allTokenAnalyses: tokenScores.map(score => ({
                tokenData: { ticker: score.ticker, address: score.address } as TokenData,
                aggregatedSignal: this.generateAggregatedSignalForStrategy({ ticker: score.ticker, address: score.address } as TokenData),
                buyConfluence: score.indicatorResults.filter(r => r.signal.score > 0.1 && r.meetsThreshold).length,
                sellConfluence: score.indicatorResults.filter(r => r.signal.score < -0.1 && r.meetsThreshold).length,
                overallScore: score.score,
                weightedBuyScore: score.score > 0 ? score.score : 0,
                weightedSellScore: score.score < 0 ? Math.abs(score.score) : 0,
                riskAdjustedScore: score.score,
                liquidityScore: score.liquidityScore,
                volatilityPenalty: score.volatilityPenalty,
                marketCondition: score.marketCondition,
                finalRanking: score.finalRanking
            })),
            topCandidates: buyEligibleTokens.slice(0, 5).map(score => ({
                tokenData: { ticker: score.ticker, address: score.address } as TokenData,
                aggregatedSignal: this.generateAggregatedSignalForStrategy({ ticker: score.ticker, address: score.address } as TokenData),
                buyConfluence: score.indicatorResults.filter(r => r.signal.score > 0.1 && r.meetsThreshold).length,
                sellConfluence: score.indicatorResults.filter(r => r.signal.score < -0.1 && r.meetsThreshold).length,
                overallScore: score.score,
                weightedBuyScore: score.score > 0 ? score.score : 0,
                weightedSellScore: score.score < 0 ? Math.abs(score.score) : 0,
                riskAdjustedScore: score.score,
                liquidityScore: score.liquidityScore,
                volatilityPenalty: score.volatilityPenalty,
                marketCondition: score.marketCondition,
                finalRanking: score.finalRanking
            })),
            currentTokenAnalysis: undefined,
            confidenceLevel: 'MEDIUM',
            recommendedPositionSize: 0.1,
            expectedRisk: 0.1,
            alternativeTokens: buyEligibleTokens.slice(1, 4).map(score => ({
                tokenData: { ticker: score.ticker, address: score.address } as TokenData,
                aggregatedSignal: this.generateAggregatedSignalForStrategy({ ticker: score.ticker, address: score.address } as TokenData),
                buyConfluence: score.indicatorResults.filter(r => r.signal.score > 0.1 && r.meetsThreshold).length,
                sellConfluence: score.indicatorResults.filter(r => r.signal.score < -0.1 && r.meetsThreshold).length,
                overallScore: score.score,
                weightedBuyScore: score.score > 0 ? score.score : 0,
                weightedSellScore: score.score < 0 ? Math.abs(score.score) : 0,
                riskAdjustedScore: score.score,
                liquidityScore: score.liquidityScore,
                volatilityPenalty: score.volatilityPenalty,
                marketCondition: score.marketCondition,
                finalRanking: score.finalRanking
            }))
        };
    }

    enhanceSignalWithTimeframe(signal: TradingSignal, multiTimeframe: MultiTimeframeAnalysis): TradingSignal {
        const timeframeBonus = multiTimeframe.alignment ? 0.2 : 0;
        const enhancedStrength = Math.min(1, signal.strength + timeframeBonus);
        return {...signal, strength: enhancedStrength, timeframeAlignment: multiTimeframe.alignment, trendStrength: multiTimeframe.confidence};
    }

    shouldExecuteTrade(aggregatedSignal: AggregatedSignal, tokenData: TokenData): boolean {
        if (!aggregatedSignal || aggregatedSignal.action === 'HOLD') return false;
        if (aggregatedSignal.action === 'BUY' && this.isInCooldown(tokenData.ticker)) return false;
        if (!this.hasSignificantPriceMovement(tokenData)) return false;
        if (!this.isVolatilityAcceptable(tokenData)) return false;
        if (aggregatedSignal.action === 'BUY') {const tradeValueUSD = this.portfolioManager.getCashBalance() * this.config.BASE_POSITION_SIZE; const minTradeValue = this.config.MIN_TRADE_VALUE_USD; if (tradeValueUSD < minTradeValue) return false;}
        return true;
    }

    executeTradeLogic(token: string, aggregatedSignal: AggregatedSignal, tokenData: TokenData): TradeExecutionResult {
        const currentPrice = tokenData.priceHistory[tokenData.priceHistory.length - 1];
        if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {this.logError(`executeTradeLogic failed: Invalid price: ${currentPrice}`, token); return { executed: false, error: 'Invalid price' };}
        const timestamp = new Date();
        if (aggregatedSignal.action === 'BUY') {return this.executeBuyLogic(token, aggregatedSignal, tokenData, currentPrice, timestamp);} 
        else if (aggregatedSignal.action === 'SELL') {return this.executeSellLogic(token, aggregatedSignal, tokenData, currentPrice, timestamp);}
        else {this.logError(`executeTradeLogic failed: Unknown action ${aggregatedSignal.action}`, token); return { executed: false, error: 'Unknown action' };}
    }

    private executeBuyLogic(token: string, aggregatedSignal: AggregatedSignal, tokenData: TokenData, currentPrice: number, timestamp: Date): TradeExecutionResult {
        const tradeValueUSD = this.portfolioManager.getCashBalance() * this.config.BASE_POSITION_SIZE;
        const positionSize = this.calculateDynamicPositionSize(aggregatedSignal, tokenData, tradeValueUSD);
        const fees = this.calculateTradingFees(positionSize * currentPrice);
        if (!this.portfolioManager.canExecuteTrade(positionSize * currentPrice + fees.totalFees)) {return { executed: false, error: 'Insufficient funds' };}
        const success = this.portfolioManager.executeBuy(token, positionSize, currentPrice, fees);
        if (success) {
            this.updateLastTradeTime(token);
            const trade: Trade = {
                timestamp: timestamp.getTime(),
                strategy: 'Unified',
                token,
                action: 'BUY',
                amount: positionSize,
                price: currentPrice,
                reason: `Signal: ${aggregatedSignal.action} (confidence: ${aggregatedSignal.confidence.toFixed(2)}, strength: ${aggregatedSignal.strength.toFixed(2)})`,
                gasFee: fees.gasFee,
                swapFee: fees.swapFee,
                totalFees: fees.totalFees
            };
            this.log(`Buy executed: ${positionSize} ${token} at $${currentPrice}`, token);
            return { executed: true, trade };
        }
        return { executed: false, error: 'Buy execution failed' };
    }

    private executeSellLogic(token: string, aggregatedSignal: AggregatedSignal, tokenData: TokenData, currentPrice: number, timestamp: Date): TradeExecutionResult {
        const position = this.portfolioManager.getPosition(token);
        if (!position) {return { executed: false, error: 'No position found' };}
        const sellAmount = position.remainingAmount;
        const fees = this.calculateTradingFees(sellAmount * currentPrice);
        const sellResult = this.portfolioManager.executeSell(token, sellAmount, currentPrice, fees);
        if (sellResult.success) {
            const trade: Trade = {
                timestamp: timestamp.getTime(),
                strategy: 'Unified',
                token,
                action: 'SELL',
                amount: sellAmount,
                price: currentPrice,
                reason: `Signal: ${aggregatedSignal.action} (confidence: ${aggregatedSignal.confidence.toFixed(2)}, strength: ${aggregatedSignal.strength.toFixed(2)})`,
                gasFee: fees.gasFee,
                swapFee: fees.swapFee,
                totalFees: fees.totalFees,
                pnl: sellResult.pnl
            };
            this.log(`Sell executed: ${sellAmount} ${token} at $${currentPrice}, PnL: $${sellResult.pnl}`, token);
            return { executed: true, trade };
        }
        return { executed: false, error: 'Sell execution failed' };
    }

    checkProfitTakingLevels(token: string, currentPrice: number): Array<{amount: number, price: number, reason: string}> {
        const position = this.portfolioManager.getPosition(token);
        if (!position) return [];
        const partialSells: Array<{amount: number, price: number, reason: string}> = [];
        const profitPercentage = (currentPrice - position.averagePrice) / position.averagePrice;
        for (let i = 0; i < this.config.TAKE_PROFIT_LEVELS.length; i++) {
            const level = this.config.TAKE_PROFIT_LEVELS[i];
            const percentage = this.config.TAKE_PROFIT_PERCENTAGES[i];
            if (profitPercentage >= level && position.remainingAmount > 0) {const sellAmount = position.remainingAmount * percentage; partialSells.push({amount: sellAmount, price: currentPrice, reason: `Take profit at ${(level * 100).toFixed(1)}%`});}
        }
        return partialSells;
    }

    executePartialSell(token: string, amount: number, price: number, reason: string): Trade {
        const fees = this.calculateTradingFees(amount * price);
        const sellResult = this.portfolioManager.executeSell(token, amount, price, fees);
        if (!sellResult.success) {throw new Error(`Partial sell failed for ${token}`);}
        const trade: Trade = {
            timestamp: Date.now(),
            strategy: 'Unified',
            token,
            action: 'PARTIAL_SELL',
            amount,
            price,
            reason,
            gasFee: fees.gasFee,
            swapFee: fees.swapFee,
            totalFees: fees.totalFees
        };
        this.log(`Partial sell executed: ${amount} ${token} at $${price} - ${reason}`, token);
        return trade;
    }

    updateTrailingStops(tokenData: Map<string, TokenData>): Array<{token: string, signal: AggregatedSignal}> {
        const signals: Array<{token: string, signal: AggregatedSignal}> = [];
        const updates = this.portfolioManager.updateTrailingStops(tokenData);
        for (const update of updates) {
            const tokenDataItem = tokenData.get(update.token);
            if (tokenDataItem && tokenDataItem.priceHistory.length > 0) {
                const currentPrice = tokenDataItem.priceHistory[tokenDataItem.priceHistory.length - 1];
                if (currentPrice <= update.price) {
                    const signal: AggregatedSignal = {
                        action: 'SELL',
                        confidence: 0.9,
                        strength: 0.9,
                        indicatorResults: [],
                        metConfluence: true,
                        requiredConfluence: 1,
                        actualConfluence: 1,
                        weightedScore: 0.9,
                        riskAdjustedScore: 0.9,
                        marketConditionFactor: 1,
                        temporalScore: 0.9
                    };
                    signals.push({ token: update.token, signal });
                }
            }
        }
        return signals;
    }

    checkStopLossAndTakeProfit(token: string, currentPrice: number): AggregatedSignal | null {
        const position = this.portfolioManager.getPosition(token);
        if (!position) return null;
        const profitPercentage = (currentPrice - position.averagePrice) / position.averagePrice;
        if (profitPercentage <= -this.config.STOP_LOSS) {
            return {
                action: 'SELL',
                confidence: 0.9,
                strength: 0.9,
                indicatorResults: [],
                metConfluence: true,
                requiredConfluence: 1,
                actualConfluence: 1,
                weightedScore: 0.9,
                riskAdjustedScore: 0.9,
                marketConditionFactor: 1,
                temporalScore: 0.9
            };
        }
        return null;
    }

    public getAggregatedSignal(tokenData: TokenData): AggregatedSignal {return this.generateAggregatedSignalForStrategy(tokenData);}
    public getMultiTokenRecommendation(tokens: TokenData[], currentHolding?: TokenData): MultiTokenRecommendation {return this.generateMultiTokenRecommendationForStrategy(tokens, currentHolding);}

    public getEligibleTokensForTrading(tokenData: Map<string, TokenData>, blockedTokens?: BlockedToken[]): TokenData[] {
        const eligibleTokens: TokenData[] = [];
        for (const [ticker, data] of tokenData) {
            const network = this.config.SOLANA ? 'SOLANA' : 'ECLIPSE';
            if (isGasTokenOrStablecoin(ticker, network)) continue;
            if (data.priceHistory.length < 5) continue;
            const blockedToken = blockedTokens?.find(bt => bt.ticker === ticker || bt.address === data.address);
            if (blockedToken) continue;
            if (this.hasSignificantPriceMovement(data) && this.isVolatilityAcceptable(data)) {eligibleTokens.push(data);}
        }
        return eligibleTokens;
    }

    public analyzeAllTokenIndicators(tokenData: Map<string, TokenData>): TokenIndicatorScore[] {
        const tokensArray = Array.from(tokenData.values()).filter(token => {const network = this.config.SOLANA ? 'SOLANA' : 'ECLIPSE'; return !isGasTokenOrStablecoin(token.ticker, network);});
        const tokenScores = generateContinuousTokenScores(tokensArray, this.config);
        return tokenScores.map(score => ({
            ticker: score.ticker,
            address: score.address,
            totalIndicatorsSatisfied: score.indicatorResults.filter(r => r.meetsThreshold).length,
            buyIndicatorsSatisfied: score.indicatorResults.filter(r => r.signal.score > 0.1 && r.meetsThreshold).length,
            sellIndicatorsSatisfied: score.indicatorResults.filter(r => r.signal.score < -0.1 && r.meetsThreshold).length,
            totalIndicatorsEvaluated: score.indicatorResults.length,
            satisfactionRate: score.indicatorResults.length > 0 ? (score.indicatorResults.filter(r => r.meetsThreshold).length / score.indicatorResults.length) * 100 : 0,
            aggregatedSignal: this.generateAggregatedSignalForStrategy({ ticker: score.ticker, address: score.address } as TokenData)
        }));
    }

    public getContinuousTokenScores(tokenData: Map<string, TokenData>, blockedTokens?: BlockedToken[]): TokenScore[] {
        const tokensArray = Array.from(tokenData.values()).filter(token => {
            const network = this.config.SOLANA ? 'SOLANA' : 'ECLIPSE';
            if (isGasTokenOrStablecoin(token.ticker, network)) return false;
            if (blockedTokens?.some(bt => bt.ticker === token.ticker || bt.address === token.address)) return false;
            return true;
        });
        return generateContinuousTokenScores(tokensArray, this.config);
    }

    public getContinuousSignalForToken(tokenData: TokenData): any {return generateContinuousSignal(tokenData, this.config);}

    public shouldExecuteTradeFromScore(score: number, strength: number, confidence: number, tokenData: TokenData): boolean {
        const minScore = 0.1;
        const minStrength = this.config.MIN_SIGNAL_STRENGTH || 0.25;
        const minConfidence = this.config.MIN_SIGNAL_CONFIDENCE || 0.25;
        if (Math.abs(score) < minScore) return false;
        if (strength < minStrength) return false;
        if (confidence < minConfidence) return false;
        if (!this.hasSignificantPriceMovement(tokenData)) return false;
        if (!this.isVolatilityAcceptable(tokenData)) return false;
        if (score > 0 && this.isInCooldown(tokenData.ticker)) return false;
        if (score > 0) {
            const tradeValueUSD = this.portfolioManager.getCashBalance() * this.config.BASE_POSITION_SIZE;
            const minTradeValue = this.config.MIN_TRADE_VALUE_USD;
            if (tradeValueUSD < minTradeValue) return false;
        }
        return true;
    }
}