/**
 * Home's journal in the active garden: what the Highlights carousel, Recent Activity and Take
 * Part show (DL-127, decisions 23, 27 and 32).
 *
 * Each rule reads what the garden page and its Pool tab already read, so Home never disagrees
 * with them about a work's status, a season or a promise:
 *
 * - Recent Activity is the garden's newest work, the same for every role. Work still on this
 *   phone (waiting to upload, uploading, or failed to send) is the member's to finish, so
 *   Continue shows it and the garden's activity does not.
 * - The carousel leads with the pool's open season and campaigns, then the newest work with a
 *   photo, then the newest ask open to take up.
 * - Take Part lists the promises open to take up that the reader did not make: their own
 *   offers and asks are theirs to withdraw, not to join. Copies of one set fold into one row,
 *   as on the Pool tab.
 *
 * A section reads in one state, so loading, a failure and "nothing saved offline" are never
 * mistaken for "nothing here".
 *
 * @module modules/garden/journal
 */

import { commitmentNeedsSeat } from "../commitment-pooling/acts";
import { groupCommitmentsForDisplay } from "../commitment-pooling/display-groups";
import {
  isOpenToTakeUp,
  type PoolListEntry,
  selectPoolListEntries,
} from "../commitment-pooling/group-browsing";
import type { CommitmentMetadataV1 } from "../commitment-pooling/metadata";
import {
  type CommitmentSeat,
  isCommitmentCreator,
  selectCommitmentSeat,
} from "../commitment-pooling/selectors";
import type { CommitmentCycleRecord, CommitmentReadModel } from "../commitment-pooling/types-core";
import type { Address, Work, WorkDisplayStatus } from "../../types/domain";

/** How many items a journal section previews (decision 27: three activity rows). */
export const JOURNAL_PREVIEW_COUNT = 3;

export type JournalSectionState<T> =
  | { status: "loading" }
  | { status: "error" }
  /** Offline with nothing saved for this garden: a wait, not a failure (DL-085). */
  | { status: "offline" }
  /** Promises do not run on this chain, so there is nothing to read rather than nothing open. */
  | { status: "unavailable" }
  | { status: "empty" }
  /** `savedAt` is when an offline copy was read; null while the read is live. */
  | { status: "ready"; items: T[]; savedAt: number | null };

const DAY_MS = 86_400_000;

/**
 * The statuses a work holds only while it is on this phone. `useMyWorks` keeps the same ones
 * out of the indexed list.
 */
const ON_THIS_PHONE: ReadonlySet<WorkDisplayStatus> = new Set([
  "offline",
  "uploading",
  "syncing",
  "sync_failed",
]);

/** The garden page's work read (`useWorks` with the offline queue), as the journal reads it. */
export interface GardenWorkRead {
  works: readonly Work[];
  /** "available" and "empty" mean a read of the garden's list answered, live or saved. */
  availability: "available" | "partial" | "unavailable" | "empty";
  isError: boolean;
  /** Offline, or the read is waiting for the network. */
  isPaused: boolean;
  lastSuccessfulRefresh?: number;
}

/** The garden's own works, newest first: everything but work still on this phone. */
export function gardenActivity(works: readonly Work[]): Work[] {
  return works
    .filter((work) => !ON_THIS_PHONE.has(work.status))
    .sort((left, right) => right.createdAt - left.createdAt);
}

/** Recent Activity's states: work is read on every chain, so it is never unavailable. */
export type RecentActivityState = Exclude<JournalSectionState<Work>, { status: "unavailable" }>;

export function recentActivityState(read: GardenWorkRead): RecentActivityState {
  const works = gardenActivity(read.works);
  if (works.length > 0) {
    return {
      status: "ready",
      items: works.slice(0, JOURNAL_PREVIEW_COUNT),
      savedAt: read.isPaused ? (read.lastSuccessfulRefresh ?? null) : null,
    };
  }
  const answered = read.availability === "available" || read.availability === "empty";
  if (read.isPaused) return answered ? { status: "empty" } : { status: "offline" };
  if (read.isError) return { status: "error" };
  return answered ? { status: "empty" } : { status: "loading" };
}

/** The newest of the garden's works with a photo, the carousel's featured update. */
export function featuredWork(works: readonly Work[]): Work | null {
  return gardenActivity(works).find((work) => work.media.length > 0) ?? null;
}

