import { getPublicClient } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { GARDEN_ROLE_FUNCTIONS } from "../../utils/blockchain/garden-roles";

/** A lagging RPC cannot undo a confirmed departure. Every role reads the same sufficiently new block. */
export async function readMembershipAfterDeparture(
  chainId: number,
  garden: Address,
  account: Address,
  departedAt: bigint
): Promise<boolean> {
  const client = getPublicClient(getWagmiConfig(), { chainId });
  if (!client) return false;
  const head = await client.getBlockNumber({ cacheTime: 0 });
  if (head < departedAt) return false;
  const roles = await Promise.allSettled(
    Object.values(GARDEN_ROLE_FUNCTIONS).map((functionName) =>
      client.readContract({
        address: garden,
        abi: GardenAccountABI,
        functionName,
        args: [account],
        blockNumber: head,
      })
    )
  );
  return roles.some((role) => role.status === "fulfilled" && role.value === true);
}
