import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import type { GardenVault, VaultDeposit, VaultEvent } from "../../types/vaults";
import { logger } from "../app/logger";
import { type RepositoryResult, vaultRepository } from "./vault-repository";

function unwrap<T>(result: RepositoryResult<T>, message: string): T {
  if (result.status === "error") throw new Error(`${message}: ${result.error.message}`);
  if (result.status === "partial") {
    logger.warn(`[vaultRepository] ${message}`, { error: result.error.message });
  }
  return result.data;
}

export async function getGardenVaults(
  gardenAddress: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<GardenVault[]> {
  return unwrap(
    await vaultRepository.getGardenVaults(gardenAddress, chainId),
    "Failed to load garden vaults"
  );
}

export async function getAllGardenVaults(
  chainId: number = DEFAULT_CHAIN_ID
): Promise<GardenVault[]> {
  return unwrap(await vaultRepository.getAllGardenVaults(chainId), "Failed to load vault catalog");
}

export async function getVaultDeposits(
  gardenAddress: string,
  chainId: number = DEFAULT_CHAIN_ID,
  depositorAddress?: string
): Promise<VaultDeposit[]> {
  return unwrap(
    await vaultRepository.getVaultDeposits(gardenAddress, chainId, depositorAddress),
    depositorAddress ? "Failed to load user vault deposits" : "Failed to load vault deposits"
  );
}

export async function getVaultDepositsByUser(
  depositorAddress: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<VaultDeposit[]> {
  return unwrap(
    await vaultRepository.getVaultDepositsByUser(depositorAddress, chainId),
    "Failed to load user vault deposits"
  );
}

export async function getVaultEvents(
  gardenAddress: string,
  chainId: number = DEFAULT_CHAIN_ID,
  limit = 100
): Promise<VaultEvent[]> {
  const result = await vaultRepository.getVaultEvents(gardenAddress, chainId, limit);
  if (result.status === "error") {
    logger.error("[getVaultEvents] Indexer query failed", { error: result.error.message });
    return [];
  }
  return result.data;
}

export async function getAllVaultDeposits(
  chainId: number = DEFAULT_CHAIN_ID
): Promise<VaultDeposit[]> {
  return unwrap(
    await vaultRepository.getAllVaultDeposits(chainId),
    "Failed to load all vault deposits"
  );
}

export {
  createVaultRepository,
  type RepositoryResult,
  type VaultRepository,
  vaultRepository,
} from "./vault-repository";
