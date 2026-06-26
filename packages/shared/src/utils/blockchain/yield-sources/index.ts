/**
 * Yield-source APY adapters for the `/vaults` strategy-APY read.
 *
 * Each adapter resolves a campaign vault's external yield source — recorded in
 * the manifest as `OctantVaultYieldSource` because the deployed strategy exposes
 * no source getter — to a live gross APY. The registry is extensible; an
 * unrecognized source kind yields no adapter, so {@link useOctantVaultStrategyApy}
 * renders an honest "unsupported source" state rather than inventing a rate.
 *
 * @module utils/blockchain/yield-sources
 */
import type { Address } from "../../../types/domain";
import { yearnV3Adapter } from "./yearn-v3-adapter";

/** Protocol family of an external yield source. Single source of truth for the manifest + adapters. */
export type YieldSourceKind = "yearn-v3" | "aave-v3" | "lido" | "unknown";

export interface YieldSourceApyResult {
  /** Gross annualized rate as a percentage (e.g. `1.43` for 1.43%). */
  apy: number;
  /** Non-compounded annual rate as a percentage. */
  apr: number;
  kind: YieldSourceKind;
}

export interface YieldSourceApyParams {
  /** Address of the external yield source (e.g. the inner Yearn V3 vault). */
  sourceAddress: Address;
  /** Vault asset, when an adapter needs it (e.g. an Aave reserve lookup). */
  assetAddress?: Address;
  /** Chain the source lives on. */
  chainId: number;
}

export interface YieldSourceAdapter {
  kind: YieldSourceKind;
  matches(kind: YieldSourceKind): boolean;
  /** Resolve the source's live gross APY. Throws on any read failure (caller maps to unavailable). */
  readApy(params: YieldSourceApyParams): Promise<YieldSourceApyResult>;
}

/** Ordered adapter registry; first `matches()` wins. */
export const YIELD_SOURCE_ADAPTERS: readonly YieldSourceAdapter[] = [yearnV3Adapter];

export function findYieldSourceAdapter(kind: YieldSourceKind): YieldSourceAdapter | null {
  return YIELD_SOURCE_ADAPTERS.find((adapter) => adapter.matches(kind)) ?? null;
}
