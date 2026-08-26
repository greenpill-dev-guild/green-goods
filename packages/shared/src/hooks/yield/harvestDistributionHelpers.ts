import { getTransactionReceipt, readContract, type Config } from "@wagmi/core";
import { parseEventLogs, type Hex } from "viem";
import { logger } from "../../modules/app/logger";
import type { Address } from "../../types/domain";
import { OCTANT_MODULE_ABI, OCTANT_VAULT_ABI } from "../../utils/blockchain/abis/octant";
import { YIELD_SPLITTER_ABI } from "../../utils/blockchain/abis/yield";
import type { HarvestDistributionParams } from "./useHarvestDistribution";
import type { YieldDistributionAmounts } from "./useYieldStatus";

interface DistributionSnapshot {
  availableAmount: bigint;
  threshold: bigint;
}

export type HarvestReceiptFailure = "report_failed" | "registration_failed" | "unverifiable";

export const HARVEST_FAILURE_ERROR_CATEGORY: Record<HarvestReceiptFailure, string> = {
  report_failed: "harvest_report_failed",
  registration_failed: "shares_registration_failed",
  unverifiable: "harvest_unverifiable",
};

/**
 * The verified on-chain outcome of a confirmed `splitYield()` transaction.
 *
 * `splitYield()` succeeds without distributing when the redeemed yield lands
 * below the threshold — it emits `YieldAccumulated` instead of `YieldSplit` —
 * so a confirmed transaction alone never proves a distribution happened.
 *
 * A readable receipt with neither event means the inner call did not execute:
 * an executed split always emits exactly one of the two, but a smart-account
 * UserOperation (and some wallet paths) can produce a successful transaction
 * receipt around a reverted inner call. That is `reverted` — a real, retryable
 * failure. `unknown` is reserved for an unreadable receipt, where the split
 * may well have succeeded and must not be blindly retried.
 */
export type DistributionOutcome =
  | { kind: "split"; amounts: YieldDistributionAmounts }
  | { kind: "accumulated"; totalPending: bigint }
  | { kind: "reverted" }
  | { kind: "unknown" };

export function isCanonicalTransactionHash(hash: string): hash is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export async function readDistributionSnapshot(
  config: Config,
  chainId: number,
  yieldSplitter: Address,
  params: HarvestDistributionParams
): Promise<DistributionSnapshot> {
  const common = { address: yieldSplitter, abi: YIELD_SPLITTER_ABI, chainId } as const;
  const [shares, pendingYield, assetThreshold, globalThreshold, registeredVault] =
    await Promise.all([
      readContract(config, {
        ...common,
        functionName: "gardenShares",
        args: [params.gardenAddress, params.vaultAddress],
      }),
      readContract(config, {
        ...common,
        functionName: "pendingYield",
        args: [params.gardenAddress, params.assetAddress],
      }),
      readContract(config, {
        ...common,
        functionName: "assetYieldThresholds",
        args: [params.assetAddress],
      }),
      readContract(config, { ...common, functionName: "minYieldThreshold", args: [] }),
      readContract(config, {
        ...common,
        functionName: "gardenVaults",
        args: [params.gardenAddress, params.assetAddress],
      }),
    ]);

  if ((registeredVault as Address).toLowerCase() !== params.vaultAddress.toLowerCase()) {
    throw new Error("Registered yield vault does not match the selected vault");
  }

  const registeredShares = shares as bigint;
  const shareAssets =
    registeredShares > 0n
      ? ((await readContract(config, {
          address: params.vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "convertToAssets",
          args: [registeredShares],
          chainId,
        })) as bigint)
      : 0n;
  const effectiveThreshold =
    (assetThreshold as bigint) > 0n ? (assetThreshold as bigint) : (globalThreshold as bigint);

  return {
    availableAmount: shareAssets + (pendingYield as bigint),
    threshold: effectiveThreshold,
  };
}

