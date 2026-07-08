/**
 * Recent send recipients (client PWA "Send" flow).
 *
 * Persisted to localStorage so a gardener can quickly re-send to people they
 * recently sent to. The optional note/memo is stored here — it is off-chain only
 * (ERC-20 transfers carry no memo). Mirrors the in-tab subscriber pattern from
 * `useJoinGarden` so same-tab readers refresh immediately on write (the native
 * `storage` event only fires across tabs).
 *
 * @module hooks/blockchain/useRecentRecipients
 */

import { useEffect, useMemo, useState } from "react";
import type { Address } from "../../types/domain";
import { normalizeAddress } from "../../utils/blockchain/address";

const RECENT_RECIPIENTS_KEY = "greengoods:recent-recipients";
const MAX_RECENTS = 10;

export interface RecentRecipient {
  address: Address;
  /** Cached ENS name at send time, if one was resolved. */
  ens?: string;
  /** Off-chain note attached to the send. Never written on-chain. */
  note?: string;
  /** Epoch ms of the most recent send to this address. */
  lastUsed: number;
}

// In-tab subscriber set: localStorage's `storage` event only fires across tabs,
// so same-tab consumers subscribe here and re-read on every local change.
const subscribers = new Set<() => void>();
function notifyRecentsChanged() {
  for (const listener of subscribers) listener();
}

function readRecents(): RecentRecipient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_RECIPIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentRecipient[]) : [];
  } catch {
    return [];
  }
}

/**
 * Upsert a recent recipient: move-to-front by address, cap at {@link MAX_RECENTS},
 * and notify same-tab subscribers. Best-effort — quota/serialization failures are
 * swallowed (recents are a convenience, never load-bearing).
 */
export function addRecentRecipient(address: Address, note?: string, ens?: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeAddress(address) as Address;
  const key = normalized.toLowerCase();
  const withoutExisting = readRecents().filter((r) => r.address.toLowerCase() !== key);
  const next: RecentRecipient[] = [
    { address: normalized, ens, note, lastUsed: Date.now() },
    ...withoutExisting,
  ].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(RECENT_RECIPIENTS_KEY, JSON.stringify(next));
    notifyRecentsChanged();
  } catch {
    // ignore — recents are best-effort
  }
}

/**
 * Same-tab freshness counter. Increments whenever recents change in this tab.
 * Use as a `useMemo`/`useEffect` dependency. Mirrors `usePendingJoinsVersion`.
 */
export function useRecentRecipientsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((prev) => prev + 1);
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }, []);
  return version;
}

/** Returns the recent recipients for this tab, fresh on same-tab writes. */
export function useRecentRecipients(): RecentRecipient[] {
  const version = useRecentRecipientsVersion();
  return useMemo(() => readRecents(), [version]);
}
