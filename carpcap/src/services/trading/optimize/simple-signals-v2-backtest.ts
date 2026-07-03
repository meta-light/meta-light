import { connect, disconnect, model } from 'mongoose';
import { PriceSchema } from '../models/price';
import { TradingConfig, SolanaCoreValidatedTokens, EclipseCoreValidatedTokens } from '../config';
import { TokenData, Position } from '../models/interfaces';
import { generateContinuousSignalV2 } from '../trading/signals_v2';

type Network = 'SOLANA' | 'ECLIPSE';

interface BacktestMetrics {
  finalBalance: number;
  totalProfit: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
}

function cloneDeep<T>(obj: T): T {return JSON.parse(JSON.stringify(obj));}

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
  const validated = network === 'SOLANA' ? SolanaCoreValidatedTokens : EclipseCoreValidatedTokens;
  const excludeSet = new Set(validated.filter(t => t.isGasToken || t.isStablecoin).map(t => t.ticker));
  const tokens = Array.from(byToken.values())
    .filter(t => t.priceHistory.length >= 100)
    .filter(t => !excludeSet.has(t.ticker));
  const MIN_LIQ = 70, MAX_SPREAD_PCT = 0.5;
  const qualityFiltered = tokens.filter(t => {
    const l = liquidityAgg.get(t.ticker), s = spreadAgg.get(t.ticker);
    if (l && l.count >= 10 && s && s.count >= 10) {
      const avgL = l.sum / l.count; const avgS = s.sum / s.count;
      return avgL >= MIN_LIQ && avgS <= MAX_SPREAD_PCT;
    }
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

function runBacktestV2(tokens: TokenData[], cfg: any, network: Network, options?: { step?: number; topK?: number; maxPositions?: number; }): BacktestMetrics {
  const step = options?.step ?? 2;
  const TOP_K = options?.topK ?? 2;
  const MAX_POSITIONS = options?.maxPositions ?? 2;
  const SLIPPAGE = 0.001;

  let balance = 1000, maxBalance = balance, maxDrawdown = 0, totalTrades = 0, winTrades = 0;
  const positions = new Map<string, Position>();
  const tokenIndex: Map<string, TokenData> = new Map(tokens.map(t => [t.ticker, t]));
  const lastEntryStep = new Map<string, number>();
  const minLen = Math.min(...tokens.map(t => t.priceHistory.length));
  if (!isFinite(minLen) || minLen < 2) {return { finalBalance: balance, totalProfit: 0, totalTrades: 0, winRate: 0, maxDrawdown: 0 };}
  const cooldownSteps = Math.max(1, Math.floor(((cfg.TRADE_COOLDOWN ?? TradingConfig.TRADE_COOLDOWN) / (cfg.TRADING_INTERVAL ?? TradingConfig.TRADING_INTERVAL))));

  for (let i = 50; i < minLen; i += step) {
    const snapshot = tokens.map(token => {
      const slice: TokenData = { ...token, priceHistory: token.priceHistory.slice(0, i + 1) };
      const signal = generateContinuousSignalV2(slice, cfg);
      const price = slice.priceHistory[slice.priceHistory.length - 1];
      return { token, slice, signal, price };
    });

    // exits
    for (const { token, signal, price } of snapshot) {
      const open = positions.get(token.ticker);
      if (!open) continue;
      const entryPx = open.averagePrice;
      const pnlPct = (price - entryPx) / entryPx;
      const stopLoss = cfg.STOP_LOSS ?? TradingConfig.STOP_LOSS;
      const tpLevels: number[] = cfg.TAKE_PROFIT_LEVELS ?? TradingConfig.TAKE_PROFIT_LEVELS;
      // trailing stop
      if ((cfg.ENABLE_TRAILING_STOPS ?? TradingConfig.ENABLE_TRAILING_STOPS)) {
        if (price > open.highestPrice) {
          open.highestPrice = price; open.trailingStopPrice = price * (1 - (cfg.TRAILING_STOP_DISTANCE ?? TradingConfig.TRAILING_STOP_DISTANCE));
        }
      }
      const trailingHit = (cfg.ENABLE_TRAILING_STOPS ?? TradingConfig.ENABLE_TRAILING_STOPS) && price <= open.trailingStopPrice;
      const tpHit = tpLevels.some(l => pnlPct >= l);
      if (signal.score < -0.1 || pnlPct <= -stopLoss || trailingHit || tpHit) {
        const sellPrice = price * (1 - SLIPPAGE);
        const sellValue = open.remainingAmount * sellPrice;
        const { totalFees } = calculateTradingFeesUSD(sellValue, network);
        const netSell = sellValue - totalFees;
        const wasWin = netSell > (open.remainingAmount * entryPx);
        if (wasWin) winTrades++;
        totalTrades++;
        balance += netSell;
        positions.delete(token.ticker);
      }
    }

    // entries
    const minStrength = (cfg.MIN_SIGNAL_STRENGTH ?? TradingConfig.MIN_SIGNAL_STRENGTH) as number;
    const minConfidence = (cfg.MIN_SIGNAL_CONFIDENCE ?? TradingConfig.MIN_SIGNAL_CONFIDENCE) as number;
    const requireMTF = (cfg.MULTI_TIMEFRAME_FILTER ?? TradingConfig.MULTI_TIMEFRAME_FILTER) as boolean;
    const candidates = snapshot.filter(({ token, signal, price }) => {
      if (positions.has(token.ticker)) return false;
      if (signal.score <= 0.1) return false;
      if (signal.strength < minStrength || signal.confidence < minConfidence) return false;
      if (requireMTF && !signal.timeframeAlignment) return false;
      if (!(price > 0)) return false;
      const last = lastEntryStep.get(token.ticker);
      if (last !== undefined && (i - last) < cooldownSteps) return false;
      return true;
    }).sort((a, b) => b.signal.score - a.signal.score);

    const toOpen = candidates.slice(0, TOP_K);
    for (const { token, price } of toOpen) {
      if (positions.size >= MAX_POSITIONS) break;
      const tradeValue = balance * (cfg.BASE_POSITION_SIZE ?? TradingConfig.BASE_POSITION_SIZE);
      const minTrade = cfg.MIN_TRADE_VALUE_USD ?? TradingConfig.MIN_TRADE_VALUE_USD;
      if (tradeValue < minTrade) continue;
      const buyPrice = price * (1 + SLIPPAGE);
      const { totalFees } = calculateTradingFeesUSD(tradeValue, network);
      if (balance >= tradeValue + totalFees && buyPrice > 0) {
        const amount = tradeValue / buyPrice;
        positions.set(token.ticker, { token: token.ticker, amount, averagePrice: buyPrice, entryTime: Date.now(), remainingAmount: amount, highestPrice: buyPrice, trailingStopPrice: buyPrice * (1 - (cfg.TRAILING_STOP_DISTANCE ?? TradingConfig.TRAILING_STOP_DISTANCE)), partialExits: [], strategyAllocations: new Map() });
        balance -= (tradeValue + totalFees);
        lastEntryStep.set(token.ticker, i);
      }
    }

    const currentValue = balance + Array.from(positions.values()).reduce((s, p) => {
      const t = tokenIndex.get(p.token); if (!t) return s; const idx = Math.min(i, t.priceHistory.length - 1); return s + p.remainingAmount * t.priceHistory[idx];
    }, 0);
    if (currentValue > maxBalance) maxBalance = currentValue;
    const dd = (maxBalance - currentValue) / maxBalance; if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const lastIdx = Math.min(...tokens.map(t => t.priceHistory.length)) - 1;
  for (const [ticker, pos] of positions) {
    const token = tokenIndex.get(ticker); if (!token) continue;
    const price = token.priceHistory[lastIdx];
    const sellValue = pos.remainingAmount * price;
    const { totalFees } = calculateTradingFeesUSD(sellValue, network);
    const netSell = sellValue - totalFees;
    const wasWin = netSell > pos.remainingAmount * pos.averagePrice; if (wasWin) winTrades++;
    totalTrades++; balance += netSell;
  }

  return { finalBalance: balance, totalProfit: balance - 1000, totalTrades, winRate: totalTrades > 0 ? winTrades / totalTrades : 0, maxDrawdown };
}

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carpcap';
    await connect(mongoUri);
    const networkArg = (process.argv[2] as Network) || 'SOLANA';
    const days = Number(process.argv[3] || 14);
    const tokenLimit = Number(process.argv[4] || 5);
    const step = Number(process.argv[5] || 2);
    const maxPeriods = Number(process.argv[6] || 800);
    const topK = Number(process.argv[7] || 2);
    const maxPositions = Number(process.argv[8] || 2);
    const cfg = cloneDeep(TradingConfig);
    let tokens = await loadHistoricalData(networkArg, days);
    if (tokens.length === 0) {console.log(`No data for ${networkArg}`); return;}
    tokens = tokens.sort((a, b) => b.priceHistory.length - a.priceHistory.length).slice(0, tokenLimit).map(t => ({ ...t, priceHistory: t.priceHistory.slice(-maxPeriods), timestamps: t.timestamps.slice(-maxPeriods) }));
    const metrics = runBacktestV2(tokens, cfg, networkArg, { step, topK, maxPositions });
    console.log(`\nBacktest(${networkArg}) ${days}d, tokens=${tokens.length}: Profit=$${metrics.totalProfit.toFixed(2)}, Trades=${metrics.totalTrades}, WinRate=${(metrics.winRate*100).toFixed(1)}%, MaxDD=${(metrics.maxDrawdown*100).toFixed(1)}%`);
  } catch (e) {
    console.error('Backtest failed:', e);
  } finally {
    await disconnect();
  }
}

main();