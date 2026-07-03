import { connect, disconnect, model } from 'mongoose';
import { PriceSchema } from '../models/price';
import { TradingConfig, SolanaCoreValidatedTokens, EclipseCoreValidatedTokens } from '../config';
import { TokenData, Position } from '../models/interfaces';
import { generateContinuousSignal } from '../trading/signals';

type Network = 'SOLANA' | 'ECLIPSE';

interface BacktestMetrics {
	finalBalance: number;
	totalProfit: number;
	totalTrades: number;
	winRate: number;
	maxDrawdown: number;
}

function cloneDeep<T>(obj: T): T {return JSON.parse(JSON.stringify(obj));}

type SignalOverrides = Record<string, { threshold: number; weight: number }>;

export function createNetworkConfig(base: any, network: Network, threshold: number, weight: number) {
    const conf = cloneDeep(base);
    const netConf = network === 'SOLANA' ? conf.SOLANA : conf.ECLIPSE;
    const signalConfig = (network === 'SOLANA' ? TradingConfig.SOLANA.SIGNAL_CONFIG : TradingConfig.ECLIPSE.SIGNAL_CONFIG).map(s => ({ ...s, signal_threshold: threshold, signal_weight: weight }));
    return {...conf, [network]: netConf, SIGNAL_CONFIG: signalConfig};
}

function buildConfigFromOverrides(base: any, network: Network, overrides: SignalOverrides) {
    const conf = cloneDeep(base);
    const netConf = network === 'SOLANA' ? conf.SOLANA : conf.ECLIPSE;
    const baseSignals = network === 'SOLANA' ? TradingConfig.SOLANA.SIGNAL_CONFIG : TradingConfig.ECLIPSE.SIGNAL_CONFIG;
    const signalConfig = baseSignals.map(s => {
        const o = overrides[s.name];
        return {
            ...s,
            signal_threshold: o?.threshold ?? s.signal_threshold,
            signal_weight: o?.weight ?? s.signal_weight
        };
    });
    return { ...conf, [network]: netConf, SIGNAL_CONFIG: signalConfig };
}

async function loadHistoricalData(network: Network, days: number): Promise<TokenData[]> {
	const endDate = new Date();
	const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
	const PriceModel = model('prices', PriceSchema);
	const rows = await PriceModel.find({ chain: network, timestamp: { $gte: startDate, $lte: endDate } })
		.sort({ timestamp: 1 })
		.lean();
	const byToken = new Map<string, TokenData>();
    const liquidityAgg = new Map<string, { sum: number; count: number }>();
    const spreadAgg = new Map<string, { sum: number; count: number }>();
	for (const r of rows) {
		if (!byToken.has(r.token)) {
			byToken.set(r.token, {
				ticker: r.token,
				address: r.address,
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
				liquidityScores: [],
				spreadHistory: [],
				confidenceHistory: [],
				lastEnhancedUpdate: Date.now()
			});
		}
		const td = byToken.get(r.token)!;
		td.priceHistory.push(r.price);
		td.timestamps.push((r.timestamp as Date).getTime());
        if (typeof (r as any).liquidityScore === 'number') {
            const agg = liquidityAgg.get(r.token) || { sum: 0, count: 0 };
            agg.sum += (r as any).liquidityScore;
            agg.count += 1;
            liquidityAgg.set(r.token, agg);
        }
        if (typeof (r as any).spreadPercentage === 'number') {
            const agg = spreadAgg.get(r.token) || { sum: 0, count: 0 };
            agg.sum += (r as any).spreadPercentage;
            agg.count += 1;
            spreadAgg.set(r.token, agg);
        }
	}
    // Filter out gas tokens and stablecoins
    const validated = network === 'SOLANA' ? SolanaCoreValidatedTokens : EclipseCoreValidatedTokens;
    const excludeSet = new Set(validated.filter(t => t.isGasToken || t.isStablecoin).map(t => t.ticker));
    const tokens = Array.from(byToken.values())
        .filter(t => t.priceHistory.length >= 100)
        .filter(t => !excludeSet.has(t.ticker));
    // Optional liquidity/spread quality filter if we have metrics
    const MIN_LIQ = 70;
    const MAX_SPREAD_PCT = 0.5; // percent
    const qualityFiltered = tokens.filter(t => {
        const l = liquidityAgg.get(t.ticker);
        const s = spreadAgg.get(t.ticker);
        if (l && l.count >= 10 && s && s.count >= 10) {
            const avgLiq = l.sum / l.count;
            const avgSpread = s.sum / s.count;
            return avgLiq >= MIN_LIQ && avgSpread <= MAX_SPREAD_PCT;
        }
        // If we don't have enough data, keep token (don't over-filter)
        return true;
    });
    return qualityFiltered;
}

