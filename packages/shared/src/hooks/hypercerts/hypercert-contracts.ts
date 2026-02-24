/**
 * Hypercert Contract Resolution
 *
 * Functions for resolving hypercert-related contract addresses
 * from the deployment registry with fallbacks.
 *
 * @module hooks/hypercerts/hypercert-contracts
 */

import { type Address, getAddress, isAddress } from "viem";

import { createPublicClientForChain } from "../../config";

/**
 * Type guard for network config response from deployment registry
 */
function isNetworkConfig(value: unknown): value is {
  hatsAccessControl: Address;
  hypercerts: Address;
} {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    "hatsAccessControl" in obj &&
    "hypercerts" in obj &&
    typeof obj.hatsAccessControl === "string" &&
    typeof obj.hypercerts === "string" &&
    isAddress(obj.hatsAccessControl) &&
    isAddress(obj.hypercerts)
  );
}
import { logger } from "../../modules/app/logger";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { DEPLOYMENT_REGISTRY_ABI } from "./hypercert-abis";
import { isZeroAddress } from "./hypercert-utils";

/**
 * Chain-specific Hypercert Minter contract addresses.
 * Used as fallback when the deployment registry is unavailable.
 *
 * @see https://github.com/hypercerts-org/hypercerts/blob/main/contracts/deployments
 */
export const HYPERCERT_MINTER_BY_CHAIN: Record<number, Address> = {
  // Testnets
  11155111: "0xa16DFb32Eb140a6f3F2AC68f41dAd8c7e83C4941", // Sepolia

  // Mainnets
  10: "0xC2d179166bc9dbB00A03686a5b17eBe2224c2704", // Optimism
  42161: "0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07", // Arbitrum (per protocol config)
  42220: "0x16bA53B74c234C870c61EFC04cD418B8f2865959", // Celo
};

/**
 * Get the Hypercert Minter address for a chain.
 * Falls back to Sepolia if chain is not supported.
 */
export function getHypercertMinterFallback(chainId: number): Address {
  const address = HYPERCERT_MINTER_BY_CHAIN[chainId];
  if (!address) {
    logger.warn("[hypercert-contracts] No Hypercert Minter fallback for chain, using Sepolia", {
      chainId,
      fallbackChainId: 11155111,
    });
    return HYPERCERT_MINTER_BY_CHAIN[11155111];
  }
  return address;
}

/**
 * Resolves hypercert-related contract addresses from the deployment registry.
 * Falls back to hardcoded addresses if the registry is unavailable.
 *
 * @param chainId - Chain ID to resolve contracts for
 * @returns Object with hypercertMinter and optional hatsModule addresses
 */
export async function resolveHypercertContracts(chainId: number): Promise<{
  hypercertMinter: Address;
  hatsModule?: Address;
}> {
  const contracts = getNetworkContracts(chainId);
  const fallbackMinter = getHypercertMinterFallback(chainId);
  const hatsModuleAddr = contracts.hatsModule as Address | undefined;
  const fallbackHatsModule =
    hatsModuleAddr && !isZeroAddress(hatsModuleAddr) ? getAddress(hatsModuleAddr) : undefined;

  // Check if deployment registry exists before casting
  if (!contracts?.deploymentRegistry) {
    logger.info(
      "[hypercert-contracts] No deployment registry in contracts config, using fallback",
      {
        chainId,
        fallbackMinter,
      }
    );
    return { hypercertMinter: fallbackMinter, hatsModule: fallbackHatsModule };
  }

  // Validate address format before casting
  if (!isAddress(contracts.deploymentRegistry)) {
    logger.error("[hypercert-contracts] Invalid deployment registry address format", {
      chainId,
      deploymentRegistry: contracts.deploymentRegistry,
      fallbackMinter,
    });
    return { hypercertMinter: fallbackMinter, hatsModule: fallbackHatsModule };
  }

  // Use getAddress for validation and checksum formatting instead of unsafe cast
  const deploymentRegistry = getAddress(contracts.deploymentRegistry);

  if (isZeroAddress(deploymentRegistry)) {
    logger.info("[hypercert-contracts] No deployment registry, using fallback Hypercert Minter", {
      chainId,
      fallbackMinter,
    });
    return {
      hypercertMinter: fallbackMinter,
      hatsModule: fallbackHatsModule,
    };
  }

  try {
    const publicClient = createPublicClientForChain(chainId);
    const config = await publicClient.readContract({
      address: deploymentRegistry,
      abi: DEPLOYMENT_REGISTRY_ABI,
      functionName: "getNetworkConfigForChain",
      args: [BigInt(chainId)],
    });

    // Validate config response structure
    if (!isNetworkConfig(config)) {
      logger.warn("[hypercert-contracts] Invalid network config response, using fallback", {
        chainId,
        config,
        fallbackMinter,
      });
      return { hypercertMinter: fallbackMinter };
    }

    return {
      hypercertMinter: !isZeroAddress(config.hypercerts)
        ? getAddress(config.hypercerts)
        : fallbackMinter,
      hatsModule: !isZeroAddress(config.hatsAccessControl)
        ? getAddress(config.hatsAccessControl)
        : fallbackHatsModule,
    };
  } catch (error) {
    logger.warn("[hypercert-contracts] Failed to read deployment registry, using fallback", {
      correlationId: `resolve-contracts-${chainId}`,
      chainId,
      deploymentRegistry,
      fallbackMinter,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      hypercertMinter: fallbackMinter,
      hatsModule: fallbackHatsModule,
    };
  }
}
