/**
 * AAVE V3 utilities for strategy rate display.
 *
 * Vaults deploy funds into AAVE V3 lending pools. This module provides:
 * - Minimal ABI for reading reserve data (liquidity rate)
 * - Ray-to-APY conversion (AAVE uses 1e27 fixed-point "ray" units)
 * - APY formatting helpers
 */

/** Minimal ABI — only `getReserveData(address)` for reading the live liquidity rate. */
export const AAVE_V3_POOL_ABI = [
  {
    type: "function",
    name: "getReserveData",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;

/** AAVE ray unit: 1e27 (27 decimal fixed-point). */
export const RAY = 10n ** 27n;

/** Seconds in a standard year (365 days). */
const SECONDS_PER_YEAR = 31_536_000;

/**
 * Converts an AAVE V3 liquidity rate (ray, 1e27) to an annual percentage yield.
 *
 * Formula: APY = (1 + rate / 1e27) ^ secondsPerYear - 1
 * Returns as a percentage (e.g., 2.1 for 2.1%).
 */
export function rayToApy(liquidityRate: bigint): number {
  // Convert ray to a per-second rate as a float
  const ratePerSecond = Number(liquidityRate) / Number(RAY);
  // Compound over a year
  const apy = Math.pow(1 + ratePerSecond, SECONDS_PER_YEAR) - 1;
  return apy * 100;
}

/** Formats an APY value to 2 decimal places with "%" suffix. */
export function formatApy(apy: number): string {
  return `${apy.toFixed(2)}%`;
}
