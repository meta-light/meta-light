export interface TradingConfig {
    INITIAL_PAPER_BALANCE: number;
    PRICE_UPDATE_INTERVAL: number;
    TRADING_INTERVAL: number;
    DEX_SWAP_FEE_RATE: number;
    TRAILING_STOP_DISTANCE: number;
    MIN_SIGNAL_CONFLUENCE: number;
    BASE_POSITION_SIZE: number;
    MIN_POSITION_SIZE: number;
    MAX_POSITION_SIZE: number;
    BASE_TRANSACTION_FEE: number;
    GAS_PRICE_USD: number;
    PRIORITY_FEE_RANGE: [number, number];
    TRADE_COOLDOWN: number;
    MULTI_TIMEFRAME_FILTER: boolean;
    MIN_TRADE_VALUE_USD: number;
    TAKE_PROFIT_LEVELS: number[];
    TAKE_PROFIT_PERCENTAGES: number[];
    ENABLE_TRAILING_STOPS: boolean;
    STOP_LOSS: number;
    TOKEN_REFRESH_INTERVAL: number;
    MAX_TOKENS: number;
    MIN_BUY_CONFLUENCE: number;
    MIN_SELL_CONFLUENCE: number;
    MARKET_CONDITION_MULTIPLIERS: { trending: number; sideways: number; volatile: number; };
    RISK_ADJUSTMENT: { volatilityPenalty: number; liquidityBonus: number; confidenceMultiplier: number; };
    TEMPORAL_WEIGHTING: { recentSignalBonus: number; timeframeAlignment: number; momentumDecay: number; };
    POSITION_MANAGEMENT: { switchingThreshold: number; holdingBonus: number; maxPositionRisk: number; };
    PERFORMANCE_TRACKING: { enableAdaptiveWeights: boolean; performanceWindow: number; minPerformanceSample: number; };
    SIGNAL_CONFIG: { name: string; signal_threshold: number; signal_weight: number; enabled: boolean; }[];
    PRICE_MOVEMENT_THRESHOLD?: number;
    PRICE_MOVEMENT_LOOKBACK_PERIODS?: number;
}

export interface TokenData {
    ticker: string; 
    address: string; 
    decimals: number; 
    priceHistory: number[]; 
    timestamps: number[];
    priceHistory5m: number[];
    priceHistory15m: number[];
    priceHistory1h: number[];
    timestamps5m: number[];
    timestamps15m: number[];
    timestamps1h: number[];
    priceAnalysisHistory: PriceAnalysis[];
    liquidityScores: number[];
    spreadHistory: number[];
    confidenceHistory: ('high' | 'medium' | 'low')[];
    lastEnhancedUpdate: number;
}

export interface Position {
    token: string; 
    amount: number; 
    averagePrice: number; 
    entryTime: number;
    remainingAmount: number;
    highestPrice: number;
    trailingStopPrice: number;
    partialExits: Array<{amount: number; price: number; timestamp: number}>;
    strategyAllocations: Map<string, number>;
}

export interface Trade {
    timestamp: number; 
    strategy: string; 
    token: string; 
    action: 'BUY' | 'SELL' | 'PARTIAL_SELL'; 
    amount: number; 
    price: number; 
    reason: string;
    gasFee: number;
    swapFee: number;
    totalFees: number;
    pnl?: number;
}

export interface StrategyPerformance {
    name: string; 
    totalTrades: number; 
    successfulTrades: number; 
    totalReturn: number; 
    contributedValue: number; 
    maxDrawdown: number; 
    sharpeRatio: number; 
    trades: Trade[]; 
    recentPerformance: number[];
    volatilityAdjustment: number;
    totalFeesPaid: number;
    averageFeePerTrade: number;
    allocatedCapital: number;
    realizedPnL: number;
    unrealizedPnL: number;
}

export interface MultiTimeframeAnalysis {
    shortTerm: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    mediumTerm: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    longTerm: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    alignment: boolean;
    confidence: number;
}