function calculateTradingFeesUSD(tradeValueUSD: number, network: Network): { gasFee: number; swapFee: number; totalFees: number } {
	const net = network === 'SOLANA' ? TradingConfig.SOLANA : TradingConfig.ECLIPSE;
	const baseTxFee = net.BASE_TRANSACTION_FEE;
	const avgPriority = (net.PRIORITY_FEE_RANGE[0] + net.PRIORITY_FEE_RANGE[1]) / 2;
	const gasPriceUSD = net.GAS_PRICE_USD;
	const gasFeeUSD = (baseTxFee + avgPriority) * gasPriceUSD;
	const swapFee = tradeValueUSD * net.DEX_SWAP_FEE_RATE;
	return { gasFee: gasFeeUSD, swapFee, totalFees: gasFeeUSD + swapFee };
}

export function runBacktest(tokens: TokenData[], baseConfig: any, network: Network): BacktestMetrics {
	let balance = 1000;
	let maxBalance = balance;
	let maxDrawdown = 0;
	let totalTrades = 0;
	let winTrades = 0;
	const positions = new Map<string, Position>();

	// Determine shared simulation length
	const minLen = Math.min(...tokens.map(t => t.priceHistory.length));
	if (!isFinite(minLen) || minLen < 2) {return { finalBalance: balance, totalProfit: 0, totalTrades: 0, winRate: 0, maxDrawdown: 0 };}

	for (let i = 50; i < minLen; i++) { // start after 50 to allow indicators warmup
		for (const token of tokens) {
			const slice: TokenData = {
				...token,
				priceHistory: token.priceHistory.slice(0, i + 1)
			};
			const signal = generateContinuousSignal(slice, baseConfig);
			const price = slice.priceHistory[slice.priceHistory.length - 1];
			const openPos = positions.get(token.ticker);

			// Exit conditions: strong sell or stop loss reached
			if (openPos) {
				const entryPx = openPos.averagePrice;
				const pnlPct = (price - entryPx) / entryPx;
				const stopLoss = baseConfig.STOP_LOSS ?? TradingConfig.STOP_LOSS;
				const tpLevels: number[] = baseConfig.TAKE_PROFIT_LEVELS ?? TradingConfig.TAKE_PROFIT_LEVELS;
				const takeProfitHit = tpLevels.some(lvl => pnlPct >= lvl);
				if (signal.score < -0.1 || pnlPct <= -stopLoss || takeProfitHit) {
					// Sell full position
					const sellValue = openPos.remainingAmount * price;
					const { totalFees } = calculateTradingFeesUSD(sellValue, network);
					const net = sellValue - totalFees;
					const wasWin = net > (openPos.remainingAmount * entryPx);
					if (wasWin) winTrades++;
					totalTrades++;
					balance += net;
					positions.delete(token.ticker);
				}
			} else {
				// Entry conditions: strong buy
				if (signal.score > 0.1) {
					const tradeValue = balance * (baseConfig.BASE_POSITION_SIZE ?? TradingConfig.BASE_POSITION_SIZE);
					const minTrade = baseConfig.MIN_TRADE_VALUE_USD ?? TradingConfig.MIN_TRADE_VALUE_USD;
					if (tradeValue >= minTrade) {
						const { totalFees } = calculateTradingFeesUSD(tradeValue, network);
						if (balance >= tradeValue + totalFees && price > 0) {
							const amount = tradeValue / price;
							positions.set(token.ticker, {
								token: token.ticker,
								amount,
								averagePrice: price,
								entryTime: Date.now(),
								remainingAmount: amount,
								highestPrice: price,
								trailingStopPrice: price * (1 - (baseConfig.TRAILING_STOP_DISTANCE ?? TradingConfig.TRAILING_STOP_DISTANCE)),
								partialExits: [],
								strategyAllocations: new Map()
							});
							balance -= (tradeValue + totalFees);
						}
					}
				}
			}
		}
		const currentValue = balance + Array.from(positions.values()).reduce((s, p) => s + p.remainingAmount * tokens[0].priceHistory[i], 0);
		if (currentValue > maxBalance) {maxBalance = currentValue;}
		const dd = (maxBalance - currentValue) / maxBalance;
		if (dd > maxDrawdown) {maxDrawdown = dd;}
	}

	// Close remaining positions at last price
	const lastIdx = Math.min(...tokens.map(t => t.priceHistory.length)) - 1;
	for (const [ticker, pos] of positions) {
		const token = tokens.find(t => t.ticker === ticker);
		if (!token) continue;
		const price = token.priceHistory[lastIdx];
		const sellValue = pos.remainingAmount * price;
		const { totalFees } = calculateTradingFeesUSD(sellValue, network);
		const net = sellValue - totalFees;
		const wasWin = net > pos.remainingAmount * pos.averagePrice;
		if (wasWin) winTrades++;
		totalTrades++;
		balance += net;
	}

	return {
		finalBalance: balance,
		totalProfit: balance - 1000,
		totalTrades,
		winRate: totalTrades > 0 ? winTrades / totalTrades : 0,
		maxDrawdown
	};
}

