/**
 * Copies of a set
 *
 * A steward's seeding answer can ask for several separate commitments at once:
 * ten surveys at one survey each are ten promises, each taken up, proven and
 * confirmed on its own. This module decides what those copies share and when
 * the answers behind them may still change.
 *
 * What a set fixes at its first Create, and keeps through every retry:
 * - one id per copy, because the queue and the chain dedupe a creation by it;
 *   an id minted at send time is how a retry becomes a second commitment;
 * - one absolute deadline, so a copy sent later is due when its siblings are
 *   (PRD-1022 D2);
 * - one display-group id, written into every copy's metadata, so the pool
 *   shows the set as one group (D1). A single commitment is not a group.
 *
 * A copy's payload is built once from those and never rebuilt: the queue
 * refuses a second admission of the same copy with other answers, and the
 * contract reverts a known creation key with a different payload.
 *
 * @module modules/commitment-pooling/seed-sets
 */

const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * Creations per wallet approval. An ordinary creation costs about 692k gas
 * (GasBenchmarks), so ten stay well inside one transaction's 10M ceiling.
 */
export const CREATION_BUNDLE_SIZE = 10;

/** What every copy of a set shares, fixed at its first Create. */
export interface SeedSetIdentity {
  /** One per copy, in order, minted once. */
  copyIds: readonly string[];
  /** Unix seconds; the same for every copy. */
  dueDate: bigint;
  /** The group every copy joins, or null for a single commitment. */
  displayGroupId: string | null;
}

/** Mint a set's copies at Create: `count` ids, one deadline, and a group when there are several. */
export function mintSeedSet(input: {
  count: number;
  dueInDays: number;
  nowSeconds: number;
  newId: () => string;
}): SeedSetIdentity {
  const count = Math.max(1, Math.floor(input.count));
  return {
    copyIds: Array.from({ length: count }, () => input.newId()),
    dueDate: BigInt(input.nowSeconds + input.dueInDays * SECONDS_PER_DAY),
    displayGroupId: count > 1 ? input.newId() : null,
  };
}

/**
 * Copies added to a group that already exists keep its group id and its
 * deadline, so they join its row (D4). Only while that deadline is ahead: a
 * copy due before it could be taken up would promise nothing.
 */
export function mintGroupAddition(input: {
  group: { displayGroupId: string; dueDate: bigint };
  count: number;
  nowSeconds: number;
  newId: () => string;
}): SeedSetIdentity | { refused: "deadline-passed" } {
  if (input.group.dueDate <= BigInt(input.nowSeconds)) return { refused: "deadline-passed" };
  const count = Math.max(1, Math.floor(input.count));
  return {
    copyIds: Array.from({ length: count }, () => input.newId()),
    dueDate: input.group.dueDate,
    displayGroupId: input.group.displayGroupId,
  };
}

/**
 * Where one copy stands: waiting its turn, being prepared, at the wallet,
 * confirming, or how it ended. `later` stays in the queue to finish from the
 * pool tab; `not-sent` says why in `miss`.
 */
export type SeedCopyStatus =
  | "waiting"
  | "preparing"
  | "wallet"
  | "confirming"
  | "created"
  | "later"
  | "not-sent";

/**
 * Why a copy didn't send. Declined and refused are proof that nothing reached
 * the chain (the wallet said no, or the chain rejected it); failed is not,
 * because the answer may have been lost after the send.
 */
export type SeedCopyMiss = "declined" | "refused" | "failed";

export interface SeedCopyProgress {
  clientCommitmentId: string;
  status: SeedCopyStatus;
  miss?: SeedCopyMiss;
  /** The transaction that carried it, once known. */
  txHash: string | null;
  /** Its job in the queue, while it has one. */
  jobId: string | null;
}

const ATTEMPTED = new Set<SeedCopyStatus>(["created", "later", "not-sent"]);

/**
 * Nothing of this set can be on chain: no copy was created or left to finish,
 * and every copy that was tried ended provably unsent. Such a set is still the
 * steward's to edit, and its jobs are cleared so the queue holds nothing of it.
 */
export function seedSetLeftNothing(copies: readonly SeedCopyProgress[]): boolean {
  return copies.every(
    (copy) =>
      !ATTEMPTED.has(copy.status) ||
      (copy.status === "not-sent" && (copy.miss === "declined" || copy.miss === "refused"))
  );
}

/**
 * Whether the answers behind a set are fixed. Once any copy exists, or may
 * exist, the rest must keep its terms: changed answers would split them from
 * their group, and an admitted copy's payload can't change.
 */
export function seedSetLocked(copies: readonly SeedCopyProgress[]): boolean {
  return !seedSetLeftNothing(copies);
}

export interface SeedCopyCounts {
  total: number;
  created: number;
  /** Waiting in the queue, to finish from the pool tab. */
  later: number;
  notSent: number;
  /** Still going: waiting its turn, being prepared, at the wallet or confirming. */
  inFlight: number;
}

/** Where a pass stands, for the one status line that follows it. */
export function countSeedCopies(copies: readonly SeedCopyProgress[]): SeedCopyCounts {
  const counts: SeedCopyCounts = { total: 0, created: 0, later: 0, notSent: 0, inFlight: 0 };
  for (const copy of copies) {
    counts.total += 1;
    if (copy.status === "created") counts.created += 1;
    else if (copy.status === "later") counts.later += 1;
    else if (copy.status === "not-sent") counts.notSent += 1;
    else counts.inFlight += 1;
  }
  return counts;
}

/**
 * Whether the tray fits the steward's room under the pool's per-person limit
 * of open commitments. Only an offer uses any: its creator provides it, so
 * every copy counts the moment it is created. A request counts against
 * whoever takes it up, later.
 */
export function selectSeedSetCapacity(input: {
  room: number | null;
  rows: readonly { direction: "OFFER" | "REQUEST"; count?: number }[];
}): { offers: number; full: boolean; over: boolean } {
  const offers = input.rows
    .filter((row) => row.direction === "OFFER")
    .reduce((sum, row) => sum + Math.max(1, row.count ?? 1), 0);
  const { room } = input;
  return {
    offers,
    /** One more offer would not fit. */
    full: room !== null && offers >= room,
    /** The offers already here do not fit. */
    over: room !== null && offers > room,
  };
}

/** The copies a retry sends: the ones that didn't send. Created and waiting copies are left alone. */
export function copiesToRetry<T extends Pick<SeedCopyProgress, "status">>(
  copies: readonly T[]
): T[] {
  return copies.filter((copy) => copy.status === "not-sent");
}

/** Up to `size` at a time, in order. */
export function chunkCopies<T>(items: readonly T[], size = CREATION_BUNDLE_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
