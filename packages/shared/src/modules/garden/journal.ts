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
 *   offers and asks are theirs to withdraw, not to join. Nor does it list one they already
 *   asked for or are taking up from this phone (`ViewerTakeUps`). Copies of one set fold into
 *   one row, as on the Pool tab. Submit Work's Start step lists the asks among them that the
 *   reader takes up in one tap.
 *
 * A section reads in one state, so loading, a failure and "nothing saved offline" are never
 * mistaken for "nothing here".
 *
 * @module modules/garden/journal
 */

import { commitmentNeedsSeat } from "../commitment-pooling/acts";
import { groupCommitmentsForDisplay } from "../commitment-pooling/display-groups";
import type { DueClock } from "../commitment-pooling/due-dates";
import {
  isOpenToTakeUp,
  type PoolListEntry,
  selectPoolListEntries,
} from "../commitment-pooling/group-browsing";
import type { CommitmentMetadataV1 } from "../commitment-pooling/metadata";
import {
  type CommitmentSeat,
  isCommitmentCreator,
  isSameAccount,
  selectCommitmentSeat,
} from "../commitment-pooling/selectors";
import type {
  CommitmentClaimRequestRecord,
  CommitmentCycleRecord,
  CommitmentReadModel,
} from "../commitment-pooling/types-core";
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

/** A Take Part entry: a promise as the Pool tab's row, or copies of one set as one group. */
export type TakePartEntry = PoolListEntry<TakePartRow> & {
  /**
   * The copy the entry stands for and opens: the promise itself, or a group's first copy the
   * reader could take up, which may not be its first child.
   */
  copy: CommitmentReadModel;
};

/**
 * What the reader has already done toward taking promises up, by decimal promise id. A promise
 * they asked for, or are still taking up from this phone, is theirs to follow on its own page,
 * where the request or the queued take-up shows, so it is not offered to them again.
 */
export interface ViewerTakeUps {
  /** Asked to take up an approval-gated promise, and no steward has answered yet. */
  requested: ReadonlySet<string>;
  /** A take-up still on this phone: queued, sending, or failed and not yet discarded. */
  queued: ReadonlySet<string>;
}

export const NO_TAKE_UPS: ViewerTakeUps = { requested: new Set(), queued: new Set() };

/**
 * The reader's take-ups, from the pool's pending requests and the claims on this phone. A
 * request counts whether the reader is its claimant or made it for a garden they steward. A
 * declined request is no longer pending, so its promise is open to ask again.
 */
export function viewerTakeUps(input: {
  viewer: Address | null | undefined;
  /** The pool's PENDING claim requests (`usePoolClaimRequests`). */
  pendingRequests: readonly Pick<
    CommitmentClaimRequestRecord,
    "commitmentId" | "claimant" | "requestedBy" | "state"
  >[];
  /** Promises with a claim on this phone (`useCommitmentQueueState().takeUpIds`). */
  queued: ReadonlySet<string>;
}): ViewerTakeUps {
  const { viewer } = input;
  const requested = new Set(
    viewer
      ? input.pendingRequests
          .filter(
            (request) =>
              request.state === "PENDING" &&
              (isSameAccount(request.claimant, viewer) ||
                isSameAccount(request.requestedBy, viewer))
          )
          .map((request) => request.commitmentId.toString())
      : []
  );
  return { requested, queued: input.queued };
}

/**
 * Whether the reader could take this promise up now: open and not past due on the chain's
 * clock, not theirs, and not already asked for.
 */
export function isTakeableBy(
  commitment: CommitmentReadModel,
  viewer: Address | null | undefined,
  takeUps: ViewerTakeUps,
  clock: DueClock
): boolean {
  if (!isOpenToTakeUp(commitment, clock)) return false;
  if (isCommitmentCreator({ commitment, viewer: viewer ?? undefined })) return false;
  const id = commitment.commitmentId.toString();
  return !takeUps.requested.has(id) && !takeUps.queued.has(id);
}

/**
 * Whether the reader can take this promise up in the tap that logs work for it (decision 18):
 * an ask they would take up as themselves, whose take-up the chain accepts at once. An
 * approval-gated ask never qualifies: a steward of the pool's garden accepts or declines that
 * take-up, and once accepted the promise is the reader's own and lists as theirs.
 */
