import { eclipseTradingDB, solanaTradingDB } from '../utils/database';
import { TradingConfig } from '../config';
import { TradingCore, PortfolioManager } from './strategy';
import { TokenData, Position, TokenIndicatorScore, ExecutionLayer, AggregatedSignal, TokenScore } from '../models/interfaces';
import { getEclipseTokenData, addEclipseToken, getSolanaTokenData, addSolanaToken } from './price';
import { EclipseCoreValidatedTokens, SolanaCoreValidatedTokens } from '../config';

class PaperExecutionLayer implements ExecutionLayer {
    protected portfolioManager: PortfolioManager;
    protected tradingCore: TradingCore;
    protected tokenData: Map<string, TokenData>;
    protected sessionId: string;
    protected queueLog: (message: string) => void;
    protected logTradeToDB: (params: any) => Promise<void>;

    constructor(tradingCore: TradingCore, tokenData: Map<string, TokenData>, sessionId: string, queueLog: (message: string) => void, logTradeToDB: (params: any) => Promise<void>) {
        this.tradingCore = tradingCore;
        this.tokenData = tokenData;
        this.sessionId = sessionId;
        this.queueLog = queueLog;
        this.portfolioManager = tradingCore.getPortfolioManager();
        this.logTradeToDB = logTradeToDB;
    }

    async initialize(): Promise<void> {}
    async updateBalances(): Promise<void> {}

    async executeBuy(token: string, signal: AggregatedSignal, currentPrice: number): Promise<boolean> {
        const tokenData = this.tokenData.get(token)!;
        const result = this.tradingCore.executeTradeLogic(token, signal, tokenData);
        if (result.executed && result.trade) {
            const trade = result.trade;
            await this.logTrade({token, action: 'BUY', trade, signal, currentPrice});
            this.queueLog(`🟢 BUY ${trade.amount.toFixed(4)} ${token} at $${currentPrice.toFixed(6)} - Signal: ${signal.action} (confidence: ${signal.confidence.toFixed(2)})`);
            return true;
        }
        return false;
    }

    async executeSell(token: string, signal: AggregatedSignal, currentPrice: number): Promise<boolean> {
        const tokenData = this.tokenData.get(token)!;
        const result = this.tradingCore.executeTradeLogic(token, signal, tokenData);
        if (result.executed && result.trade) {
            const trade = result.trade;
            await this.logTrade({token, action: 'SELL', trade, signal, currentPrice});
            this.queueLog(`🔴 SELL ${trade.amount.toFixed(4)} ${token} at $${currentPrice.toFixed(6)} - Signal: ${signal.action} (confidence: ${signal.confidence.toFixed(2)})`);
            return true;
        }
        return false;
    }

    getPerformanceMetrics(): any {
        return {
            totalPortfolioValue: this.portfolioManager.getTotalPortfolioValue(this.tokenData),
            cashBalance: this.portfolioManager.getCashBalance(),
            totalFeesPaid: this.portfolioManager.getTotalFeesPaid(),
            positions: Array.from(this.portfolioManager.getAllPositions().entries()).map(([token, position]) => ({
                token,
                amount: position.amount,
                averagePrice: position.averagePrice,
                unrealizedPnL: this.calculateUnrealizedPnL(position, token)
            })),
            mode: 'PAPER'
        };
    }

    getTotalPortfolioValue(): number {return this.portfolioManager.getTotalPortfolioValue(this.tokenData);}
    getPositions(): Map<string, any> {return this.portfolioManager.getAllPositions();}

    private calculateUnrealizedPnL(position: Position, token: string): number {
        const tokenData = this.tokenData.get(token);
        if (!tokenData || tokenData.priceHistory.length === 0) return 0;
        const currentPrice = tokenData.priceHistory[tokenData.priceHistory.length - 1];
        const currentValue = position.remainingAmount * currentPrice;
        const costBasis = position.remainingAmount * position.averagePrice;
        return currentValue - costBasis;
    }

    async logTrade(params: any): Promise<void> {await this.logTradeToDB(params);}
}