export interface PriceAnalysis {
    price: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    bidAskSpread: number;
    spreadPercentage: number;
    liquidityScore: number;
    priceImpact10: number;
    priceImpact100: number;
    priceImpact1000: number;
    isLiquid: boolean;
    isStale: boolean;
    lastSwapAge: number;
}

export interface TradeExecutionResult {executed: boolean; trade?: Trade; error?: string;}
export interface TradingFees {gasFee: number; swapFee: number; totalFees: number;}

export interface ExecutionLayer {
    initialize(): Promise<void>;
    updateBalances(): Promise<void>;
    executeBuy(token: string, signal: AggregatedSignal, currentPrice: number, tradeValueUSD: number): Promise<boolean>;
    executeSell(token: string, signal: AggregatedSignal, currentPrice: number): Promise<boolean>;
    getPerformanceMetrics(): any;
    getTotalPortfolioValue(): number;
    getPositions(): Map<string, any>;
    logTrade(trade: any): Promise<void>;
}

export interface TradingPosition {
    token: string;
    address: string;
    balance: number;
    decimals: number;
    usdValue: number;
    averagePrice: number;
    entryTime: number;
    strategyAllocations: Map<string, number>;
    totalCostBasis: number;
}

export interface EclipseToken {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    verified: boolean;
}

export interface BlockedToken {
    ticker: string;
    address: string;
    isGasToken: boolean;
    isStablecoin: boolean;
}

export interface IndicatorResult {
    strategyName: string;
    signal: ContinuousIndicatorSignal;
    meetsThreshold: boolean;
    threshold: number;
    weight: number;
    adjustedScore: number;
    riskAdjustedScore: number;
}

export interface AggregatedSignal {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    strength: number;
    indicatorResults: IndicatorResult[];
    metConfluence: boolean;
    requiredConfluence: number;
    actualConfluence: number;
    weightedScore: number;
    riskAdjustedScore: number;
    marketConditionFactor: number;
    temporalScore: number;
}

export interface MarketCondition {
    type: 'trending' | 'sideways' | 'volatile';
    strength: number;
    volatility: number;
    trend: number;
}

export interface TokenSignalAnalysis {
    tokenData: TokenData;
    aggregatedSignal: AggregatedSignal;
    buyConfluence: number;
    sellConfluence: number;
    overallScore: number;
    weightedBuyScore: number;
    weightedSellScore: number;
    riskAdjustedScore: number;
    liquidityScore: number;
    volatilityPenalty: number;
    marketCondition: MarketCondition;
    finalRanking: number;
}

export interface MultiTokenRecommendation {
    recommendedAction: 'BUY' | 'SELL' | 'HOLD';
    recommendedToken?: TokenSignalAnalysis;
    currentTokenShouldSell: boolean;
    allTokenAnalyses: TokenSignalAnalysis[];
    topCandidates: TokenSignalAnalysis[];
    currentTokenAnalysis?: TokenSignalAnalysis;
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    recommendedPositionSize: number;
    expectedRisk: number;
    alternativeTokens: TokenSignalAnalysis[];
}

export interface PerformanceTracker {
    strategyPerformance: Map<string, {
        successRate: number;
        avgReturn: number;
        recentSignals: boolean[];
        weight: number;
    }>;
    updatePerformance(strategyName: string, success: boolean): void;
    getAdaptiveWeight(strategyName: string, baseWeight: number): number;
}

export interface TradingSignal {action: 'BUY' | 'SELL' | 'HOLD'; strength: number; timeframeAlignment: boolean; trendStrength: number;}

export interface ContinuousIndicatorSignal {
    score: number; // -1 to 1, where 1 = strong buy, -1 = strong sell, 0 = neutral
    strength: number; // 0 to 1, how strong the signal is
    timeframeAlignment: boolean; // Whether timeframes align
    trendStrength: number; // 0 to 1, strength of the trend
    rawValue?: number; // Raw indicator value (RSI, MACD, etc.)
}

