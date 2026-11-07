import { getPublicClient, simulateContract } from "@wagmi/core";
import { BaseError, ContractFunctionRevertedError } from "viem";
import type { Address } from "../../types/domain";
import { getWagmiConfig } from "../../config/appkit";
import { HATS_MODULE_ABI } from "../../utils/blockchain/abis/hats";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";

class GardenLeaveUnavailableError extends Error {}

/** The same fresh code check and simulation guard both the UI and the command. */
export async function simulateGardenLeave(
  address: Address,
  garden: Address,
  account: Address,
  chainId: number
) {
  const config = getWagmiConfig();
  const client = getPublicClient(config, { chainId });
  if (!client) throw new Error("Garden leave reader unavailable");
  const code = await client.getCode({ address });
  if (!code || code === "0x") throw new GardenLeaveUnavailableError("Garden leave unavailable");
  return simulateContract(config, {
    address,
    abi: HATS_MODULE_ABI,
    functionName: "leaveGarden",
    args: [garden],
    account,
    chainId,
  });
}

/** A read-only rehearsal against the actual module, never a signature or deployment claim. */
export async function readGardenLeaveAvailability(
  garden: Address,
  account: Address,
  chainId: number
): Promise<"available" | "unavailable" | "unknown"> {
  try {
    const address = await fetchHatsModuleAddress(garden, chainId, { throwOnError: true });
    if (!address) return "unavailable";
    await simulateGardenLeave(address, garden, account, chainId);
    return "available";
  } catch (error) {
    if (error instanceof GardenLeaveUnavailableError) return "unavailable";
    const revert =
      error instanceof BaseError
        ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
        : null;
    if (revert instanceof ContractFunctionRevertedError) {
      // These ABI-decoded errors prove that the leave entrypoint ran. Other
      // deterministic reverts keep self departure unavailable for this garden.
      return ["OwnerCannotLeave", "NotGardenMember"].includes(revert.data?.errorName ?? "")
        ? "available"
        : "unavailable";
    }
    return "unknown";
  }
}
