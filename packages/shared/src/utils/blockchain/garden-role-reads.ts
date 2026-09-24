import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "./contracts";
import { GARDEN_ROLE_FUNCTIONS, type GardenRole } from "./garden-roles";

/**
 * Read whether `account` holds `role` in a garden, straight from the garden
 * account's role view (works for v1 and v2 gardens). This is the chain's
 * answer, not the indexer's, so it holds even while indexed rosters lag.
 *
 * Throws when the read fails: an unknown answer is not "no", and each caller
 * decides what it means for them.
 */
export async function readGardenRole(
  gardenAddress: Address,
  account: Address,
  role: GardenRole,
  chainId: number
): Promise<boolean> {
  const result = await readContract(getWagmiConfig(), {
    address: gardenAddress,
    abi: GardenAccountABI,
    functionName: GARDEN_ROLE_FUNCTIONS[role],
    args: [account],
    chainId,
  });
  return Boolean(result);
}