export function isOneTapTakeUp(
  commitment: CommitmentReadModel,
  viewer: Address | null | undefined,
  takeUps: ViewerTakeUps,
  clock: DueClock
): boolean {
  return (
    commitment.direction === "REQUEST" &&
    commitment.claimMode === "OPEN" &&
    commitment.claimType === "INDIVIDUAL" &&
    isTakeableBy(commitment, viewer, takeUps, clock)
  );
}

/** The promises the reader could take up, in the read's order. */
export function takePartPromises(
  commitments: readonly CommitmentReadModel[],
  viewer: Address | null | undefined,
  takeUps: ViewerTakeUps,
  clock: DueClock
): CommitmentReadModel[] {
  return commitments.filter((commitment) => isTakeableBy(commitment, viewer, takeUps, clock));
}

/** What Take Part reads: the pool's promises and their metadata, the reader and their take-ups. */
export interface TakePartInput {
  commitments: readonly CommitmentReadModel[];
  metadataByCID: ReadonlyMap<string, CommitmentMetadataV1>;
  viewer: Address | null | undefined;
  /** The pool's state is OPEN. */
  poolOpen: boolean;
  takeUps: ViewerTakeUps;
  /** The chain's clock and the pool's cycle ends (`useDueClock`): nothing past due is listed. */
  clock: DueClock;
}

/**
 * Take Part's entries: the open promises as the Pool tab's rows, copies of one set folded
 * into one group, counted across every copy in the pool. A pool that is not open takes nothing
 * up, as the promise page's take-up gate reads it, so then there are none.
 */
export function takePartEntries(input: TakePartInput): TakePartEntry[] {
  if (!input.poolOpen) return [];
  const viewer = input.viewer ?? undefined;
  const open = takePartPromises(input.commitments, viewer, input.takeUps, input.clock);
  const openIds = new Set(open.map((commitment) => commitment.id));
  const rows = open.map((commitment) => {
    const seat = selectCommitmentSeat({ commitment, contributors: [], viewer });
    return { commitment, seat, needsYou: commitmentNeedsSeat({ commitment, seat }) };
  });
  const entries = selectPoolListEntries({
    rows,
    grouped: groupCommitmentsForDisplay({
      commitments: input.commitments,
      metadataByCID: input.metadataByCID,
    }),
    viewer,
  });
  // A group is listed for a copy among `rows`, so it always has one the reader could take up.
  return entries.flatMap((entry): TakePartEntry[] => {
    if (entry.kind === "single") return [{ ...entry, copy: entry.row.commitment }];
    const copy = entry.group.children.find((child) => openIds.has(child.id));
    return copy ? [{ ...entry, copy }] : [];
  });
}

/**
 * Why Take Part lists nothing, when it does (DL-132): `none` while the pool holds no promise
 * open to take up, `yours` when every open one is the reader's own, or already asked for.
 */
export function takePartEmptyReason(input: TakePartInput): "none" | "yours" {
  if (!input.poolOpen) return "none";
  const open = input.commitments.filter((commitment) => isOpenToTakeUp(commitment, input.clock));
  if (open.length === 0) return "none";
  return takePartPromises(open, input.viewer, input.takeUps, input.clock).length === 0
    ? "yours"
    : "none";
}

/**
 * The asks Submit Work's Start step lists beside the reader's own promises (decision 18): Take
 * Part's entries, each standing for its set's first copy the reader could take up, narrowed to
 * the asks the chain hands them in one tap.
 */
export function oneTapAsks(input: TakePartInput): CommitmentReadModel[] {
  return takePartEntries(input)
    .map((entry) => entry.copy)
    .filter((copy) => isOneTapTakeUp(copy, input.viewer, input.takeUps, input.clock));
}

/** The newest ask among Take Part's entries, for the carousel's last card. */
export function openAsk(entries: readonly TakePartEntry[]): TakePartEntry | null {
  return entries.find((entry) => entry.copy.direction === "REQUEST") ?? null;
}