export interface ContinuousSignal {
    score: number; // -1 to 1, where 1 = strong buy, -1 = strong sell, 0 = neutral
    strength: number; // 0 to 1, how strong the signal is
    confidence: number; // 0 to 1, confidence in the signal
    timeframeAlignment: boolean; // Whether timeframes align
    trendStrength: number; // 0 to 1, strength of the trend
    indicatorResults: IndicatorResult[]; // Individual indicator results
    marketConditionFactor: number; // Market condition multiplier
    temporalScore: number; // Timeframe alignment bonus
    riskAdjustedScore: number; // Risk-adjusted final score
}

export interface ContinuousIndicatorResult {
    strategyName: string;
    signal: ContinuousIndicatorSignal;
    meetsThreshold: boolean;
    threshold: number;
    weight: number;
    adjustedScore: number;
    riskAdjustedScore: number;
}

export interface TokenScore {
    ticker: string;
    address: string;
    score: number; // -1 to 1
    strength: number; // 0 to 1
    confidence: number; // 0 to 1
    indicatorResults: ContinuousIndicatorResult[];
    marketCondition: MarketCondition;
    liquidityScore: number;
    volatilityPenalty: number;
    finalRanking: number; // For sorting/ranking
}

export interface CombinedPerformanceData {chains: {name: string; mode: string; performance: any | null; isRunning: boolean;}[]; totalCombinedValue: number; totalCombinedTrades: number; isAnyActive: boolean;}
export interface ChainConfig {name: string; mode: 'PAPER' | 'LIVE'; enabled: boolean; start: () => Promise<void>; stop: () => void; getPerformance: () => any; isRunning: () => boolean;}

export interface PerformanceData {
    strategies: any[];
    portfolioValue: number;
    totalTrades: number;
    totalReturn: number;
    activePositions: number;
    sortedStrategies: any[];
    activeStrategies: any[];
    avgReturn: number;
    overallWinRate: number;
    underperformingStrategies: any[];
    totalRealizedPnL: number;
    totalUnrealizedPnL: number;
    totalFeesPaid: number;
    avgFeePerTrade: number;
    portfolioMetrics: {
        totalCash: number;
        totalPositions: number;
        diversificationScore: number;
        riskScore: number;
    };
}

export interface JupiterPriceDepth { '10': number; '100': number; '1000': number; }
export interface JupiterPriceImpactRatio {depth: JupiterPriceDepth; timestamp: number;}
export interface JupiterLastSwappedPrice {lastJupiterSellAt: number; lastJupiterSellPrice: string; lastJupiterBuyAt: number; lastJupiterBuyPrice: string;}
export interface JupiterQuotedPrice {buyPrice: string; buyAt: number; sellPrice: string; sellAt: number;}
export interface JupiterPriceExtraInfo {lastSwappedPrice: JupiterLastSwappedPrice; quotedPrice: JupiterQuotedPrice; confidenceLevel: 'high' | 'medium' | 'low'; depth: {buyPriceImpactRatio: JupiterPriceImpactRatio; sellPriceImpactRatio: JupiterPriceImpactRatio;};}
export interface JupiterEnhancedPriceData {id: string; type: string; price: string; extraInfo: JupiterPriceExtraInfo;}

export interface TokenIndicatorScore {
    ticker: string;
    address: string;
    name?: string;
    totalIndicatorsSatisfied: number;
    buyIndicatorsSatisfied: number;
    sellIndicatorsSatisfied: number;
    totalIndicatorsEvaluated: number;
    satisfactionRate: number; // percentage of indicators satisfied
    aggregatedSignal: AggregatedSignal;
}

export interface PriceServiceState {
    isRunning: boolean;
    solanaInterval?: NodeJS.Timeout;
    eclipseInterval?: NodeJS.Timeout;
    priceWarningTracker: Map<string, number>;
    readonly PRICE_WARNING_COOLDOWN: number;
}

export interface LogEntry {
    timestamp: number;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    token?: string;
    strategy?: string;
    data?: any;
}

export interface ArbitrageMonitor {lastAlertTime: Map<string, number>; isRunning: boolean; interval?: NodeJS.Timeout;}
export interface ArbitrageData {market: any; treasury: any; marketPrices: any; treasuryBalances: any; supplies: any;}
export interface ArbitrageOpportunity {type: string; direction: string; profitPotential: number; marketRate: number; treasuryRate: number;}