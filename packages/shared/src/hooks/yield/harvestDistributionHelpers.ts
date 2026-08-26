import { getTransactionReceipt, readContract, type Config } from "@wagmi/core";
import { parseEventLogs, type Hex } from "viem";
import type { Address } from "../../types/domain";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis/octant";
import { YIELD_SPLITTER_ABI } from "../../utils/blockchain/abis/yield";
import type { HarvestDistributionParams } from "./useHarvestDistribution";
import type { YieldDistributionAmounts } from "./useYieldStatus";

interface DistributionSnapshot {
  availableAmount: bigint;
  threshold: bigint;
}

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

export async function readExactDistributionAmounts(
  config: Config,
  chainId: number,
  yieldSplitter: Address,
  hash: Hex,
  gardenAddress: Address,
  assetAddress: Address
): Promise<YieldDistributionAmounts | null> {
  try {
    const receipt = await getTransactionReceipt(config, { hash, chainId });
    const events = parseEventLogs({
      abi: YIELD_SPLITTER_ABI,
      logs: receipt.logs,
      eventName: "YieldSplit",
    });
    const event = events.find(
      (candidate) =>
        candidate.address.toLowerCase() === yieldSplitter.toLowerCase() &&
        candidate.args.garden.toLowerCase() === gardenAddress.toLowerCase() &&
        candidate.args.asset.toLowerCase() === assetAddress.toLowerCase()
    );
    if (!event) return null;
    return {
      cookieJarAmount: event.args.cookieJarAmount,
      fractionsAmount: event.args.fractionsAmount,
      treasuryAmount: event.args.juiceboxAmount,
      totalAmount: event.args.totalYield,
    };
  } catch {
    return null;
  }
}