abstract class SharedPaperTradingBot {
    protected tradingCore: TradingCore;
    protected executionLayer!: PaperExecutionLayer;
    protected mode: 'PAPER';
    protected isRunning = false;
    protected sessionId: string = '';
    protected tradingInterval?: NodeJS.Timeout;
    protected tokenRefreshInterval?: NodeJS.Timeout;
    protected logQueue: string[] = [];
    protected isLogging = false;
    protected lastPriceUpdate = 0;
    protected sessionStartTime: number = 0;
    protected sessionTradeCount: number = 0;
    protected lastTradeDate: string = '';
    constructor(signalConfig: any, tradingCoreConfig: any) {this.mode = 'PAPER'; this.tradingCore = new TradingCore(tradingCoreConfig);}
    protected abstract getTokenData(): Map<string, TokenData>;
    protected abstract loadTokenList(): Promise<void>;
    protected abstract cleanupInvalidTokens(): void;
    protected abstract checkForFreshPrices(): Promise<boolean>;
    protected abstract logTradeToDB(params: any): Promise<void>;
    protected abstract getBlockedTokens(): any[];
    protected abstract getAvailableTokensCount(): number;
    protected abstract getTokenListForSession(): string[];
    protected abstract getTradingDB(): any;
    protected abstract getConfig(): any;
    protected abstract getNetworkName(): string;
    protected initializeExecutionLayer(): void {this.executionLayer = new PaperExecutionLayer(this.tradingCore, this.getTokenData(), this.sessionId, this.queueLog.bind(this), this.logTradeToDB.bind(this));}

    protected async processLogQueue(): Promise<void> {
        if (this.isLogging || this.logQueue.length === 0) return;
        this.isLogging = true;
        while (this.logQueue.length > 0) {const message = this.logQueue.shift(); if (message) {console.log(message); await new Promise(resolve => setTimeout(resolve, 1));}}
        this.isLogging = false;
    }

    protected queueLog(message: string): void {this.logQueue.push(`[${this.getNetworkName()}-${this.mode.toUpperCase()}] ${message}`); setTimeout(() => this.processLogQueue(), 10);}
    protected canExecuteTrade(): boolean {const today = new Date().toDateString(); if (this.lastTradeDate !== today) {this.lastTradeDate = today;} return true;}

    protected async executeTrade(token: string, signal: AggregatedSignal): Promise<void> {
        if (!this.canExecuteTrade()) {return;}
        const tokenData = this.getTokenData().get(token);
        if (!tokenData) {this.queueLog(`No token data found for ${token}`); return;}
        const currentPrice = tokenData.priceHistory[tokenData.priceHistory.length - 1];
        if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {this.queueLog(`Invalid price for ${token}: ${currentPrice}`); return;}
        try {
            if (signal.action === 'BUY') {
                const executed = await this.executionLayer.executeBuy(token, signal, currentPrice);
                if (executed) {this.queueLog(`BUY executed for ${token} with ${signal.confidence.toFixed(2)} confidence (${this.sessionTradeCount} trades this session)`);}
            } 
            else if (signal.action === 'SELL') {
                const executed = await this.executionLayer.executeSell(token, signal, currentPrice);
                if (executed) {this.queueLog(`SELL executed for ${token} with ${signal.confidence.toFixed(2)} confidence (${this.sessionTradeCount} trades this session)`);}
            }
        } 
        catch (error) {this.queueLog(`Trade execution error for ${token}: ${error}`);}
    }

    protected async checkProfitTakingLevels(token: string): Promise<void> {
        const tokenData = this.getTokenData().get(token);
        if (!tokenData) return;
        const currentPrice = tokenData.priceHistory[tokenData.priceHistory.length - 1];
        const partialSells = this.tradingCore.checkProfitTakingLevels(token, currentPrice);
        for (const partialSell of partialSells) {
            const trade = this.tradingCore.executePartialSell(token, partialSell.amount, partialSell.price, partialSell.reason);
            const tradeId = `${token}_${trade.timestamp}_PARTIAL`;
            const portfolioManager = this.tradingCore.getPortfolioManager();
            const position = portfolioManager.getPosition(token);
            const profit = (partialSell.amount * partialSell.price) - (partialSell.amount * (position?.averagePrice || partialSell.price));
            await this.getTradingDB().logTrade({
                trade_id: tradeId,
                token,
                action: 'CLOSE',
                side: 'SELL',
                amount: partialSell.amount,
                price: partialSell.price,
                timestamp: new Date(trade.timestamp),
                reason: partialSell.reason,
                pnl: profit,
                session_id: this.sessionId,
                portfolio_value_before: this.executionLayer.getTotalPortfolioValue(),
                portfolio_value_after: this.executionLayer.getTotalPortfolioValue()
            });
            this.sessionTradeCount++;
            this.queueLog(`PARTIAL SELL ${partialSell.amount.toFixed(4)} ${token} at $${partialSell.price.toFixed(6)} - ${partialSell.reason} (${this.sessionTradeCount} trades this session)`);
        }
    }

