// Ported from backtester/risk/__init__.py (QuantJourney Backtester, Apache 2.0).

import type { RiskModel as RiskModelSpec, StrategyConfig } from '../../core/index';
import { type RiskModel, RiskModelChain } from './base';
import { InverseVolModel } from './inverse-vol';
import { PositionLimitModel } from './position-limit';
import { RiskParityModel } from './risk-parity';
import { VolTargetModel } from './vol-target';

export * from './base';
export * from './inverse-vol';
export * from './position-limit';
export * from './pre-trade';
export * from './risk-parity';
export { rescoreMask } from './util';
export * from './vol-target';

/**
 * core's RiskModel config union widened with the options the Python classes
 * accept but core does not declare (all optional), plus inverse_vol.
 */
export type ExtendedRiskModelSpec =
  | {
      type: 'vol_target';
      targetVol?: number;
      lookback?: number;
      maxLeverage?: number;
      rebalanceFreq?: string;
      annFactor?: number | null;
    }
  | {
      type: 'risk_parity';
      lookback?: number;
      maxIter?: number;
      tol?: number;
      rebalanceFreq?: string;
    }
  | {
      type: 'position_limit';
      maxWeight?: number;
      minWeight?: number;
      maxTotalLeverage?: number;
      sectorLimits?: Record<string, number>;
    }
  | {
      type: 'inverse_vol';
      lookback?: number;
      annFactor?: number | null;
      minVol?: number;
      blendAlpha?: boolean;
    }
  | { type: 'chain'; models: (ExtendedRiskModelSpec | RiskModelSpec)[] };

export function buildRiskModel(
  spec: ExtendedRiskModelSpec | RiskModelSpec,
): RiskModel {
  switch (spec.type) {
    case 'vol_target':
      return new VolTargetModel(spec);
    case 'risk_parity':
      return new RiskParityModel(spec);
    case 'position_limit':
      return new PositionLimitModel(spec);
    case 'inverse_vol':
      return new InverseVolModel(spec);
    case 'chain':
      return new RiskModelChain(spec.models.map(buildRiskModel));
    default: {
      const never: never = spec;
      throw new Error(
        `Unknown risk model type: ${(never as { type: string }).type}`,
      );
    }
  }
}

/**
 * The overlay the engine applies for a config: the explicit riskModel if set,
 * else (weights mode with maxPositionSize) a per-instrument cap with no
 * leverage cap, else null.
 */
export function defaultRiskModel(config: StrategyConfig): RiskModel | null {
  if (config.riskModel) return buildRiskModel(config.riskModel);
  if (
    (config.executionMode ?? 'weights') === 'weights' &&
    config.maxPositionSize != null
  ) {
    return new PositionLimitModel({
      maxWeight: config.maxPositionSize,
      minWeight: 0,
      maxTotalLeverage: Infinity,
    });
  }
  return null;
}
