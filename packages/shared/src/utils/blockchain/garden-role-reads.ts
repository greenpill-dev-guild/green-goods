import { readContract } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { HATS_MODULE_ABI } from "./abis/hats";
import { GardenAccountABI } from "./contracts";
import { fetchHatsModuleAddress } from "./garden-hats";
import { GARDEN_ROLE_FUNCTIONS, GARDEN_ROLE_HAT_FUNCTIONS, type GardenRole } from "./garden-roles";

/**
 * Read whether `account` may act as `role` in a garden, from the garden
 * account's permission view (works for v1 and v2 gardens). The view applies the
 * inclusive hierarchy, so a steward reads as a gardener without the gardener
 * hat: right for permissions, wrong for "would granting this role change
 * anything" (use `readGardenRoleHat`).
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

/**
 * Whether `account` holds any of the six garden roles: the contract's own test
 * for a personal claim (`GuardLib.isGardenMember` accepts every hat), read from
 * the garden account's permission views, as the queue's send gate reads it.
 * True as soon as one read says so; null when none does and at least one read
 * failed, because an unknown answer is not "no".
 */
export async function readGardenMembership(
  gardenAddress: Address,
  account: Address,
  chainId: number,
  readRole: typeof readGardenRole = readGardenRole
): Promise<boolean | null> {
  const roles = Object.keys(GARDEN_ROLE_FUNCTIONS) as GardenRole[];
  const results = await Promise.allSettled(
    roles.map((role) => readRole(gardenAddress, account, role, chainId))
  );
  if (results.some((result) => result.status === "fulfilled" && result.value)) return true;
  return results.some((result) => result.status === "rejected") ? null : false;
}

/**
 * Read whether `account` wears the exact hat for `role` in a garden, from the
 * garden's HatsModule. This is the membership `grantRole` checks before it
 * mints, so it answers "would granting this role change anything". It is the
 * chain's answer, not the indexer's, so it holds while indexed rosters lag.
 *
 * Pass the module address when the caller already has it; otherwise it is
 * resolved from the garden. Throws when a read fails or the garden has no
 * HatsModule.
 */
export async function readGardenRoleHat(
  gardenAddress: Address,
  account: Address,
  role: GardenRole,
  chainId: number,
  hatsModuleAddress?: Address
): Promise<boolean> {
  const moduleAddress = hatsModuleAddress ?? (await fetchHatsModuleAddress(gardenAddress, chainId));
  if (!moduleAddress) throw new Error("Hats module is not configured for this garden");

  const result = await readContract(getWagmiConfig(), {
    address: moduleAddress,
    abi: HATS_MODULE_ABI,
    functionName: GARDEN_ROLE_HAT_FUNCTIONS[role],
    args: [gardenAddress, account],
    chainId,
  });
  return Boolean(result);
}
