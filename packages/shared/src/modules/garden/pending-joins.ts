/**
 * This device's record of the open joins it sent: a join on-chain that the garden's roster may not
 * show yet. A record stands in for the gardener role until a read of the roster lists the account
 * (`forgetListedPendingJoins`) or its time runs out. A join request waiting for a steward never
 * lands here: it grants nothing.
 */

import { logger } from "../app/logger";

const PENDING_JOINS_KEY = "greengoods:pending-joins";
const PENDING_JOIN_TTL = 15 * 60 * 1000; // 15 minutes — generous to avoid UI flash during indexer lag

// In-tab subscriber pattern. localStorage's `storage` event only fires across
// tabs; this lets same-tab consumers (useMemo on garden filters) retrigger
// when a join confirms or expires inside the current tab.
const pendingJoinsSubscribers = new Set<() => void>();
function notifyPendingJoinsChanged() {
  for (const listener of pendingJoinsSubscribers) {
    listener();
  }
}

/** Calls `listener` on every change to the record inside this tab. Returns the unsubscribe. */
export function subscribeToPendingJoins(listener: () => void): () => void {
  pendingJoinsSubscribers.add(listener);
  return () => {
    pendingJoinsSubscribers.delete(listener);
  };
}

function getPendingJoins(): Record<string, { address: string; timestamp: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PENDING_JOINS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function addPendingJoin(gardenId: string, userAddress: string, timestamp = Date.now()) {
  if (typeof window === "undefined") return;
  const pending = getPendingJoins();
  const existing = pending[gardenId];
  if (
    existing &&
    existing.address.toLowerCase() === userAddress.toLowerCase() &&
    Date.now() - existing.timestamp < PENDING_JOIN_TTL
  ) {
    return;
  }
  pending[gardenId] = { address: userAddress, timestamp };
  localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pending));
  notifyPendingJoinsChanged();
}

// Idempotent: must not notify when nothing changed. `hasFreshPendingJoin` runs on the render path
// and cleans up an expired record here, and an unconditional notify would re-trigger any memo
// subscribed to the record, producing an infinite render loop.
export function removePendingJoin(gardenId: string) {
  if (typeof window === "undefined") return;
  const pending = getPendingJoins();
  if (!(gardenId in pending)) return;
  delete pending[gardenId];
  localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pending));
  notifyPendingJoinsChanged();
}

/** Whether this device holds a fresh open join for the account there. An expired record goes. */
export function hasFreshPendingJoin(gardenId: string, userAddress: string): boolean {
  const pending = getPendingJoins()[gardenId];
  if (!pending || pending.address.toLowerCase() !== userAddress.toLowerCase()) return false;
  if (Date.now() - pending.timestamp > PENDING_JOIN_TTL) {
    removePendingJoin(gardenId);
    return false;
  }
  return true;
}

/** Saved pending joins, read as untrusted data: another build or a hand edit may have written them. */
function savedPendingJoins(): Record<string, unknown> {
  const saved: unknown = getPendingJoins();
  return saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
}

/** The account a saved pending join belongs to, lower-cased, or null for a malformed record. */
function pendingJoinAccount(record: unknown): string | null {
  const address = (record as { address?: unknown } | null)?.address;
  return typeof address === "string" ? address.toLowerCase() : null;
}

/** The gardens, lower-cased, where this device holds a fresh open join for the account. Reads only. */
export function pendingJoinGardenIds(account: string): Set<string> {
  const member = account.toLowerCase();
  const now = Date.now();
  const gardenIds = new Set<string>();
  for (const [gardenId, record] of Object.entries(savedPendingJoins())) {
    const joinedAt = (record as { timestamp?: unknown } | null)?.timestamp;
    if (
      pendingJoinAccount(record) === member &&
      typeof joinedAt === "number" &&
      now - joinedAt <= PENDING_JOIN_TTL
    ) {
      gardenIds.add(gardenId.toLowerCase());
    }
  }
  return gardenIds;
}

/**
 * Forget this device's open joins for the account in gardens whose roster now lists it, so a
 * role removed later is not masked by the join that came before it. Notifies only on a change.
 */
export function forgetListedPendingJoins(account: string, listedGardenIds: readonly string[]) {
  if (typeof window === "undefined") return;
  const pending = savedPendingJoins();
  const listed = new Set(listedGardenIds.map((gardenId) => gardenId.toLowerCase()));
  const member = account.toLowerCase();
  let changed = false;
  for (const [gardenId, record] of Object.entries(pending)) {
    if (listed.has(gardenId.toLowerCase()) && pendingJoinAccount(record) === member) {
      delete pending[gardenId];
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pending));
  } catch (error) {
    // Storage can refuse the write; the record then lapses with its time limit.
    logger.warn("Could not forget a settled pending join", {
      source: "forgetListedPendingJoins",
      error,
    });
    return;
  }
  notifyPendingJoinsChanged();
}
