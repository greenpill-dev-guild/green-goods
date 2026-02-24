import { isAddress, type Address, type PublicClient } from "viem";
import { createPublicClientForChain } from "../../config/pimlico";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { logger } from "../../modules/app/logger";

// ============================================
// Slug Validation (mirrors contract _validateSlug)
// ============================================

const SLUG_MIN_LENGTH = 3;
const SLUG_MAX_LENGTH = 50;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export interface SlugValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates an ENS subdomain slug for *.greengoods.eth registration.
 * Mirrors the on-chain _validateSlug() rules exactly for instant frontend feedback.
 *
 * Rules:
 * - Length: 3-50 characters
 * - Characters: lowercase a-z, digits 0-9, hyphens
 * - No leading or trailing hyphens
 * - No consecutive hyphens
 *
 * Sync locations: contracts/src/registries/ENS.sol _validateSlug(),
 * contracts/src/registries/ENSReceiver.sol _isValidSlug(),
 * shared/hooks/ens/useSlugForm.ts slugSchema. Keep all four in sync.
 */
export function validateSlug(slug: string): SlugValidationResult {
  if (slug.length < SLUG_MIN_LENGTH) {
    return { valid: false, error: "Too short (min 3 characters)" };
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return { valid: false, error: "Too long (max 50 characters)" };
  }
  if (/^-|-$/.test(slug)) {
    return { valid: false, error: "Cannot start or end with hyphen" };
  }
  if (/--/.test(slug)) {
    return { valid: false, error: "No consecutive hyphens" };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { valid: false, error: "Only lowercase letters, numbers, and hyphens" };
  }
  return { valid: true };
}

/**
 * Converts a display name to a suggested slug.
 * Lowercases, replaces invalid chars with hyphens, collapses consecutive hyphens,
 * strips leading/trailing hyphens, and truncates to max length.
 */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

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
  } catch (error) {
    logger.debug("ENS name resolution failed", { error, address, chainId });
    return null;
  }
}

async function fetchEnsAddressForChain(name: string, chainId: number): Promise<Address | null> {
  try {
    const client = getClient(chainId);
    const resolved = await client.getEnsAddress({ name });
    return resolved ?? null;
  } catch (error) {
    logger.debug("ENS address resolution failed", { error, name, chainId });
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
    const ensName = await client.getEnsName({ address });
    if (!ensName) return null;
    return await client.getEnsAvatar({ name: ensName });
  } catch (error) {
    logger.debug("ENS avatar resolution failed", { error, address, chainId });
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
