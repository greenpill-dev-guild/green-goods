/**
 * Route-local cache of card/recovered-email-wallet Octant vault positions.
 *
 * When a supporter completes a Card Endow on `/vaults`, the vault position is held
 * by a recovered Thirdweb in-app (email) wallet — not the connected wallet. So that
 * the `/vaults?manage=positions` surface can re-display that position when the
 * supporter returns later, we cache the **minimum safe** owner metadata needed to
 * read it back from chain:
 *
 *   - `recoveredWalletAddress` — the in-app wallet that owns the shares
 *   - `campaignSlug` / `vaultAddress` / `chainId` — which vault to read
 *   - `updatedAt` — for ordering / staleness display
 *
 * It NEVER caches email, provider/session IDs, receipt tokens, OTP, or any other
 * private identifier. Viewing positions only needs the address (public reads);
 * withdrawing still requires the live Thirdweb wallet session, which Thirdweb owns
 * — not this cache. Nothing here is ever placed in the URL.
 *
 * @module modules/octant-vault-card-wallet-cache
 */

import type { Address } from "../types/domain";

const STORAGE_KEY = "gg:octant-vault-card-wallets:v1";
/** Hard cap so a long-lived browser can't grow the cache without bound. */
const MAX_ENTRIES = 24;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/** Safe, route-local owner metadata for one recovered-wallet vault position. */
export interface OctantVaultCardWalletPositionRef {
  /** The recovered Thirdweb in-app (email) wallet that owns the vault shares. */
  recoveredWalletAddress: Address;
  /** Campaign the position belongs to (manifest slug). */
  campaignSlug: string;
  /** The Octant vault holding the shares. */
  vaultAddress: Address;
  /** Chain the vault lives on (Octant V2 Ethereum mainnet = 1). */
  chainId: number;
  /** Epoch ms the entry was last written. */
  updatedAt: number;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Access to localStorage can throw (private mode / blocked storage). Treat as absent.
    return null;
  }
}

function isValidRef(value: unknown): value is OctantVaultCardWalletPositionRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as Record<string, unknown>;
  return (
    typeof ref.recoveredWalletAddress === "string" &&
    ADDRESS_PATTERN.test(ref.recoveredWalletAddress) &&
    typeof ref.campaignSlug === "string" &&
    ref.campaignSlug.length > 0 &&
    typeof ref.vaultAddress === "string" &&
    ADDRESS_PATTERN.test(ref.vaultAddress) &&
    typeof ref.chainId === "number" &&
    Number.isInteger(ref.chainId) &&
    ref.chainId > 0 &&
    typeof ref.updatedAt === "number" &&
    Number.isFinite(ref.updatedAt)
  );
}

/** Stable identity for an entry — one position per (wallet, vault) pair. */
function refIdentity(ref: OctantVaultCardWalletPositionRef): string {
  return `${ref.recoveredWalletAddress.toLowerCase()}:${ref.vaultAddress.toLowerCase()}`;
}

/**
 * Read all cached card-wallet position refs, newest first. Malformed or partial
 * entries (e.g. from a future/older schema) are dropped silently so a bad write
 * never breaks the read path.
 */
export function getOctantVaultCardWalletPositionRefs(): OctantVaultCardWalletPositionRef[] {
  const storage = getStorage();
  if (!storage) return [];

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidRef)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Remember (or refresh) a card-wallet vault position. Upserts by (wallet, vault)
 * so re-endowing the same vault from the same recovered wallet updates the
 * timestamp rather than duplicating. Only the safe fields are persisted.
 *
 * @param input - The position metadata to remember.
 * @param now - Injected clock (epoch ms) — defaults to `Date.now()`; pass a fixed
 *   value in tests for determinism.
 * @returns The full, de-duplicated list after the write (newest first), or `[]`
 *   when storage is unavailable or the input is invalid.
 */
export function rememberOctantVaultCardWalletPosition(
  input: Omit<OctantVaultCardWalletPositionRef, "updatedAt"> & { updatedAt?: number },
  now: number = Date.now()
): OctantVaultCardWalletPositionRef[] {
  const storage = getStorage();
  if (!storage) return [];

  const candidate: OctantVaultCardWalletPositionRef = {
    recoveredWalletAddress: input.recoveredWalletAddress,
    campaignSlug: input.campaignSlug,
    vaultAddress: input.vaultAddress,
    chainId: input.chainId,
    updatedAt: input.updatedAt ?? now,
  };
  if (!isValidRef(candidate)) return getOctantVaultCardWalletPositionRefs();

  const existing = getOctantVaultCardWalletPositionRefs();
  const identity = refIdentity(candidate);
  const next = [candidate, ...existing.filter((ref) => refIdentity(ref) !== identity)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ENTRIES);

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A failed write (quota / blocked) must not throw into the endow success path.
  }
  return next;
}

/**
 * Forget cached refs. With no predicate, clears all entries; with a predicate,
 * keeps only the entries for which it returns `false`. Used when a recovered
 * wallet position is fully withdrawn or the cache is reset.
 */
export function forgetOctantVaultCardWalletPositions(
  predicate?: (ref: OctantVaultCardWalletPositionRef) => boolean
): OctantVaultCardWalletPositionRef[] {
  const storage = getStorage();
  if (!storage) return [];

  if (!predicate) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return [];
  }

  const next = getOctantVaultCardWalletPositionRefs().filter((ref) => !predicate(ref));
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

/**
 * Distinct recovered-wallet owner addresses across all cached refs (newest first).
 * The management surface renders one positions reader per owner address.
 */
export function getOctantVaultCardWalletOwners(): Address[] {
  const seen = new Set<string>();
  const owners: Address[] = [];
  for (const ref of getOctantVaultCardWalletPositionRefs()) {
    const key = ref.recoveredWalletAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    owners.push(ref.recoveredWalletAddress);
  }
  return owners;
}
