import { getPublicClient } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { HATS_MODULE_ABI } from "../../utils/blockchain/abis/hats";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { GARDEN_ROLE_HAT_FUNCTIONS, type GardenRole } from "../../utils/blockchain/garden-roles";

/** Read the exact hats at a block that includes the departure. Permission views inherit roles. */
export async function readRolesAfterDeparture(
  chainId: number,
  garden: Address,
  account: Address,
  departedAt: bigint
): Promise<{ block: bigint; roles: GardenRole[]; complete: boolean } | undefined> {
  const client = getPublicClient(getWagmiConfig(), { chainId });
  if (!client) return;
  const block = await client.getBlockNumber({ cacheTime: 0 });
  if (block < departedAt) return;
  const module = await fetchHatsModuleAddress(garden, chainId);
  if (!module) return;
  const roles = Object.keys(GARDEN_ROLE_HAT_FUNCTIONS) as GardenRole[];
  const results = await Promise.allSettled(
    roles.map((role) =>
      client.readContract({
        address: module,
        abi: HATS_MODULE_ABI,
        functionName: GARDEN_ROLE_HAT_FUNCTIONS[role],
        args: [garden, account],
        blockNumber: block,
      })
    )
  );
  if (results.every((result) => result.status === "rejected")) return;
  return {
    block,
    complete: results.every((result) => result.status === "fulfilled"),
    roles: roles.filter((_, index) => {
      const result = results[index];
      return result.status === "fulfilled" && result.value === true;
    }),
  };
}