export async function readDistributionOutcome(
  config: Config,
  chainId: number,
  yieldSplitter: Address,
  hash: Hex,
  gardenAddress: Address,
  assetAddress: Address
): Promise<DistributionOutcome> {
  try {
    const receipt = await getTransactionReceipt(config, { hash, chainId });
    const splitEvents = parseEventLogs({
      abi: YIELD_SPLITTER_ABI,
      logs: receipt.logs,
      eventName: "YieldSplit",
    });
    const splitEvent = splitEvents.find(
      (candidate) =>
        candidate.address.toLowerCase() === yieldSplitter.toLowerCase() &&
        candidate.args.garden.toLowerCase() === gardenAddress.toLowerCase() &&
        candidate.args.asset.toLowerCase() === assetAddress.toLowerCase()
    );
    if (splitEvent) {
      return {
        kind: "split",
        amounts: {
          cookieJarAmount: splitEvent.args.cookieJarAmount,
          fractionsAmount: splitEvent.args.fractionsAmount,
          treasuryAmount: splitEvent.args.juiceboxAmount,
          totalAmount: splitEvent.args.totalYield,
        },
      };
    }
    const accumulatedEvents = parseEventLogs({
      abi: YIELD_SPLITTER_ABI,
      logs: receipt.logs,
      eventName: "YieldAccumulated",
    });
    const accumulatedEvent = accumulatedEvents.find(
      (candidate) =>
        candidate.address.toLowerCase() === yieldSplitter.toLowerCase() &&
        candidate.args.garden.toLowerCase() === gardenAddress.toLowerCase() &&
        candidate.args.asset.toLowerCase() === assetAddress.toLowerCase()
    );
    if (accumulatedEvent) {
      return { kind: "accumulated", totalPending: accumulatedEvent.args.totalPending };
    }
    return { kind: "reverted" };
  } catch (error) {
    logger.warn("Could not verify splitYield outcome from the transaction receipt", {
      error,
      hash,
    });
    return { kind: "unknown" };
  }
}

/**
 * Inspect a confirmed `Octant.harvest()` receipt for failure events.
 *
 * The module deliberately catches `process_report()` and `registerShares()`
 * reverts and emits `HarvestReportFailed` / `SharesRegistrationFailed` while
 * the transaction itself still succeeds, so a confirmed receipt alone does not
 * prove the yield was reported or registered. Returns `null` only when the
 * receipt was read and carries no failure event. An unreadable receipt returns
 * `"unverifiable"` — the failure events are the only signal that a harvest
 * silently failed, so the workflow must stop rather than proceed fail-open.
 */
export async function readHarvestReceiptFailure(
  config: Config,
  chainId: number,
  octantModule: Address,
  hash: Hex,
  gardenAddress: Address,
  assetAddress: Address
): Promise<HarvestReceiptFailure | null> {
  try {
    const receipt = await getTransactionReceipt(config, { hash, chainId });
    const events = parseEventLogs({
      abi: OCTANT_MODULE_ABI,
      logs: receipt.logs,
      eventName: ["HarvestReportFailed", "SharesRegistrationFailed"],
    });
    const moduleEvents = events.filter(
      (candidate) =>
        candidate.address.toLowerCase() === octantModule.toLowerCase() &&
        candidate.args.garden.toLowerCase() === gardenAddress.toLowerCase()
    );
    if (
      moduleEvents.some(
        (candidate) =>
          candidate.eventName === "HarvestReportFailed" &&
          candidate.args.asset.toLowerCase() === assetAddress.toLowerCase()
      )
    ) {
      return "report_failed";
    }
    if (moduleEvents.some((candidate) => candidate.eventName === "SharesRegistrationFailed")) {
      return "registration_failed";
    }
    return null;
  } catch (error) {
    logger.warn("Could not inspect the harvest receipt for failure events", { error, hash });
    return "unverifiable";
  }
}