    protected async checkAllStopLossAndTakeProfit(): Promise<void> {
        const tokenData = this.getTokenData();
        for (const [token, data] of tokenData) {
            const currentPrice = data.priceHistory[data.priceHistory.length - 1];
            if (!currentPrice) continue;
            const stopLossSignal = this.tradingCore.checkStopLossAndTakeProfit(token, currentPrice);
            if (stopLossSignal) {await this.executeTrade(token, stopLossSignal);}
            const trailingStopSignals = this.tradingCore.updateTrailingStops(tokenData);
            for (const trailingStop of trailingStopSignals) {if (trailingStop.token === token) {await this.executeTrade(token, trailingStop.signal);}}
            await this.checkProfitTakingLevels(token);
        }
    }

    protected async runTradingCycle(): Promise<void> {
        if (!this.isRunning) return;
        try {
            const hasFreshPrices = await this.checkForFreshPrices();
            if (!hasFreshPrices) {this.queueLog('Waiting for fresh price data from price service...'); return;}
            const tokenData = this.getTokenData();
            const tokenScores = this.tradingCore.getContinuousTokenScores(tokenData, this.getBlockedTokens());
            for (const tokenScore of tokenScores) {
                const token = tokenScore.ticker;
                const data = tokenData.get(token);
                if (!data) continue;
                if (data.priceHistory.length < 5) continue;
                const blockedToken = this.getBlockedTokens().find((bt: any) => bt.ticker === token || bt.address === data.address);
                if (blockedToken) continue;
                if (this.tradingCore.shouldExecuteTradeFromScore(tokenScore.score, tokenScore.strength, tokenScore.confidence, data)) {
                    const action: 'BUY' | 'SELL' = tokenScore.score > 0 ? 'BUY' : 'SELL';
                    const aggregatedSignal = {
                        action,
                        confidence: tokenScore.confidence,
                        strength: tokenScore.strength,
                        indicatorResults: tokenScore.indicatorResults,
                        metConfluence: true,
                        requiredConfluence: 1,
                        actualConfluence: 1,
                        weightedScore: tokenScore.score,
                        riskAdjustedScore: tokenScore.score,
                        marketConditionFactor: 1,
                        temporalScore: 0
                    };
                    await this.executeTrade(token, aggregatedSignal);
                }
            }
            await this.checkAllStopLossAndTakeProfit();
        } 
        catch (error) {this.queueLog(`Error in trading cycle: ${error}`);}
    }

