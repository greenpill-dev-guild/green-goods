import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address } from "../../types/domain";
import type { YieldAllocation } from "../../types/gardens-community";
import { type RepositoryResult, vaultRepository } from "./vault-repository";

function unwrap(result: RepositoryResult<YieldAllocation[]>): YieldAllocation[] {
  if (result.status === "error") {
    throw new Error(`Failed to load yield allocations: ${result.error.message}`);
  }
  return result.data;
}

export async function getAllYieldAllocations(
  chainId: number = DEFAULT_CHAIN_ID
): Promise<YieldAllocation[]> {
  return unwrap(await vaultRepository.getAllYieldAllocations(chainId));
}

export async function getGardenYieldAllocations(
  gardenAddress: Address,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<YieldAllocation[]> {
  return unwrap(await vaultRepository.getGardenYieldAllocations(gardenAddress, chainId));
}
