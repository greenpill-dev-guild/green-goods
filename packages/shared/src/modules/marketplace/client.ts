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
  type Addresses,
  addressesByNetwork,
  ChainId,
  HypercertExchangeClient,
} from "@hypercerts-org/marketplace-sdk";
import { JsonRpcProvider } from "ethers";
import type { Address, PublicClient } from "viem";

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

// ---------------------------------------------------------------------------
// On-chain nonce fetching
// ---------------------------------------------------------------------------

/** Minimal ABI for reading user nonces from the HypercertExchange contract. */
const USER_BID_ASK_NONCES_ABI = [
  {
    type: "function",
    name: "userBidAskNonces",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "bidNonce", type: "uint256" },
      { name: "askNonce", type: "uint256" },
    ],
  },
] as const;

/**
 * Per-chain, per-session order nonce counters.
 *
 * LooksRare V2 `orderNonce` is chosen by the user and must be unique per order.
 * Each chain gets its own counter seeded from `Date.now()` on first access,
 * then incremented for each listing within the same session. This prevents
 * nonce leakage when a user switches chains mid-session.
 */
const sessionOrderNonces = new Map<number, bigint>();

/**
 * Fetch the signer's global (bid/ask) nonces from the HypercertExchange contract
 * and generate a unique per-session order nonce.
 *
 * The LooksRare V2 exchange tracks:
 * - `bidNonce` — global nonce for bid orders
 * - `askNonce` — global nonce for ask orders (used as globalNonce in MakerAsk)
 *
 * `orderNonce` is user-chosen and must be unique per order — we use a
 * per-session counter seeded from `Date.now()` to guarantee uniqueness.
 */
export async function getOrderNonces(
  signer: Address,
  chainId: number,
  publicClient: PublicClient
): Promise<{ globalNonce: bigint; orderNonce: bigint }> {
  const addresses = getMarketplaceAddresses(chainId);
  if (!addresses) throw new Error(`Marketplace not supported on chain ${chainId}`);

  const [bidNonce, askNonce] = (await publicClient.readContract({
    address: addresses.EXCHANGE_V2 as Address,
    abi: USER_BID_ASK_NONCES_ABI,
    functionName: "userBidAskNonces",
    args: [signer],
  })) as [bigint, bigint];

  let nonce = sessionOrderNonces.get(chainId);
  if (nonce === undefined) {
    nonce = BigInt(Date.now());
  }
  const orderNonce = nonce;
  sessionOrderNonces.set(chainId, nonce + 1n);

  log.debug("Fetched order nonces", {
    signer,
    chainId,
    bidNonce: bidNonce.toString(),
    askNonce: askNonce.toString(),
    orderNonce: orderNonce.toString(),
  });

  return { globalNonce: askNonce, orderNonce };
}

/**
 * Clear all cached clients. Useful for testing or chain switching.
 */
export function resetMarketplaceClients(): void {
  clientCache.clear();
  sessionOrderNonces.clear();
}