export interface OpenCycle {
  cycle: CommitmentCycleRecord;
  /** Whole days to the cycle's end, the last part of a day counting as one; null without one. */
  daysLeft: number | null;
}

/**
 * The pool's open cycles: its one open season first (`CyclesLib.sol` keeps one), then its
 * open campaigns in the order the Pool tab's rail reads them.
 */
export function openCycles(cycles: readonly CommitmentCycleRecord[], nowMs: number): OpenCycle[] {
  const open = cycles.filter((cycle) => cycle.state === "OPEN");
  return [
    ...open.filter((cycle) => cycle.cycleType === "SEASON"),
    ...open.filter((cycle) => cycle.cycleType !== "SEASON"),
  ].map((cycle) => ({ cycle, daysLeft: cycleDaysLeft(cycle.endTime, nowMs) }));
}

/**
 * Days left to an end time in unix seconds. A cycle past its end but still open has no count:
 * "0 days left" would read as ending today, and its state says it has not ended.
 */
export function cycleDaysLeft(endTime: bigint | null, nowMs: number): number | null {
  if (endTime === null) return null;
  const remainingMs = Number(endTime) * 1000 - nowMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / DAY_MS) : null;
}

/** One React Query read, as a journal section reads it. */
export interface JournalQueryRead {
  hasData: boolean;
  isError: boolean;
  dataUpdatedAt: number;
}

/** A section read from the garden's pool: the pool lookup, then one of the pool's lists. */
export interface PoolSectionRead<T> {
  /** Promises run on this chain (`useCommitmentPoolingAvailability`). */
  available: boolean;
  isOnline: boolean;
  pools: JournalQueryRead & { hasPool: boolean };
  list: JournalQueryRead;
  items: T[];
}

function unansweredState(read: JournalQueryRead, isOnline: boolean): JournalSectionState<never> {
  if (!isOnline) return { status: "offline" };
  return read.isError ? { status: "error" } : { status: "loading" };
}

export function poolSectionState<T>(read: PoolSectionRead<T>): JournalSectionState<T> {
  if (!read.available) return { status: "unavailable" };
  if (!read.pools.hasData) return unansweredState(read.pools, read.isOnline);
  if (!read.pools.hasPool) return { status: "empty" };
  if (!read.list.hasData) return unansweredState(read.list, read.isOnline);
  if (read.items.length === 0) return { status: "empty" };
  return {
    status: "ready",
    items: read.items,
    savedAt: read.isOnline ? null : read.list.dataUpdatedAt || null,
  };
}

/** A Take Part row: the Pool tab's row shape, so the rows are its `PromiseRow`s. */
export interface TakePartRow {
  commitment: CommitmentReadModel;
  seat: CommitmentSeat | null;
  needsYou: boolean;
}

export type TakePartEntry = PoolListEntry<TakePartRow>;

/** The promises open to take up that the reader did not make, in the read's order. */
export function takePartPromises(
  commitments: readonly CommitmentReadModel[],
  viewer: Address | null | undefined
): CommitmentReadModel[] {
  return commitments.filter(
    (commitment) =>
      isOpenToTakeUp(commitment) &&
      !isCommitmentCreator({ commitment, viewer: viewer ?? undefined })
  );
}

/**
 * Take Part's entries: the open promises as the Pool tab's rows, copies of one set folded
 * into one group, counted across every copy in the pool.
 */
export function takePartEntries(input: {
  commitments: readonly CommitmentReadModel[];
  metadataByCID: ReadonlyMap<string, CommitmentMetadataV1>;
  viewer: Address | null | undefined;
}): TakePartEntry[] {
  const viewer = input.viewer ?? undefined;
  const rows = takePartPromises(input.commitments, viewer).map((commitment) => {
    const seat = selectCommitmentSeat({ commitment, contributors: [], viewer });
    return { commitment, seat, needsYou: commitmentNeedsSeat({ commitment, seat }) };
  });
  return selectPoolListEntries({
    rows,
    grouped: groupCommitmentsForDisplay({
      commitments: input.commitments,
      metadataByCID: input.metadataByCID,
    }),
    viewer,
  });
}

/** The newest ask among Take Part's entries, for the carousel's last card. */
export function openAsk(entries: readonly TakePartEntry[]): TakePartEntry | null {
  return (
    entries.find(
      (entry) =>
        (entry.kind === "single"
          ? entry.row.commitment.direction
          : entry.group.children[0]?.direction) === "REQUEST"
    ) ?? null
  );
}
