/**
 * Marketplace SDK Client
 *
 * Lazy-init HypercertExchangeClient per chain (singleton pattern).
 * Bridges the @hypercerts-org/marketplace-sdk (ethers-based) with
 * our viem-based codebase.
 *
 * @module modules/marketplace/client
 */

import {
  HypercertExchangeClient,
  type Addresses,
  ChainId,
  addressesByNetwork,
} from "@hypercerts-org/marketplace-sdk";
import { JsonRpcProvider } from "ethers";

import { createLogger } from "../app/logger";

const log = createLogger({ source: "marketplace/client" });

// ---------------------------------------------------------------------------
// Supported chain lookup
// ---------------------------------------------------------------------------

/** Set of chain IDs the marketplace SDK supports */
const SUPPORTED_CHAIN_IDS = new Set<number>(Object.values(ChainId) as number[]);

/**
 * Check whether the marketplace SDK supports a given chain.
 */
export function isMarketplaceSupported(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.has(chainId);
}

/**
 * Get marketplace contract addresses for a chain, or null if unsupported.
 */
export function getMarketplaceAddresses(chainId: number): Addresses | null {
  if (!isMarketplaceSupported(chainId)) return null;
  return addressesByNetwork[chainId as ChainId] ?? null;
}

// ---------------------------------------------------------------------------
// Singleton client map
// ---------------------------------------------------------------------------

const clientCache = new Map<number, HypercertExchangeClient>();

/**
 * Get a default RPC URL for the chain.
 * In a browser context, this falls back to public RPCs.
 */
function getDefaultRpcUrl(chainId: number): string {
  switch (chainId) {
    case 11155111:
      return "https://rpc.sepolia.org";
    case 10:
      return "https://mainnet.optimism.io";
    case 42220:
      return "https://forno.celo.org";
    case 42161:
      return "https://arb1.arbitrum.io/rpc";
    case 84532:
      return "https://sepolia.base.org";
    case 421614:
      return "https://sepolia-rollup.arbitrum.io/rpc";
    default:
      return "https://rpc.sepolia.org";
  }
}

/**
 * Get or create a HypercertExchangeClient for the given chain.
 * Returns null if the chain is not supported by the marketplace SDK.
 *
 * The client is created with a read-only ethers Provider (no signer).
 * Signing is handled separately via viem walletClient in `signing.ts`.
 */
export function getMarketplaceClient(chainId: number): HypercertExchangeClient | null {
  if (!isMarketplaceSupported(chainId)) {
    log.debug("Chain not supported by marketplace SDK", { chainId });
    return null;
  }

  const cached = clientCache.get(chainId);
  if (cached) return cached;

  try {
    const rpcUrl = getDefaultRpcUrl(chainId);
    const provider = new JsonRpcProvider(rpcUrl);

    const client = new HypercertExchangeClient(chainId as ChainId, provider);
    clientCache.set(chainId, client);

    log.info("Created marketplace client", {
      chainId,
      exchange: client.addresses.EXCHANGE_V2,
    });

    return client;
  } catch (error) {
    log.error("Failed to create marketplace client", {
      chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Clear all cached clients. Useful for testing or chain switching.
 */
export function resetMarketplaceClients(): void {
  clientCache.clear();
}