async function optimize(network: Network, days: number, options?: { tokenLimit?: number; step?: number; maxPeriods?: number; thresholds?: number[]; weights?: number[]; passes?: number; }) {
    const base = cloneDeep(TradingConfig);
    let tokens = await loadHistoricalData(network, days);
    if (tokens.length === 0) {console.log(`No data for ${network}`); return;}
    // focus on longest tokens, cap count
    tokens = tokens.sort((a, b) => b.priceHistory.length - a.priceHistory.length).slice(0, options?.tokenLimit ?? 5);
    // cap history length
    const maxPeriods = options?.maxPeriods ?? 500;
    tokens = tokens.map(t => ({ ...t, priceHistory: t.priceHistory.slice(-maxPeriods), timestamps: t.timestamps.slice(-maxPeriods) }));

    const thresholds = options?.thresholds ?? [0.45, 0.5, 0.55];
    const weights = options?.weights ?? [0.9, 1.0, 1.2];
    const passes = options?.passes ?? 1;

    // stepped backtest to skip bars for speed
    function runBacktestWithStep(step: number): (ts: TokenData[], cfg: any, net: Network) => BacktestMetrics {
        return (ts: TokenData[], cfg: any, net: Network) => {
            let balance = 1000; let maxBalance = balance; let maxDrawdown = 0; let totalTrades = 0; let winTrades = 0;
            const positions = new Map<string, Position>();
            const tokenIndex: Map<string, TokenData> = new Map(ts.map(t => [t.ticker, t]));
            const lastEntryStep = new Map<string, number>();
            const lastSignalScore = new Map<string, number>();
            const partialTakenLevels = new Map<string, Set<number>>();
            const minLen = Math.min(...ts.map(t => t.priceHistory.length));
            if (!isFinite(minLen) || minLen < 2) {return { finalBalance: balance, totalProfit: 0, totalTrades: 0, winRate: 0, maxDrawdown: 0 };}
            const cooldownSteps = Math.max(1, Math.floor(((cfg.TRADE_COOLDOWN ?? TradingConfig.TRADE_COOLDOWN) / (cfg.TRADING_INTERVAL ?? TradingConfig.TRADING_INTERVAL))));
            const TOP_K = 2; // allow more participation in uptrends
            const MAX_POSITIONS = 2; // cap number of concurrent holdings
            const HYSTERESIS = 0.03; // lighter hysteresis to catch trends
            const SLIPPAGE = 0.001; // 0.1% slippage on each side
            const gateCounters = {
                inPosition: 0,
                lowScore: 0,
                weakStrengthConfidence: 0,
                mtfRejected: 0,
                confluenceLow: 0,
                weakTrend: 0,
                cooldown: 0,
                hysteresis: 0,
                nonPositivePrice: 0,
                capacity: 0
            };
            for (let i = 50; i < minLen; i += step) {
                // Compute signals for this step
                const snapshot = ts.map(token => {
                    const slice: TokenData = { ...token, priceHistory: token.priceHistory.slice(0, i + 1) };
                    const signal = generateContinuousSignal(slice, cfg);
                    const price = slice.priceHistory[slice.priceHistory.length - 1];
                    return { token, slice, signal, price };
                });

                // First handle exits (TP/SL/TS)
                for (const { token, signal, price } of snapshot) {
                    const openPos = positions.get(token.ticker);
                    if (openPos) {
                        const entryPx = openPos.averagePrice;
                        const pnlPct = (price - entryPx) / entryPx;
                        const stopLoss = cfg.STOP_LOSS ?? TradingConfig.STOP_LOSS;
                        const tpLevels: number[] = cfg.TAKE_PROFIT_LEVELS ?? TradingConfig.TAKE_PROFIT_LEVELS;
                        // Trailing stop update
                        if ((cfg.ENABLE_TRAILING_STOPS ?? TradingConfig.ENABLE_TRAILING_STOPS)) {
                            if (price > openPos.highestPrice) {
                                openPos.highestPrice = price;
                                openPos.trailingStopPrice = price * (1 - (cfg.TRAILING_STOP_DISTANCE ?? TradingConfig.TRAILING_STOP_DISTANCE));
                            }
                        }
                        const trailingStopHit = (cfg.ENABLE_TRAILING_STOPS ?? TradingConfig.ENABLE_TRAILING_STOPS) && price <= openPos.trailingStopPrice;
                        // Partial take-profits at each level if not already taken
                        const tpPercents: number[] = cfg.TAKE_PROFIT_PERCENTAGES ?? TradingConfig.TAKE_PROFIT_PERCENTAGES ?? [0.33, 0.5, 1.0];
                        const takenSet = partialTakenLevels.get(token.ticker) ?? new Set<number>();
                        for (let idx = 0; idx < tpLevels.length && idx < tpPercents.length; idx++) {
                            const level = tpLevels[idx];
                            const taken = takenSet.has(idx);
                            if (pnlPct >= level && !taken && openPos.remainingAmount > 0) {
                                const sellAmount = openPos.remainingAmount * tpPercents[idx];
                                const sellPrice = price * (1 - SLIPPAGE);
                                const sellValue = sellAmount * sellPrice;
                                const { totalFees } = calculateTradingFeesUSD(sellValue, net);
                                const netSell = sellValue - totalFees;
                                balance += netSell;
                                openPos.remainingAmount -= sellAmount;
                                takenSet.add(idx);
                                partialTakenLevels.set(token.ticker, takenSet);
                                // After TP1, move SL to break-even
                                if (idx === 0) { openPos.trailingStopPrice = Math.max(openPos.trailingStopPrice, entryPx); }
                            }
                        }
                        // Final exit conditions
                        if (signal.score < -0.1 || pnlPct <= -stopLoss || trailingStopHit || openPos.remainingAmount <= 1e-12) {
                            const sellPrice = price * (1 - SLIPPAGE);
                            const sellValue = openPos.remainingAmount * sellPrice;
                            const { totalFees } = calculateTradingFeesUSD(sellValue, net);
                            const netSell = sellValue - totalFees;
                            const wasWin = netSell > (openPos.remainingAmount * entryPx);
                            if (wasWin) winTrades++;
                            totalTrades++;
                            balance += netSell;
                            positions.delete(token.ticker);
                        }
                    }
                }
                // Entries: apply gating + top-K selection
                const minStrength = (cfg.MIN_SIGNAL_STRENGTH ?? TradingConfig.MIN_SIGNAL_STRENGTH) as number;
                const minConfidence = (cfg.MIN_SIGNAL_CONFIDENCE ?? TradingConfig.MIN_SIGNAL_CONFIDENCE) as number;
                const requireMTF = (cfg.MULTI_TIMEFRAME_FILTER ?? TradingConfig.MULTI_TIMEFRAME_FILTER) as boolean;
                const minConfluence = (cfg.MIN_SIGNAL_CONFLUENCE ?? cfg.MIN_BUY_CONFLUENCE ?? TradingConfig.SOLANA.MIN_BUY_CONFLUENCE) as number;
                const candidates = snapshot.filter(({ token, signal, price }) => {
                    if (positions.has(token.ticker)) {gateCounters.inPosition++; return false;}
                    if (signal.score <= 0.1) {gateCounters.lowScore++; return false;}
                    if (signal.strength < minStrength || signal.confidence < minConfidence) {gateCounters.weakStrengthConfidence++; return false;}
                    if (requireMTF && !signal.timeframeAlignment) {gateCounters.mtfRejected++; return false;}
                    const confluence = (signal.indicatorResults || []).filter((r: any) => r.meetsThreshold).length;
                    if (confluence < minConfluence) {gateCounters.confluenceLow++; return false;}
                    const trendOk = (signal.trendStrength ?? 0) >= 0.05;
                    if (!trendOk) {gateCounters.weakTrend++; return false;}
                    const lastStep = lastEntryStep.get(token.ticker);
                    if (lastStep !== undefined && (i - lastStep) < cooldownSteps) {gateCounters.cooldown++; return false;}
                    const prevScore = lastSignalScore.get(token.ticker) ?? -1;
                    if (prevScore !== -1 && (signal.score - prevScore) < HYSTERESIS) {gateCounters.hysteresis++; return false;}
                    if (!(price > 0)) {gateCounters.nonPositivePrice++; return false;}
                    return true;
                }).sort((a, b) => b.signal.score - a.signal.score);

                const toOpen = candidates.slice(0, TOP_K);
                for (const { token, signal, price } of toOpen) {
                    if (positions.size >= MAX_POSITIONS) {gateCounters.capacity++; break;}
                    const tradeValue = balance * (cfg.BASE_POSITION_SIZE ?? TradingConfig.BASE_POSITION_SIZE);
                    const minTrade = cfg.MIN_TRADE_VALUE_USD ?? TradingConfig.MIN_TRADE_VALUE_USD;
                    if (tradeValue >= minTrade) {
                        const buyPrice = price * (1 + SLIPPAGE);
                        const { totalFees } = calculateTradingFeesUSD(tradeValue, net);
                        if (balance >= tradeValue + totalFees && buyPrice > 0) {
                            const amount = tradeValue / buyPrice;
                            // averagePrice should reflect execution price
                            positions.set(token.ticker, { token: token.ticker, amount, averagePrice: buyPrice, entryTime: Date.now(), remainingAmount: amount, highestPrice: buyPrice, trailingStopPrice: buyPrice * (1 - (cfg.TRAILING_STOP_DISTANCE ?? TradingConfig.TRAILING_STOP_DISTANCE)), partialExits: [], strategyAllocations: new Map() });
                            balance -= (tradeValue + totalFees);
                            lastEntryStep.set(token.ticker, i);
                            lastSignalScore.set(token.ticker, signal.score);
                            partialTakenLevels.set(token.ticker, new Set());
                        }
                    }
                }
                const currentValue = balance + Array.from(positions.values()).reduce((s, p) => {
                    const t = tokenIndex.get(p.token);
                    if (!t) return s;
                    const idx = Math.min(i, t.priceHistory.length - 1);
                    return s + p.remainingAmount * t.priceHistory[idx];
                }, 0);
                if (currentValue > maxBalance) {maxBalance = currentValue;}
                const dd = (maxBalance - currentValue) / maxBalance;
                if (dd > maxDrawdown) {maxDrawdown = dd;}
            }
            const lastIdx = Math.min(...ts.map(t => t.priceHistory.length)) - 1;
            for (const [ticker, pos] of positions) {
                const token = tokenIndex.get(ticker);
                if (!token) continue;
                const price = token.priceHistory[lastIdx];
                const sellValue = pos.remainingAmount * price;
                const { totalFees } = calculateTradingFeesUSD(sellValue, net);
                const netSell = sellValue - totalFees;
                const wasWin = netSell > pos.remainingAmount * pos.averagePrice;
                if (wasWin) winTrades++;
                totalTrades++;
                balance += netSell;
            }
            const summary = { finalBalance: balance, totalProfit: balance - 1000, totalTrades, winRate: totalTrades > 0 ? winTrades / totalTrades : 0, maxDrawdown };
            console.log('Gate summary:', gateCounters);
            return summary;
        };
    }

    const step = options?.step ?? 5;
    const fastBacktest = runBacktestWithStep(step);

    // Coordinate descent per-signal to find a diverse combination
    const baseSignals = network === 'SOLANA' ? TradingConfig.SOLANA.SIGNAL_CONFIG : TradingConfig.ECLIPSE.SIGNAL_CONFIG;
    const signalNames = baseSignals.map(s => s.name);
    const overrides: SignalOverrides = Object.fromEntries(baseSignals.map(s => [s.name, { threshold: s.signal_threshold as number, weight: s.signal_weight as number }]));

    let globalCfg = buildConfigFromOverrides(base, network, overrides);
    let globalMetrics = fastBacktest(tokens, globalCfg, network);

    for (let pass = 0; pass < passes; pass++) {
        for (const name of signalNames) {
            let bestLocal = { metrics: globalMetrics, threshold: overrides[name].threshold, weight: overrides[name].weight };
            for (const th of thresholds) {
                for (const w of weights) {
                    const testOverrides = { ...overrides, [name]: { threshold: th, weight: w } };
                    const cfg = buildConfigFromOverrides(base, network, testOverrides);
                    const metrics = fastBacktest(tokens, cfg, network);
                    if (metrics.totalProfit > bestLocal.metrics.totalProfit) {
                        bestLocal = { metrics, threshold: th, weight: w };
                    }
                }
            }
            overrides[name] = { threshold: bestLocal.threshold, weight: bestLocal.weight };
            globalCfg = buildConfigFromOverrides(base, network, overrides);
            globalMetrics = bestLocal.metrics;
            console.log(`[${network}] pass ${pass+1} signal ${name} -> th=${bestLocal.threshold} w=${bestLocal.weight} profit=$${bestLocal.metrics.totalProfit.toFixed(2)}`);
        }
    }

    console.log(`\nBest combination for ${network}: Profit=$${globalMetrics.totalProfit.toFixed(2)}, Trades=${globalMetrics.totalTrades}, WinRate=${(globalMetrics.winRate*100).toFixed(1)}%, MaxDD=${(globalMetrics.maxDrawdown*100).toFixed(1)}%`);
    console.log('\nSuggested SIGNAL_CONFIG override:');
    const finalOverride = baseSignals.map(s => ({ name: s.name, signal_threshold: overrides[s.name].threshold, signal_weight: overrides[s.name].weight, enabled: true }));
    console.log(JSON.stringify(finalOverride, null, 2));
}

async function main() {
	try {
		const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carpcap';
		await connect(mongoUri);
        const networkArg = (process.argv[2] as Network) || 'SOLANA';
        const days = Number(process.argv[3] || 7);
        const tokenLimit = Number(process.argv[4] || 5);
        const step = Number(process.argv[5] || 5);
        const maxPeriods = Number(process.argv[6] || 500);
        const thresholdsArg = process.argv[7];
        const weightsArg = process.argv[8];
        const passes = Number(process.argv[9] || 1);
        const thresholds = thresholdsArg ? thresholdsArg.split(',').map(Number) : undefined;
        const weights = weightsArg ? weightsArg.split(',').map(Number) : undefined;
        const opts = { tokenLimit, step, maxPeriods, thresholds, weights, passes };
        if (networkArg === 'SOLANA' || networkArg === 'ECLIPSE') {await optimize(networkArg, days, opts);} else {await optimize('SOLANA', days, opts); await optimize('ECLIPSE', days, opts);} 
	}
	catch (e) {console.error('Optimization failed:', e);} 
	finally {await disconnect();}
}

main();

// if (require.main === module) {main();}