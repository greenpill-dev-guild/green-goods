/**
 * This device's record of the joins on-chain that the garden's roster may not show yet: an open
 * join it sent, or its request to join once a steward welcomed it (the request's own answer, or the
 * chain's, read by `useMyGardens`). A record stands in for the gardener role until a read of the
 * roster lists the account (`forgetListedPendingJoins`) or its time runs out. A request still
 * waiting for a steward never lands here: it grants nothing.
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

// Gardens whose record storage refused to forget. Such a record reads as gone in this tab, so it
// stops counting and no reader comes back to it, until a write that lands drops it for good.
const refusedRemovals = new Set<string>();

function getPendingJoins(): Record<string, { address: string; timestamp: number }> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PENDING_JOINS_KEY) || "{}");
    const saved =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, { address: string; timestamp: number }>)
        : {};
    for (const gardenId of refusedRemovals) delete saved[gardenId];
    return saved;
  } catch {
    return {};
  }
}

function savePendingJoins(pending: Record<string, { address: string; timestamp: number }>) {
  localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pending));
  refusedRemovals.clear();
}

export function addPendingJoin(gardenId: string, userAddress: string, submittedAt?: number) {
  if (typeof window === "undefined") return;
  const pending = getPendingJoins();
  const existing = pending[gardenId];
  const timestamp = submittedAt ?? Date.now();
  if (
    existing &&
    existing.address.toLowerCase() === userAddress.toLowerCase() &&
    Date.now() - existing.timestamp < PENDING_JOIN_TTL &&
    (submittedAt === undefined || existing.timestamp >= submittedAt)
  ) {
    return;
  }
  pending[gardenId] = { address: userAddress, timestamp };
  savePendingJoins(pending);
  notifyPendingJoinsChanged();
}

// Idempotent: must not notify when nothing changed. `hasFreshPendingJoin` runs on the render path
// and cleans up an expired record here, and an unconditional notify would re-trigger any memo
// subscribed to the record, producing an infinite render loop.
export function removePendingJoin(gardenId: string, account?: string, submittedBy = Infinity) {
  if (typeof window === "undefined") return;
  const pending = getPendingJoins();
  const matching = Object.keys(pending).filter(
    (id) =>
      id.toLowerCase() === gardenId.toLowerCase() &&
      (!account || pending[id]?.address?.toLowerCase() === account.toLowerCase()) &&
      (submittedBy === Infinity || pending[id]?.timestamp <= submittedBy)
  );
  if (matching.length === 0) return;
  for (const id of matching) delete pending[id];
  try {
    savePendingJoins(pending);
  } catch (error) {
    logger.warn("Could not forget a settled pending join", { source: "removePendingJoin", error });
    for (const id of matching) refusedRemovals.add(id);
  }
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

/** The last moment a saved pending join counts, or null for a malformed record. */
function pendingJoinLimit(record: unknown): number | null {
  const joinedAt = (record as { timestamp?: unknown } | null)?.timestamp;
  return typeof joinedAt === "number" ? joinedAt + PENDING_JOIN_TTL : null;
}

/** The gardens, lower-cased, where this device holds a fresh open join for the account. Reads only. */
export function pendingJoinGardenIds(account: string): Set<string> {
  const member = account.toLowerCase();
  const now = Date.now();
  const gardenIds = new Set<string>();
  for (const [gardenId, record] of Object.entries(savedPendingJoins())) {
    const limit = pendingJoinLimit(record);
    if (pendingJoinAccount(record) === member && limit !== null && now <= limit) {
      gardenIds.add(gardenId.toLowerCase());
    }
  }
  return gardenIds;
}

/**
 * Forget the joins past their limit, whoever sent them: no reader counts them any more. Returns
 * how long until the next one lapses, a millisecond past its limit since readers count the limit
 * itself, or null if none is waiting. A saved timestamp can be anything, so the wait is capped:
 * past setTimeout's range a delay fires at once, over and over.
 */
export function forgetLapsedPendingJoins(): number | null {
  const now = Date.now();
  const limits: number[] = [];
  for (const [gardenId, record] of Object.entries(savedPendingJoins())) {
    const limit = pendingJoinLimit(record);
    if (limit === null) continue;
    if (now > limit) removePendingJoin(gardenId);
    else limits.push(limit);
  }
  return limits.length > 0 ? Math.min(...limits, now + PENDING_JOIN_TTL) + 1 - now : null;
}

/**
 * Marks a garden in the list this device holds as listing the account only through the join's own
 * optimistic write, which the next read can drop while the indexer catches up. Other writers keep
 * the mark, and a read of the list replaces the record.
 */
export function markOwnJoinEntry<G extends object>(garden: G, account: string) {
  return { ...garden, optimisticGardener: account };
}

/** Whether the garden's roster lists the account only through this device's own join. */
export function isOwnJoinEntry(garden: object, account: string): boolean {
  const { optimisticGardener: mark } = garden as { optimisticGardener?: unknown };
  return typeof mark === "string" && mark.toLowerCase() === account.toLowerCase();
}

/**
 * Forget this device's open joins for the account in gardens whose roster now lists it, so a
 * role removed later is not masked by the join that came before it. Notifies only on a change.
 */
export function forgetListedPendingJoins(account: string, listedGardenIds: readonly string[]) {
  const listed = new Set(listedGardenIds.map((gardenId) => gardenId.toLowerCase()));
  const member = account.toLowerCase();
  for (const [gardenId, record] of Object.entries(savedPendingJoins())) {
    if (listed.has(gardenId.toLowerCase()) && pendingJoinAccount(record) === member) {
      removePendingJoin(gardenId);
    }
  }
}
