import { isAddress, type Address, type PublicClient } from "viem";
import { createPublicClientForChain } from "../../config/pimlico";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";

export type ResolveEnsOptions = {
  /** Preferred chain id for ENS lookup. Defaults to DEFAULT_CHAIN_ID. */
  chainId?: number;
  /**
   * Optional fallback chain id used when the primary lookup fails or returns null.
   * Useful for chains without ENS data (e.g. L2s) – default is Ethereum mainnet.
   */
  fallbackChainId?: number;
};

export type ResolveEnsAddressOptions = {
  chainId?: number;
  fallbackChainId?: number;
};

const clientCache = new Map<number, PublicClient>();

function getClient(chainId: number): PublicClient {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const client = createPublicClientForChain(chainId);
  clientCache.set(chainId, client);
  return client;
}

async function fetchEnsNameForChain(address: Address, chainId: number): Promise<string | null> {
  try {
    const client = getClient(chainId);
    return await client.getEnsName({ address });
  } catch {
    return null;
  }
}

async function fetchEnsAddressForChain(name: string, chainId: number): Promise<Address | null> {
  try {
    const client = getClient(chainId);
    const resolved = await client.getEnsAddress({ name });
    return resolved ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the primary ENS name for a given address while adhering to the single-chain rule.
 * Falls back to mainnet lookups when the default chain lacks ENS data.
 */
export async function resolveEnsName(
  address?: string | null,
  options: ResolveEnsOptions = {}
): Promise<string | null> {
  if (!address || !isAddress(address)) {
    return null;
  }

  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const fallbackChainId = options.fallbackChainId ?? 1; // Ethereum mainnet

  const normalized = address as Address;

  // If we're already pointing at the fallback chain (mainnet), resolve directly.
  if (chainId === fallbackChainId) {
    return fetchEnsNameForChain(normalized, fallbackChainId);
  }

  // Prefer mainnet lookups to avoid unsupported chain errors.
  if (chainId === 1) {
    const mainnetResult = await fetchEnsNameForChain(normalized, chainId);
    if (mainnetResult) return mainnetResult;
  }

  // For non-mainnet chains, skip directly to fallback (mainnet).
  return fetchEnsNameForChain(normalized, fallbackChainId);
}

export async function resolveEnsAddress(
  name?: string | null,
  options: ResolveEnsAddressOptions = {}
): Promise<Address | null> {
  if (!name) return null;

  const normalized = name.endsWith(".eth") ? name : `${name}.eth`;

  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const fallbackChainId = options.fallbackChainId ?? 1;

  if (chainId === fallbackChainId) {
    return fetchEnsAddressForChain(normalized, fallbackChainId);
  }

  if (chainId === 1) {
    const mainnetResult = await fetchEnsAddressForChain(normalized, chainId);
    if (mainnetResult) return mainnetResult;
  }

  return fetchEnsAddressForChain(normalized, fallbackChainId);
}

async function fetchEnsAvatarForChain(address: Address, chainId: number): Promise<string | null> {
  try {
    const client = getClient(chainId);
    return await client.getEnsAvatar({ name: await client.getEnsName({ address }) ?? undefined });
  } catch {
    return null;
  }
}

/**
 * Resolves the ENS avatar for a given address.
 * Falls back to mainnet lookups when the default chain lacks ENS data.
 */
export async function resolveEnsAvatar(
  address?: string | null,
  options: ResolveEnsOptions = {}
): Promise<string | null> {
  if (!address || !isAddress(address)) {
    return null;
  }

  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const fallbackChainId = options.fallbackChainId ?? 1; // Ethereum mainnet

  const normalized = address as Address;

  // If we're already pointing at the fallback chain (mainnet), resolve directly.
  if (chainId === fallbackChainId) {
    return fetchEnsAvatarForChain(normalized, fallbackChainId);
  }

  // Prefer mainnet lookups to avoid unsupported chain errors.
  if (chainId === 1) {
    const mainnetResult = await fetchEnsAvatarForChain(normalized, chainId);
    if (mainnetResult) return mainnetResult;
  }

  // For non-mainnet chains, skip directly to fallback (mainnet).
  return fetchEnsAvatarForChain(normalized, fallbackChainId);
}
