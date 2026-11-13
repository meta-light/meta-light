// Walk-forward templates are not here: they drive a template rather than
// being one.

import type { Strategy, StrategyConfig } from '../strategies/core/index';
import * as adxTrend from '../strategies/weights/adx-trend';
import * as bollingerBands from '../strategies/weights/bollinger-bands';
import * as bollingerReversion from '../strategies/weights/bollinger-reversion';
import * as combinedMomentum from '../strategies/weights/combined-momentum';
import * as continuousFuturesTrend from '../strategies/weights/continuous-futures-trend';
import * as crossSectionalMomentum from '../strategies/weights/cross-sectional-momentum';
import * as crossSectionalReversal from '../strategies/weights/cross-sectional-reversal';
import * as dailyPartialDrift from '../strategies/weights/daily-partial-drift';
import * as emaCrossover from '../strategies/weights/ema-crossover';
import * as fxCrossSectionalMomentum from '../strategies/weights/fx-cross-sectional-momentum';
import * as fxTimeSeriesMomentum from '../strategies/weights/fx-time-series-momentum';
import * as intraday1hSmaTrend from '../strategies/weights/intraday-1h-sma-trend';
import * as intraday1mEmaScalp from '../strategies/weights/intraday-1m-ema-scalp';
import * as intradayRsi15m from '../strategies/weights/intraday-rsi-15m';
import * as liquidityBased from '../strategies/weights/liquidity-based';
import * as macdSignal from '../strategies/weights/macd-signal';
import * as macdTrend from '../strategies/weights/macd-trend';
import * as meanReversion from '../strategies/weights/mean-reversion';
import * as monthlyCircuitBreaker from '../strategies/weights/monthly-circuit-breaker';
import * as monthlyDriftEtf from '../strategies/weights/monthly-drift-etf';
import * as monthlyInverseVol from '../strategies/weights/monthly-inverse-vol';
import * as pairsHedgeRatio from '../strategies/weights/pairs-hedge-ratio';
import * as pairsRatioZscore from '../strategies/weights/pairs-ratio-zscore';
import * as patternRecognition from '../strategies/weights/pattern-recognition';
import * as quarterlyDualMomentum from '../strategies/weights/quarterly-dual-momentum';
import * as quarterlyTeCostGate from '../strategies/weights/quarterly-te-cost-gate';
import * as riskParityCapped from '../strategies/weights/risk-parity-capped';
import * as riskParityMultiasset from '../strategies/weights/risk-parity-multiasset';
import * as rsiOversoldOverbought from '../strategies/weights/rsi-oversold-overbought';
import * as signalChangeDefensive from '../strategies/weights/signal-change-defensive';
import * as signalConfluence from '../strategies/weights/signal-confluence';
import * as smaCrossover from '../strategies/weights/sma-crossover';
import * as smaDaily from '../strategies/weights/sma-daily';
import * as stochasticOscillator from '../strategies/weights/stochastic-oscillator';
import * as volTargetMomentum from '../strategies/weights/vol-target-momentum';
import * as volTargetTrend from '../strategies/weights/vol-target-trend';
import * as weeklyRsiReversion from '../strategies/weights/weekly-rsi-reversion';
import * as bracketRsiReversion from '../strategies/orders/bracket-rsi-reversion';
import * as bracketTrend from '../strategies/orders/bracket-trend';
import * as futuresDonchianContracts from '../strategies/orders/futures-donchian-contracts';
import * as fxMomentumLots from '../strategies/orders/fx-momentum-lots';
import * as intraday30mStopBreakout from '../strategies/orders/intraday-30m-stop-breakout';
import * as intraday5mBracketReversion from '../strategies/orders/intraday-5m-bracket-reversion';
import * as limitRsiDip from '../strategies/orders/limit-rsi-dip';
import * as limitTrendPullback from '../strategies/orders/limit-trend-pullback';
import * as marketRsiReversion from '../strategies/orders/market-rsi-reversion';
import * as marketSmaCross from '../strategies/orders/market-sma-cross';
import * as monthlyRotationOrders from '../strategies/orders/monthly-rotation-orders';
import * as ocoDipOrBreakout from '../strategies/orders/oco-dip-or-breakout';
import * as signalChangeRotationOrders from '../strategies/orders/signal-change-rotation-orders';
import * as stopBreakoutEntry from '../strategies/orders/stop-breakout-entry';
import * as stopLimitBreakout from '../strategies/orders/stop-limit-breakout';
import * as stopLimitProtection from '../strategies/orders/stop-limit-protection';
import * as stopLossProtection from '../strategies/orders/stop-loss-protection';
import * as trailingStopLimit from '../strategies/orders/trailing-stop-limit';
import * as trailingStopRsi from '../strategies/orders/trailing-stop-rsi';
import * as trailingStopTrend from '../strategies/orders/trailing-stop-trend';

export type StrategyMode = 'weights' | 'orders';

