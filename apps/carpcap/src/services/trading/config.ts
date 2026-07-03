export const TradingConfig = {
    SOLANA: {
        SIGNAL_CONFIG: [
            { name: 'SMA_Crossover', signal_threshold: 0.5, signal_weight: 1.0, enabled: true },
            { name: 'EMA_Crossover', signal_threshold: 0.5, signal_weight: 1.1, enabled: true },
            { name: 'RSI_Oversold_Overbought', signal_threshold: 0.55, signal_weight: 1.2, enabled: true },
            { name: 'MACD_Signal', signal_threshold: 0.5, signal_weight: 1.2, enabled: true },
            { name: 'Bollinger_Bands', signal_threshold: 0.55, signal_weight: 1.0, enabled: true },
            { name: 'Stochastic_Oscillator', signal_threshold: 0.6, signal_weight: 0.9, enabled: true },
            { name: 'ADX_Trend', signal_threshold: 0.55, signal_weight: 1.1, enabled: true },
            { name: 'Combined_Momentum', signal_threshold: 0.55, signal_weight: 1.2, enabled: true },
            { name: 'Pattern_Recognition', signal_threshold: 0.5, signal_weight: 0.8, enabled: true },
            { name: 'Mean_Reversion', signal_threshold: 0.45, signal_weight: 0.9, enabled: true },
            { name: 'Liquidity_Based', signal_threshold: 0.5, signal_weight: 1.4, enabled: true }
        ],
        SLIPPAGE_TOLERANCE_BPS: 300,
        MIN_BUY_CONFLUENCE: 2,
        MIN_SIGNAL_CONFLUENCE: 2,
        MIN_SELL_CONFLUENCE: 2,
        BASE_TRANSACTION_FEE: 0.0001,
        DEX_SWAP_FEE_RATE: 0.0025,
        GAS_PRICE_USD: 160,
        PRIORITY_FEE_RANGE: [0.00001, 0.0001] as [number, number],
        TOKEN_REFRESH_INTERVAL: 24 * 60 * 60 * 1000
    },
    ECLIPSE: {
        SIGNAL_CONFIG: [
            { name: 'SMA_Crossover', signal_threshold: 0.5, signal_weight: 1.0, enabled: true },
            { name: 'EMA_Crossover', signal_threshold: 0.5, signal_weight: 1.1, enabled: true },
            { name: 'RSI_Oversold_Overbought', signal_threshold: 0.55, signal_weight: 1.2, enabled: true },
            { name: 'MACD_Signal', signal_threshold: 0.5, signal_weight: 1.2, enabled: true },
            { name: 'Bollinger_Bands', signal_threshold: 0.55, signal_weight: 1.0, enabled: true },
            { name: 'Stochastic_Oscillator', signal_threshold: 0.6, signal_weight: 0.9, enabled: true },
            { name: 'ADX_Trend', signal_threshold: 0.55, signal_weight: 1.1, enabled: true },
            { name: 'Combined_Momentum', signal_threshold: 0.55, signal_weight: 1.2, enabled: true },
            { name: 'Pattern_Recognition', signal_threshold: 0.5, signal_weight: 0.8, enabled: true },
            { name: 'Mean_Reversion', signal_threshold: 0.45, signal_weight: 0.9, enabled: true },
            { name: 'Liquidity_Based', signal_threshold: 0.5, signal_weight: 1.4, enabled: true }
        ],
        SLIPPAGE_TOLERANCE_BPS: 50,
        MIN_BUY_CONFLUENCE: 2,
        MIN_SIGNAL_CONFLUENCE: 2,
        MIN_SELL_CONFLUENCE: 2,
        BASE_TRANSACTION_FEE: 0.000001,
        DEX_SWAP_FEE_RATE: 0.0025,
        GAS_PRICE_USD: 3000,
        PRIORITY_FEE_RANGE: [0.0000001, 0.000001] as [number, number],
        TOKEN_REFRESH_INTERVAL: 30 * 60 * 1000
    },
    MAX_TOKENS: 50,
    INITIAL_PAPER_BALANCE: 100,
    PRICE_UPDATE_INTERVAL: 30000,
    TRADING_INTERVAL: 120000,
    TRADE_COOLDOWN: 300000,
    BASE_POSITION_SIZE: 0.08, // Reduced from 0.12 to 0.08 for smaller positions
    MAX_POSITION_SIZE: 0.20, // Reduced from 0.25 to 0.20
    MIN_POSITION_SIZE: 0.03, // Increased from 0.02 to 0.03 for minimum viable trades
    MARKET_CONDITION_MULTIPLIERS: { trending: 1.1, sideways: 0.9, volatile: 1.0 },
    RISK_ADJUSTMENT: { volatilityPenalty: 0.5, liquidityBonus: 0.1, confidenceMultiplier: 0.2 },
    TEMPORAL_WEIGHTING: { recentSignalBonus: 0.05, timeframeAlignment: 0.1, momentumDecay: 0.1 },
    POSITION_MANAGEMENT: { switchingThreshold: 0.50, holdingBonus: 0.15, maxPositionRisk: 0.15 },
    PERFORMANCE_TRACKING: { enableAdaptiveWeights: false, performanceWindow: 50, minPerformanceSample: 10 },
    MIN_TRADE_VALUE_USD: 10, // Increased from 5 to 10 to avoid micro-trades
    STOP_LOSS: 0.04,
    TAKE_PROFIT_LEVELS: [0.05, 0.10, 0.20],
    TAKE_PROFIT_PERCENTAGES: [0.33, 0.50, 1.0],
    ENABLE_TRAILING_STOPS: true,
    TRAILING_STOP_DISTANCE: 0.03,
    MULTI_TIMEFRAME_FILTER: true,
    MIN_VOLUME_FILTER: false,
    ENABLE_DYNAMIC_POSITION_SIZING: true,
    ENABLE_LIQUIDITY_ANALYSIS: true,
    ENABLE_PATTERN_RECOGNITION: true,
    VOLATILITY_ADJUSTMENT_ENABLED: true,
    PRICE_MOVEMENT_THRESHOLD: 0.001, // Reduced from 0.002 to 0.001 for more sensitive detection
    PRICE_MOVEMENT_LOOKBACK_PERIODS: 10,
    VOLATILITY_THRESHOLD: 0.25, // Added configurable volatility threshold (25% instead of hardcoded 15%)
    MIN_SIGNAL_STRENGTH: 0.25,
    MIN_SIGNAL_CONFIDENCE: 0.25
};

