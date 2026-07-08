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
 *   - `status` / `tokenAddress` / `expectedAmount` — pending-funded recovery:
 *     card funding landed as the vault asset but approve/deposit has not
 *     produced shares yet, so management can offer a finish-deposit path
 *
 * All fields are public metadata (addresses, slug, chain, base-unit amount).
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

/**
 * Lifecycle of a cached card-wallet entry. `pending_funded` marks the recovery
 * case where card funding (WETH) landed in the recovered wallet but the
 * approve/deposit has not produced vault shares yet. Legacy entries without a
 * status field are confirmed positions (they were only written after a
 * positive share read).
 */
export type OctantVaultCardWalletPositionStatus = "pending_funded" | "confirmed";

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
  /** Entry lifecycle; absent on legacy entries (treated as confirmed). */
  status?: OctantVaultCardWalletPositionStatus;
  /** Funding token (public metadata) — recorded for pending-funded recovery. */
  tokenAddress?: Address;
  /** Expected base-unit deposit amount — recorded for pending-funded recovery. */
  expectedAmount?: string;
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

const BASE_UNIT_PATTERN = /^\d+$/;

function isValidRef(value: unknown): value is OctantVaultCardWalletPositionRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as Record<string, unknown>;
  const baseValid =
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
    Number.isFinite(ref.updatedAt);
  if (!baseValid) return false;

  // Optional lifecycle fields must be well-formed when present. A malformed
  // status/token/amount means the entry cannot be trusted for recovery.
  if (ref.status !== undefined && ref.status !== "pending_funded" && ref.status !== "confirmed") {
    return false;
  }
  if (
    ref.tokenAddress !== undefined &&
    (typeof ref.tokenAddress !== "string" || !ADDRESS_PATTERN.test(ref.tokenAddress))
  ) {
    return false;
  }
  if (
    ref.expectedAmount !== undefined &&
    (typeof ref.expectedAmount !== "string" || !BASE_UNIT_PATTERN.test(ref.expectedAmount))
  ) {
    return false;
  }
  return true;
}

/**
 * Allowlist projection: only the safe fields above survive a read or write.
 * Anything else on a stored entry (including private-looking fields such as
 * emails, OTPs, provider/session IDs, or receipt tokens — which are never
 * written by this module) is dropped instead of round-tripped.
 */
function sanitizeRef(ref: OctantVaultCardWalletPositionRef): OctantVaultCardWalletPositionRef {
  const safe: OctantVaultCardWalletPositionRef = {
    recoveredWalletAddress: ref.recoveredWalletAddress,
    campaignSlug: ref.campaignSlug,
    vaultAddress: ref.vaultAddress,
    chainId: ref.chainId,
    updatedAt: ref.updatedAt,
  };
  if (ref.status !== undefined) safe.status = ref.status;
  if (ref.tokenAddress !== undefined) safe.tokenAddress = ref.tokenAddress;
  if (ref.expectedAmount !== undefined) safe.expectedAmount = ref.expectedAmount;
  return safe;
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
      .map(sanitizeRef)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Pending-funded recovery entries: card funding landed in the recovered wallet
 * but no vault shares exist yet. Only entries carrying the full safe recovery
 * tuple (token + expected amount) qualify — anything less cannot drive a
 * finish-deposit flow.
 */
export function getOctantVaultPendingFundedCardWalletRefs(): OctantVaultCardWalletPositionRef[] {
  return getOctantVaultCardWalletPositionRefs().filter(
    (ref) =>
      ref.status === "pending_funded" &&
      typeof ref.tokenAddress === "string" &&
      typeof ref.expectedAmount === "string"
  );
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
    // New writes always carry an explicit lifecycle; legacy stored entries may not.
    status: input.status ?? "confirmed",
  };
  if (input.tokenAddress !== undefined) candidate.tokenAddress = input.tokenAddress;
  if (input.expectedAmount !== undefined) candidate.expectedAmount = input.expectedAmount;
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
