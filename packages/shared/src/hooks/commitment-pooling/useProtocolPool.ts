/**
 * useProtocolPool Hook
 *
 * The Green Goods protocol pool: the pool registered for the root garden,
 * read from the module (`protocolPoolId()`, `rootGarden()`). Two surfaces
 * need it: Community → Pools renders the protocol pool console for protocol
 * stewards, and the seeding console's "let the Green Goods team confirm"
 * choice is disabled with a repair path while no protocol pool is registered.
 *
 * `protocolPoolId() == 0` means unregistered, which is a real state the
 * console names, not an error.
 *
 * @module hooks/commitment-pooling/useProtocolPool
 */

import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";

import { getWagmiConfig } from "../../config/appkit";
import { getNetworkConfig } from "../../config/blockchain";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import type { Address } from "../../types/domain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { CommitmentPoolingModuleABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { useCommitmentPools } from "./useCommitmentPooling";
import { useCommitmentPoolingAvailability } from "./useCommitmentPoolingAvailability";

export interface ProtocolPool {
  /** Null while no protocol pool is registered. */
  poolId: bigint | null;
  rootGarden: Address | null;
}

async function readProtocolPool(chainId: number): Promise<ProtocolPool> {
  const moduleAddress = getNetworkContracts(chainId).commitmentPoolingModule;
  const config = getWagmiConfig();
  const [poolId, rootGarden] = await Promise.all([
    readContract(config, {
      address: moduleAddress,
      abi: CommitmentPoolingModuleABI,
      functionName: "protocolPoolId",
      chainId,
    }),
    readContract(config, {
      address: moduleAddress,
      abi: CommitmentPoolingModuleABI,
      functionName: "rootGarden",
      chainId,
    }),
  ]);
  const id = BigInt((poolId as bigint | number | undefined) ?? 0);
  const garden = typeof rootGarden === "string" ? (rootGarden.toLowerCase() as Address) : null;
  return {
    poolId: id === 0n ? null : id,
    rootGarden: garden && !isZeroAddress(garden) ? garden : null,
  };
}

export function useProtocolPool(input: { chainId: number }) {
  const availability = useCommitmentPoolingAvailability(input);
  const moduleAddress = getNetworkContracts(input.chainId).commitmentPoolingModule;
  const query = useQuery({
    queryKey: commitmentPoolingKeys.protocolPool(input.chainId),
    queryFn: () => readProtocolPool(input.chainId),
    enabled: availability.status === "available" && !isZeroAddress(moduleAddress),
    staleTime: STALE_TIME_MEDIUM,
  });
  return {
    ...query,
    poolId: query.data?.poolId ?? null,
    rootGarden: query.data?.rootGarden ?? null,
    isRegistered: query.data?.poolId !== null && query.data?.poolId !== undefined,
    availability,
  };
}

/**
 * Whether a garden is the Green Goods Community Garden, whose pool is the
 * protocol pool. The deployment configures the root garden, the chain names it
 * through the protocol pool, and the index names the pool's type; any one is
 * enough, so a network without pooling or a failed chain read does not hide
 * the protocol's surfaces from the one garden that owns them.
 */
export function isProtocolGarden(input: {
  gardenId: string | null | undefined;
  rootGarden: Address | null;
  ownPoolType: string | null | undefined;
  configuredRootGarden?: string | null;
}): boolean {
  if (!input.gardenId) return false;
  const gardenId = input.gardenId.toLowerCase();
  return (
    (input.rootGarden !== null && input.rootGarden.toLowerCase() === gardenId) ||
    (Boolean(input.configuredRootGarden) &&
      input.configuredRootGarden?.toLowerCase() === gardenId) ||
    input.ownPoolType === "PROTOCOL"
  );
}

/**
 * The protocol pool, the garden's own pool, and whether the garden is the
 * protocol's: the one test every protocol-level Community surface shares
 * (Pools' protocol operations, Payouts' campaign cookie jars).
 */
export function useIsProtocolGarden(input: { chainId: number; gardenId: Address }) {
  const protocolPool = useProtocolPool({ chainId: input.chainId });
  const ownPools = useCommitmentPools({ chainId: input.chainId, garden: input.gardenId });
  const ownPool = ownPools.pools[0] ?? null;
  return {
    isProtocolGarden: isProtocolGarden({
      gardenId: input.gardenId,
      rootGarden: protocolPool.rootGarden,
      ownPoolType: ownPool?.poolType,
      configuredRootGarden: getNetworkConfig(input.chainId).rootGarden?.address ?? null,
    }),
    protocolPool,
    ownPool,
    ownPoolsLoading: ownPools.isLoading,
  };
}
