import { useReadContracts } from "wagmi";
import type { Address } from "../../types/domain";
import { YIELD_SPLITTER_ABI } from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { isZeroAddress } from "../../utils/blockchain/address";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { STALE_TIME_MEDIUM } from "../query-keys";

interface UsePendingYieldOptions {
  enabled?: boolean;
}

interface PendingYieldEntry {
  assetAddress: Address;
  amount: bigint;
}

/**
 * Reads pending (sub-threshold) yield for a garden across its vault assets.
 *
 * Pending yield accumulates in the YieldResolver when a harvest produces
 * yield below the `minYieldThreshold`. It rolls over until enough accumulates
 * to trigger a full `splitYield`.
 */
export function usePendingYield(
  gardenAddress?: Address,
  assetAddresses?: Address[],
  options: UsePendingYieldOptions = {}
) {
  const chainId = useCurrentChain();
  const yieldSplitter = getNetworkContracts(chainId).yieldSplitter as Address;
  const hasYieldSplitter = !isZeroAddress(yieldSplitter);
  const enabled =
    (options.enabled ?? true) &&
    hasYieldSplitter &&
    Boolean(gardenAddress) &&
    Boolean(assetAddresses?.length);

  const contracts = (assetAddresses ?? []).map((asset) => ({
    address: yieldSplitter,
    abi: YIELD_SPLITTER_ABI,
    functionName: "pendingYield" as const,
    args: [gardenAddress!, asset] as const,
    chainId,
  }));

  const query = useReadContracts({
    contracts: enabled ? contracts : [],
    query: {
      enabled,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  const entries: PendingYieldEntry[] = [];
  let totalPending = 0n;

  if (query.data && assetAddresses) {
    for (let i = 0; i < assetAddresses.length; i++) {
      const result = query.data[i];
      const amount = result?.status === "success" ? (result.result as bigint) : 0n;
      entries.push({ assetAddress: assetAddresses[i], amount });
      totalPending += amount;
    }
  }

  return {
    entries,
    totalPending,
    isLoading: enabled ? query.isLoading : false,
    isError: enabled ? query.isError : false,
  };
}