    public async start(): Promise<void> {
        if (this.isRunning) {this.queueLog('Trading bot is already running'); return;}
        this.isRunning = true;
        this.sessionId = `${this.getNetworkName().toLowerCase()}-${this.mode.toLowerCase()}-${Date.now()}`;
        this.sessionStartTime = Date.now();
        this.sessionTradeCount = 0;
        this.lastTradeDate = new Date().toDateString();
        this.initializeExecutionLayer();
        this.queueLog(`Starting ${this.getNetworkName()} ${this.mode} trading bot with optimized signal thresholds...`);
        try {await this.getTradingDB().connect();} 
        catch (error) {console.error('Failed to connect to database:', error); this.isRunning = false; return;}
        await this.loadTokenList();
        if (this.getAvailableTokensCount() === 0) {this.queueLog('No tokens available for trading. Stopping bot.'); this.isRunning = false; return;}
        await this.executionLayer.initialize();
        let initialBalance = this.executionLayer.getTotalPortfolioValue();
        if (typeof initialBalance !== 'number' || isNaN(initialBalance)) {this.queueLog('Warning: initial_balance is not a valid number, defaulting to 0'); initialBalance = 0;}
        await this.getTradingDB().createSession({
            session_id: this.sessionId,
            start_time: new Date(),
            initial_balance: initialBalance,
            total_trades: 0,
            profitable_trades: 0,
            total_pnl: 0,
            max_drawdown: 0,
            strategies_tested: ['Unified'],
            tokens_traded: this.getTokenListForSession(),
            status: 'active',
            session_notes: `${this.getNetworkName().toUpperCase()} ${this.mode.toUpperCase()} TRADING SESSION`,
            market_conditions: {overall_sentiment: 'NEUTRAL', volatility_level: 'MEDIUM', major_events: [`${this.getNetworkName().toUpperCase()}_${this.mode.toUpperCase()}_TRADING_ENABLED`]}
        });
        this.tradingInterval = setInterval(async () => {
            if (!this.isRunning) {if (this.tradingInterval) clearInterval(this.tradingInterval); return;}
            try {await this.runTradingCycle();} 
            catch (error) {this.queueLog(`Error in trading cycle: ${error}`);}
        }, this.getConfig().TRADING_INTERVAL);
        this.tokenRefreshInterval = setInterval(async () => {
            if (!this.isRunning) {if (this.tokenRefreshInterval) clearInterval(this.tokenRefreshInterval); return;}
            try {await this.loadTokenList();} 
            catch (error) {this.queueLog(`Error refreshing token list: ${error}`);}
        }, this.getConfig().TOKEN_REFRESH_INTERVAL);
        this.queueLog(`${this.getNetworkName()} ${this.mode} trading bot started with ${this.getAvailableTokensCount()} tokens`);
        setTimeout(() => this.runTradingCycle(), 5000);
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) {this.queueLog('Trading bot is not running'); return;}
        this.isRunning = false;
        if (this.tradingInterval) {clearInterval(this.tradingInterval); this.tradingInterval = undefined;}
        if (this.tokenRefreshInterval) {clearInterval(this.tokenRefreshInterval); this.tokenRefreshInterval = undefined;}
        this.queueLog('Trading bot stopped');
        if (this.sessionId) {
            await this.executionLayer.updateBalances();
            await this.getTradingDB().updateSession(this.sessionId, {end_time: new Date(), final_balance: this.executionLayer.getTotalPortfolioValue(), status: 'completed'});
        }
        await this.getTradingDB().disconnect();
        const finalPerformance = this.getPerformance();
        if (finalPerformance) {this.queueLog(`Final Performance: $${finalPerformance.totalPortfolioValue.toFixed(2)}`); this.queueLog(`Total Trades: ${finalPerformance.totalTrades || 0}`);}
    }

    public getPerformance(): any {
        if (!this.isRunning) {return null;}
        const executionMetrics = this.executionLayer.getPerformanceMetrics();
        const config = this.getConfig();
        const totalTrades = this.getTradeCount();
        const initialBalance = config.INITIAL_PAPER_BALANCE;
        const pnl = executionMetrics.totalPortfolioValue - initialBalance;
        const totalReturn = initialBalance > 0 ? pnl / initialBalance : 0;
        return {...executionMetrics, totalReturn, totalTrades, network: this.getConfig().NETWORK, sessionId: this.sessionId};
    }

    private getTradeCount(): number {try {return this.sessionTradeCount || 0;} catch (error) {console.log(`Error getting trade count: ${error}`); return 0;}}
    public getTokenIndicatorAnalysis(): TokenIndicatorScore[] {if (!this.isRunning) return []; return this.tradingCore.analyzeAllTokenIndicators(this.getTokenData());}
    public getContinuousTokenScores(): TokenScore[] {if (!this.isRunning) return []; return this.tradingCore.getContinuousTokenScores(this.getTokenData(), this.getBlockedTokens());}
}

class NetworkPaperTradingBot extends SharedPaperTradingBot {
    private availableTokens: any[] = [];
    private networkConfig: any;
    private validatedTokens: any[];
    private tradingDB: any;
    private networkName: string;
    private addTokenFunction: (token: any) => void;

    constructor(networkConfig: any, validatedTokens: any[], tradingDB: any, networkName: string, addTokenFunction: (token: any) => void) {
        super(networkConfig.SIGNAL_CONFIG, {...TradingConfig, ...networkConfig, INITIAL_BALANCE: TradingConfig.INITIAL_PAPER_BALANCE, BASE_TRANSACTION_FEE: networkConfig.BASE_TRANSACTION_FEE, GAS_PRICE_USD: networkConfig.GAS_PRICE_USD, NETWORK: networkName});
        this.networkConfig = networkConfig;
        this.validatedTokens = validatedTokens;
        this.tradingDB = tradingDB;
        this.networkName = networkName;
        this.addTokenFunction = addTokenFunction;
    }

    protected getTokenData(): Map<string, TokenData> {return this.networkName === 'ECLIPSE' ? getEclipseTokenData() : getSolanaTokenData();}

    protected async loadTokenList(): Promise<void> {
        const tradingTokens = this.validatedTokens.filter(token => !token.isGasToken && !token.isStablecoin);
        this.availableTokens = tradingTokens.map(token => ({address: token.address, symbol: token.ticker, name: token.ticker, decimals: token.decimals, verified: true}));
        this.availableTokens.forEach(token => {this.addTokenFunction({ticker: token.symbol, address: token.address, decimals: token.decimals});});
        setTimeout(() => this.cleanupInvalidTokens(), 5 * 60 * 1000);
    }