export interface StrategyEntry {
  id: string;
  mode: StrategyMode;
  config: StrategyConfig;
  minAssets: number;
  maxAssets?: number;
  /** Logic names specific tickers, so only the template's universe works. */
  fixedUniverse?: boolean;
  /**
   * Sizing reads FX lot sizes or futures multipliers from the contract spec,
   * which only resolve for `XXXYYY=X` / `XX=F` style symbols.
   */
  assetClass?: 'fx' | 'futures';
  create(config: StrategyConfig): Strategy;
}

type Options = Pick<
  StrategyEntry,
  'minAssets' | 'maxAssets' | 'fixedUniverse' | 'assetClass'
>;

function def(
  id: string,
  mode: StrategyMode,
  mod: { config: StrategyConfig },
  Cls: new (config: StrategyConfig) => Strategy,
  options: Partial<Options> = {},
): StrategyEntry {
  return {
    id,
    mode,
    config: mod.config,
    minAssets: 1,
    ...options,
    create: (config) => new Cls(config),
  };
}

const PAIR = { minAssets: 2, maxAssets: 2 };
const PORTFOLIO = { minAssets: 2 };

const ENTRIES: StrategyEntry[] = [
  def('adx-trend', 'weights', adxTrend, adxTrend.ADXTrend),
  def(
    'bollinger-bands',
    'weights',
    bollingerBands,
    bollingerBands.BollingerBands,
  ),
  def(
    'bollinger-reversion',
    'weights',
    bollingerReversion,
    bollingerReversion.BollingerReversion,
  ),
  def(
    'combined-momentum',
    'weights',
    combinedMomentum,
    combinedMomentum.CombinedMomentum,
  ),
  def(
    'continuous-futures-trend',
    'weights',
    continuousFuturesTrend,
    continuousFuturesTrend.ContinuousFuturesTrend,
    { assetClass: 'futures' },
  ),
  def(
    'cross-sectional-momentum',
    'weights',
    crossSectionalMomentum,
    crossSectionalMomentum.CrossSectionalMomentum,
    { minAssets: 6 },
  ),
  def(
    'cross-sectional-reversal',
    'weights',
    crossSectionalReversal,
    crossSectionalReversal.CrossSectionalReversal,
    { minAssets: 6 },
  ),
  def(
    'daily-partial-drift',
    'weights',
    dailyPartialDrift,
    dailyPartialDrift.DailyPartialDrift,
  ),
  def('ema-crossover', 'weights', emaCrossover, emaCrossover.EMACrossover),
  def(
    'fx-cross-sectional-momentum',
    'weights',
    fxCrossSectionalMomentum,
    fxCrossSectionalMomentum.FXCrossSectionalMomentum,
    { minAssets: 2, assetClass: 'fx' },
  ),
  def(
    'fx-time-series-momentum',
    'weights',
    fxTimeSeriesMomentum,
    fxTimeSeriesMomentum.FXTimeSeriesMomentum,
    { assetClass: 'fx' },
  ),
  def(
    'intraday-1h-sma-trend',
    'weights',
    intraday1hSmaTrend,
    intraday1hSmaTrend.IntradaySMATrend1h,
  ),
  def(
    'intraday-1m-ema-scalp',
    'weights',
    intraday1mEmaScalp,
    intraday1mEmaScalp.IntradayEMAScalp1m,
  ),
  def(
    'intraday-rsi-15m',
    'weights',
    intradayRsi15m,
    intradayRsi15m.IntradayRSI15m,
  ),
  def(
    'liquidity-based',
    'weights',
    liquidityBased,
    liquidityBased.LiquidityBased,
  ),
  def('macd-signal', 'weights', macdSignal, macdSignal.MACDSignal),
  def('macd-trend', 'weights', macdTrend, macdTrend.MACDTrend),
  def('mean-reversion', 'weights', meanReversion, meanReversion.MeanReversion),
  def(
    'monthly-circuit-breaker',
    'weights',
    monthlyCircuitBreaker,
    monthlyCircuitBreaker.MonthlyCircuitBreaker,
  ),
  def(
    'monthly-drift-etf',
    'weights',
    monthlyDriftEtf,
    monthlyDriftEtf.MonthlyDriftETFTrend,
  ),
  def(
    'monthly-inverse-vol',
    'weights',
    monthlyInverseVol,
    monthlyInverseVol.MonthlyInverseVol,
    PORTFOLIO,
  ),
  def(
    'pairs-hedge-ratio',
    'weights',
    pairsHedgeRatio,
    pairsHedgeRatio.PairsHedgeRatio,
    PAIR,
  ),
  def(
    'pairs-ratio-zscore',
    'weights',
    pairsRatioZscore,
    pairsRatioZscore.PairsRatioZScore,
    PAIR,
  ),
  def(
    'pattern-recognition',
    'weights',
    patternRecognition,
    patternRecognition.PatternRecognition,
  ),
  def(
    'quarterly-dual-momentum',
    'weights',
    quarterlyDualMomentum,
    quarterlyDualMomentum.QuarterlyDualMomentum,
    PORTFOLIO,
  ),
  def(
    'quarterly-te-cost-gate',
    'weights',
    quarterlyTeCostGate,
    quarterlyTeCostGate.QuarterlyTECostGate,
    PORTFOLIO,
  ),
  def(
    'risk-parity-capped',
    'weights',
    riskParityCapped,
    riskParityCapped.RiskParityCapped,
    PORTFOLIO,
  ),
  def(
    'risk-parity-multiasset',
    'weights',
    riskParityMultiasset,
    riskParityMultiasset.RiskParityMultiAsset,
    PORTFOLIO,
  ),
  def(
    'rsi-oversold-overbought',
    'weights',
    rsiOversoldOverbought,
    rsiOversoldOverbought.RSIOversoldOverbought,
  ),
  def(
    'signal-change-defensive',
    'weights',
    signalChangeDefensive,
    signalChangeDefensive.SignalChangeDefensiveRotation,
    { fixedUniverse: true },
  ),
  def(
    'signal-confluence',
    'weights',
    signalConfluence,
    signalConfluence.SignalConfluence,
  ),
  def('sma-crossover', 'weights', smaCrossover, smaCrossover.SMACrossover),
  def('sma-daily', 'weights', smaDaily, smaDaily.DailySMATrend),
  def(
    'stochastic-oscillator',
    'weights',
    stochasticOscillator,
    stochasticOscillator.StochasticOscillator,
  ),
  def(
    'vol-target-momentum',
    'weights',
    volTargetMomentum,
    volTargetMomentum.VolTargetMomentum,
    PORTFOLIO,
  ),
  def(
    'vol-target-trend',
    'weights',
    volTargetTrend,
    volTargetTrend.VolTargetTrend,
  ),
  def(
    'weekly-rsi-reversion',
    'weights',
    weeklyRsiReversion,
    weeklyRsiReversion.WeeklyRSIReversion,
  ),
  def(
    'bracket-rsi-reversion',
    'orders',
    bracketRsiReversion,
    bracketRsiReversion.BracketRSIReversion,
  ),
  def('bracket-trend', 'orders', bracketTrend, bracketTrend.BracketTrend),
  def(
    'futures-donchian-contracts',
    'orders',
    futuresDonchianContracts,
    futuresDonchianContracts.FuturesDonchianContracts,
    { assetClass: 'futures' },
  ),
  def(
    'fx-momentum-lots',
    'orders',
    fxMomentumLots,
    fxMomentumLots.FXMomentumLots,
    { assetClass: 'fx' },
  ),
  def(
    'intraday-30m-stop-breakout',
    'orders',
    intraday30mStopBreakout,
    intraday30mStopBreakout.IntradayStopBreakout30m,
  ),
  def(
    'intraday-5m-bracket-reversion',
    'orders',
    intraday5mBracketReversion,
    intraday5mBracketReversion.IntradayBracketReversion5m,
  ),
  def('limit-rsi-dip', 'orders', limitRsiDip, limitRsiDip.LimitRSIDipBuyer),
  def(
    'limit-trend-pullback',
    'orders',
    limitTrendPullback,
    limitTrendPullback.LimitTrendPullback,
  ),
  def(
    'market-rsi-reversion',
    'orders',
    marketRsiReversion,
    marketRsiReversion.MarketRSIReversion,
  ),
  def(
    'market-sma-cross',
    'orders',
    marketSmaCross,
    marketSmaCross.MarketSMACrossover,
  ),
  def(
    'monthly-rotation-orders',
    'orders',
    monthlyRotationOrders,
    monthlyRotationOrders.MonthlyRotationOrders,
    PORTFOLIO,
  ),
  def(
    'oco-dip-or-breakout',
    'orders',
    ocoDipOrBreakout,
    ocoDipOrBreakout.OCODipOrBreakout,
  ),
  def(
    'signal-change-rotation-orders',
    'orders',
    signalChangeRotationOrders,
    signalChangeRotationOrders.SignalChangeRotationOrders,
  ),
  def(
    'stop-breakout-entry',
    'orders',
    stopBreakoutEntry,
    stopBreakoutEntry.StopBreakoutEntry,
  ),
  def(
    'stop-limit-breakout',
    'orders',
    stopLimitBreakout,
    stopLimitBreakout.StopLimitBreakout,
  ),
  def(
    'stop-limit-protection',
    'orders',
    stopLimitProtection,
    stopLimitProtection.StopLimitProtection,
  ),
  def(
    'stop-loss-protection',
    'orders',
    stopLossProtection,
    stopLossProtection.ProtectiveStopLoss,
  ),
  def(
    'trailing-stop-limit',
    'orders',
    trailingStopLimit,
    trailingStopLimit.TrailingStopLimitTrend,
  ),
  def(
    'trailing-stop-rsi',
    'orders',
    trailingStopRsi,
    trailingStopRsi.TrailingStopRSI,
  ),
  def(
    'trailing-stop-trend',
    'orders',
    trailingStopTrend,
    trailingStopTrend.TrailingStopTrend,
  ),
];

export const REGISTRY: ReadonlyMap<string, StrategyEntry> = new Map(
  ENTRIES.map((e) => [e.id, e]),
);

export function getStrategy(id: string): StrategyEntry {
  const entry = REGISTRY.get(id);
  if (!entry)
    throw new Error(
      `Unknown strategy "${id}". Known: ${[...REGISTRY.keys()].join(', ')}`,
    );
  return entry;
}