export const SolanaCoreValidatedTokens = [
    { ticker: 'SOL',      address: 'So11111111111111111111111111111111111111111',  decimals: 9, isStablecoin: false, isGasToken: true },
    { ticker: 'USDC',     address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, isStablecoin: true,  isGasToken: false },
    { ticker: 'USDT',     address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, isStablecoin: true,  isGasToken: false },
    { ticker: 'RENDER',   address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',  decimals: 8, isStablecoin: false, isGasToken: false },
    { ticker: 'HNT',      address: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',  decimals: 8, isStablecoin: false, isGasToken: false },
    { ticker: 'MOBILE',   address: 'mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'IOT',      address: 'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'SHDW',     address: 'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y',  decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'NOS',      address: 'nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'HONEY',    address: '4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy', decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'MEDIA',    address: 'ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'JUP',      address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'PYTH',     address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'XNET',     address: 'xNETbUB7cRb3AAu2pNG2pUwQcJ2BHcktfvSB8x1Pq6L',  decimals: 8, isStablecoin: false, isGasToken: false },
    { ticker: 'GEOD',     address: '7JA5eZdCzztSfQbJvS8aVVxMFfd81Rs9VvwnocV1mKHu', decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'ORE',      address: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',  decimals: 11, isStablecoin: false, isGasToken: false },
    { ticker: 'USDC',     address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, isStablecoin: true, isGasToken: false },
    { ticker: 'BONK',     address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5, isStablecoin: false, isGasToken: false },
    { ticker: 'PENGU',    address: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'JTO',      address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'GRASS',    address: 'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs', decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'IO',       address: 'BZLbGTNCSFfoth2GYDtwr7e4imWzpR5jqcUuGEwr646K', decimals: 8, isStablecoin: false, isGasToken: false },
    { ticker: 'KMNO',     address: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'ROAM',    address: 'RoamA1USA8xjvpTJZ6RvvxyDRzNh6GCA1zVGKSiMVkn',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'NATIX',    address: 'FRySi8LPkuByB7VPSCCggxpewFUeeJiwEGRKKuhwpKcX', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'WXM',      address: 'wxmJYe17a2oGJZJ1wDe6ZyRKUKmrLj2pJsavEdTVhPP',  decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'WAYRU',    address: 'WAYRUy2VkqUCBg49sUSmJ2wYHzWpVjokZfQiGzdrAV3',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'TRUMP',    address: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'WIF',      address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'FARTCOIN', address: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'VIRTUAL',  address: '3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y', decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'ORCA',     address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'SONIC',    address: 'SonicxvLud67EceaEzCLRnMTBqzYUUYNr93DBkBdDES',  decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'RAY',      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'tBTC',     address: '6DNSN2BJsaPFdFFc1zP37kkeNe4Usc1Sqkzr9C9vPWcU', decimals: 8, isStablecoin: false, isGasToken: false },
    { ticker: 'ENRON',    address: 'BktHEAc2WS8TQi2vmavn1rA4L1WJuwF3Vkk3DnwwARti', decimals: 9, isStablecoin: false, isGasToken: false }
];

export const EclipseCoreValidatedTokens = [
    { ticker: 'ETH',    address: 'So11111111111111111111111111111111111111111',  decimals: 9, isStablecoin: false, isGasToken: true },
    { ticker: 'USDC',  address: 'AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE', decimals: 6, isStablecoin: true, isGasToken: false },
    { ticker: 'USDT',  address: 'CEBP3CqAbW4zdZA57H2wfaSG1QNdzQ72GiQEbQXyW9Tm', decimals: 6, isStablecoin: true, isGasToken: false },
    { ticker: 'tUSD',  address: '27Kkn8PWJbKJsRZrxbsYDdedpUQKnJ5vNfserCxNEJ3R', decimals: 6, isStablecoin: true, isGasToken: false },
    { ticker: 'WIF',   address: '841P4tebEgNux2jaWSjCoi9LhrVr9eHGjLc758Va3RPH', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'WETH',  address: 'So11111111111111111111111111111111111111112',  decimals: 9, isStablecoin: false, isGasToken: true },
    { ticker: 'SOL',   address: 'BeRUj3h7BqkbdfFU7FBNYbodgf8GCHodzKvF9aVjNNfL', decimals: 9, isStablecoin: false, isGasToken: true },
    { ticker: 'tETH',  address: 'GU7NS9xCwgNPiAdJ69iusFrRfawjDDPjeMBovhV1d4kn', decimals: 9, isStablecoin: false, isGasToken: false },
    { ticker: 'ORCA',  address: '2tGbYEm4nuPFyS6zjDTELzEhvVKizgKewi6xT7AaSKzn', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'BITZ',  address: '64mggk2nXg6vHC1qCdsZdEFzd5QGN4id54Vbho4PswCF', decimals: 11, isStablecoin: false, isGasToken: false },
    { ticker: 'LAIKA', address: 'LaihKXA47apnS599tyEyasY2REfEzBNe4heunANhsMx',  decimals: 5, isStablecoin: false, isGasToken: false },
    { ticker: 'ES',    address: 'GnBAskb2SQjrLgpTjtgatz4hEugUsYV7XrWU1idV3oqW', decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'sBITZ', address: 'sBTZcSwRZhRq3JcjFh1xwxgCxmsN7MreyU3Zx8dA8uF',  decimals: 11, isStablecoin: false, isGasToken: false }
];

export const SolanaCopyTradeWallets = [
    // {address: 'CkUKgV93zwuEAdCkQvjA94rDh1ajqjPXVhEvQ4BBfmCY'},
    // {address: 'EtmXJF4j74QVJ5XrEwi2DKWh5BGe5byNmgmurWGDibMv'},
    {address: '5wTLevkkUWzKgRTWKcSjrgdoP8TnrEnXYGaAxFKibsS5'},
    {address: '9UWZFoiCHeYRLmzmDJhdMrP7wgrTw7DMSpPiT2eHgJHe'},
    // {address: '5Y7ETTHjnh9Ukb8N5FvDgxeLRGpFRLdZaSuBnE1bnjKU'},
    {address: 'BDzbq7VxG5b2yg4vc11iPvpj51RTbmsnxaEPjwzbWQft'}
];