    protected cleanupInvalidTokens(): void {
        const tokensToRemove: string[] = [];
        const tokenData = this.getTokenData();
        for (const [ticker, data] of tokenData) {if (data.priceHistory.length === 0) {tokensToRemove.push(ticker);}}
        if (tokensToRemove.length > 0) {tokensToRemove.forEach(ticker => {const index = this.availableTokens.findIndex(token => token.symbol === ticker); if (index !== -1) {this.availableTokens.splice(index, 1);}});}
    }

    protected async checkForFreshPrices(): Promise<boolean> {
        try {
            const tokenTickers = this.validatedTokens.map((t: any) => t.ticker);
            const latestPrices = await this.tradingDB.getLatestPrices(tokenTickers);
            let hasNewPrices = false;
            for (const [ticker, priceEntry] of Object.entries(latestPrices)) {if (priceEntry && (priceEntry as any).timestamp && (priceEntry as any).timestamp.getTime() > this.lastPriceUpdate) {hasNewPrices = true; break;}}
            if (hasNewPrices) {this.lastPriceUpdate = Date.now(); return true;}
            return false;
        } 
        catch (error) {this.queueLog(`Error checking for fresh prices: ${error}`); return false;}
    }

    protected async logTradeToDB(params: any): Promise<void> {
        const { token, action, trade, signal, currentPrice } = params;
        const timestamp = new Date(trade.timestamp);
        const tradeId = `${token}_${timestamp.getTime()}${action === 'SELL' ? '_CLOSE' : ''}`;
        const portfolioValueBefore = this.executionLayer.getTotalPortfolioValue();
        await this.tradingDB.logTrade({
            trade_id: tradeId,
            token,
            action: action === 'BUY' ? 'OPEN' : 'CLOSE',
            side: action,
            amount: trade.amount,
            price: currentPrice,
            timestamp,
            reason: `Signal: ${signal.action} (confidence: ${signal.confidence.toFixed(2)}, strength: ${signal.strength.toFixed(2)})`,
            position_size: trade.amount,
            average_entry_price: currentPrice,
            session_id: this.sessionId,
            portfolio_value_before: portfolioValueBefore,
            portfolio_value_after: this.executionLayer.getTotalPortfolioValue(),
            pnl: trade.pnl
        });
        this.sessionTradeCount++;
    }

    protected getBlockedTokens() {return this.validatedTokens.filter(token => token.isGasToken || token.isStablecoin).map(token => ({ticker: token.ticker, address: token.address, isGasToken: token.isGasToken, isStablecoin: token.isStablecoin}));}
    protected getGasTokenAddress(): string {const gasToken = this.validatedTokens.find(token => token.isGasToken); return gasToken?.address || '';}
    protected getUsdcTokenAddress(): string {const usdcToken = this.validatedTokens.find(token => token.isStablecoin && token.ticker === 'USDC'); return usdcToken?.address || '';}
    protected getAvailableTokensCount() { return this.availableTokens.length; }
    protected getTokenListForSession() { return this.availableTokens.map(t => t.symbol); }
    protected getTradingDB() { return this.tradingDB; }
    protected getConfig() { return {...TradingConfig, ...this.networkConfig, NETWORK: this.networkName}; }
    protected getNetworkName() { return this.networkName; }
}

class EclipsePaperTradingBot extends NetworkPaperTradingBot {constructor() {super(TradingConfig.ECLIPSE, EclipseCoreValidatedTokens, eclipseTradingDB, 'ECLIPSE', addEclipseToken);}}
class SolanaPaperTradingBot extends NetworkPaperTradingBot {constructor() {super(TradingConfig.SOLANA, SolanaCoreValidatedTokens, solanaTradingDB, 'SOLANA', addSolanaToken);}}
export const eclipsePaperBot = new EclipsePaperTradingBot();
export const solanaPaperBot = new SolanaPaperTradingBot();
export async function startEclipsePaperTrading() {await eclipsePaperBot.start();}
export async function startSolanaPaperTrading() {await solanaPaperBot.start();}
export function stopEclipsePaperTrading() {eclipsePaperBot.stop();}
export function stopSolanaPaperTrading() {solanaPaperBot.stop();}
export function getEclipsePaperTradingPerformance() {return eclipsePaperBot.getPerformance();}
export function getSolanaPaperTradingPerformance() {return solanaPaperBot.getPerformance();}
export function getEclipsePaperTokenAnalysis() {return eclipsePaperBot.getTokenIndicatorAnalysis();}
export function getSolanaPaperTokenAnalysis() {return solanaPaperBot.getTokenIndicatorAnalysis();} 
export function getEclipsePaperContinuousScores() {return eclipsePaperBot.getContinuousTokenScores();}
export function getSolanaPaperContinuousScores() {return solanaPaperBot.getContinuousTokenScores();} 