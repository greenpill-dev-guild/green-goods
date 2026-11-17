/**
 * Browsing and taking up grouped promises
 *
 * A group is many separate promises made alike (`display-groups`). In the app
 * it reads as one row and one page, and someone who takes "one" up takes up
 * exactly one copy, which the app chooses. The group itself is never claimed,
 * and one press takes at most one copy (PRD-1029).
 *
 * The rules:
 * - Only a published copy nobody has taken up and that has not ended can be
 *   chosen, never one the reader made, and the oldest goes first.
 * - In a steward-reviewed group the ask goes to a copy nobody has asked for yet
 *   (D5), so approving one ask never supersedes asks other copies could take.
 *   A pending ask reserves nothing on chain, but no second ask goes to its copy,
 *   so a surface that offers taking one up counts it as waiting on a steward,
 *   not available (PRD-1492). It is available again if the ask is declined.
 * - The pool's "at once" limit counts whoever provides a promise. Taking up a
 *   request makes the reader its provider, for themselves or for a garden they
 *   steward alike; taking up an offer does not, so the limit never stops an offer.
 * - Nothing is taken up while the pool isn't open: the chain refuses it.
 * - Availability that can't be read is unknown, never none.
 * - The reader's own copies stay ordinary rows in the list, each with its own
 *   state, so the group row never says "Yours".
 *
 * @module modules/commitment-pooling/group-browsing
 */

import type { Address } from "../../types/domain";
import {
  type DisplayEntry,
  type DisplayGroupCounts,
  type DisplayGroupEntry,
  displayBucketOf,
} from "./display-groups";
import { type DueClock, isPastDue } from "./due-dates";
import { selectSeedTrayRoom } from "./seed-tray";
import { isCommitmentCreator, isSameAccount } from "./selectors";
import type { CommitmentProviderExposureRecord, CommitmentReadModel } from "./types-core";

/** What choosing a copy reads from each one. */
export type GroupCopy = Pick<
  CommitmentReadModel,
  | "commitmentId"
  | "onchainState"
  | "derivedState"
  | "dueDate"
  | "cycleId"
  | "creator"
  | "leadProvider"
  | "counterparty"
  | "direction"
  | "claimMode"
>;

const OPEN = new Set<string>(["OFFERED", "REQUESTED"]);

/**
 * Whether anyone could take this copy up now: published, untaken, not ended, and not past due
 * (`isPastDue`), so a promise the chain would let anyone expire is offered for take-up nowhere.
 */
export function isOpenToTakeUp(
  copy: Pick<GroupCopy, "onchainState" | "derivedState" | "dueDate" | "cycleId">,
  clock: DueClock
): boolean {
  return OPEN.has(copy.onchainState) && OPEN.has(copy.derivedState) && !isPastDue(copy, clock);
}

/** A group's counts as someone taking one up reads them (`groupTakeUpCounts`). */
export interface GroupTakeUpCounts extends DisplayGroupCounts {
  /**
   * Open copies of a steward-reviewed group with a request waiting on a steward. No second ask
   * goes to them (D5), so they are not available; one is again once its request is declined.
   */
  requested: number;
}

const NOBODY_ASKED: ReadonlySet<string> = new Set();

/**
 * A group's counts as a surface that offers taking a copy up shows them, so it never says a copy
 * is available that its act would not take (PRD-1492). On the chain's clock, a copy still offered
 * or requested on chain but past due (`isPastDue`) is never available again, since anyone may
 * expire it, so it counts as ended, as it will be. In a steward-reviewed group, a copy with a
 * request waiting on a steward is requested: the act passes it over (D5).
 */
export function groupTakeUpCounts(
  group: Pick<DisplayGroupEntry<GroupCopy>, "children" | "counts">,
  input: {
    clock: DueClock;
    /** Copies anyone has a pending ask on (`usePoolClaimRequests`). */
    askedFor: ReadonlySet<string>;
  }
): GroupTakeUpCounts {
  let lapsed = 0;
  let requested = 0;
  for (const copy of group.children) {
    if (displayBucketOf(copy.onchainState) !== "available") continue;
    if (isPastDue(copy, input.clock)) lapsed += 1;
    else if (
      copy.claimMode === "APPROVAL_GATED" &&
      input.askedFor.has(copy.commitmentId.toString())
    ) {
      requested += 1;
    }
  }
  const { counts } = group;
  return {
    ...counts,
    available: counts.available - lapsed - requested,
    ended: counts.ended + lapsed,
    requested,
  };
}

/**
 * Whether the reader took this copy up: they provide a request they answered,
 * or receive an offer they took. A copy they made is theirs to give, not to hold,
 * and a named confirmer only checks the work, so neither holds a copy.
 */
export function isViewerCopy(copy: GroupCopy, viewer: Address | null | undefined): boolean {
  if (!viewer || isCommitmentCreator({ commitment: copy, viewer })) return false;
  return isSameAccount(
    copy.direction === "REQUEST" ? copy.leadProvider : copy.counterparty,
    viewer
  );
}

export interface CopyChoiceInput {
  viewer: Address | null | undefined;
  /** Copies anyone has a pending ask on. A reviewed group passes them over (D5). */
  askedFor: ReadonlySet<string>;
  /** Copies to pass over: one just found taken, or one already on its way from this phone. */
  skip?: ReadonlySet<string>;
  /** The chain's clock and the pool's cycle ends: a copy past due is never chosen. */
  clock: DueClock;
}

/** Whether one press may choose this copy, read against the latest facts about it. */
export function canChooseCopy(copy: GroupCopy, input: CopyChoiceInput): boolean {
  const id = copy.commitmentId.toString();
  if (!isOpenToTakeUp(copy, input.clock) || input.skip?.has(id)) return false;
  if (input.viewer && isCommitmentCreator({ commitment: copy, viewer: input.viewer })) return false;
  return copy.claimMode !== "APPROVAL_GATED" || !input.askedFor.has(id);
}

/** The copy one press takes up: the oldest the reader may choose, or null when none is left. */
export function pickCopyToTakeUp<T extends GroupCopy>(
  copies: readonly T[],
  input: CopyChoiceInput
): T | null {
  let oldest: T | null = null;
  for (const copy of copies) {
    if (!canChooseCopy(copy, input)) continue;
    if (!oldest || copy.commitmentId < oldest.commitmentId) oldest = copy;
  }
  return oldest;
}

/**
 * Whether the reader holds as many promises in this pool as it allows at once,
 * so taking up another would be refused. Unknown reads as room: the registry
 * enforces the limit whatever the app thinks, and an unread number must not
 * stop anyone.
 */
export function isAtTakeUpLimit(input: {
  direction: CommitmentReadModel["direction"];
  /** The pool's `providerOpenCommitmentCap`. */
  cap: bigint | undefined;
  exposures:
    | readonly Pick<CommitmentProviderExposureRecord, "provider" | "openCommitmentCount">[]
    | null;
  viewer: Address | null | undefined;
  /** Take-ups still on this phone: the chain counts them once they land. */
  queued: number;
}): boolean {
  if (input.direction !== "REQUEST") return false;
  const room = selectSeedTrayRoom({
    cap: input.cap,
    exposures: input.exposures,
    viewer: input.viewer,
    queuedOffers: input.queued,
  });
  return room === 0;
}

export type GroupTakeUpAct = "takeUp" | "takeUpAnother" | "askToTakeUp";

/**
 * Why the act can't be taken now: the pool isn't open, the pool's at-once
 * limit, availability that can't be read, or nothing left to take.
 */
export type GroupTakeUpHold = "closed" | "limit" | "unknown" | "none";

export interface GroupTakeUpBar {
  act: GroupTakeUpAct;
  hold: GroupTakeUpHold | null;
}

/**
 * The group page's one act. A reviewed group asks; an open one takes up, and
 * says "another" once the reader holds or kept a copy.
 */
export function selectGroupTakeUpBar(input: {
  approvalGated: boolean;
  holdsOne: boolean;
  /** Whether a copy is there to choose; null when availability can't be read. */
  hasChoice: boolean | null;
  atLimit: boolean;
  /** The pool is open: paused, closed or not yet open, the chain refuses a take-up. */
  poolOpen: boolean;
}): GroupTakeUpBar {
  const act: GroupTakeUpAct = input.approvalGated
    ? "askToTakeUp"
    : input.holdsOne
      ? "takeUpAnother"
      : "takeUp";
  const hold: GroupTakeUpHold | null = !input.poolOpen
    ? "closed"
    : input.atLimit
      ? "limit"
      : input.hasChoice === null
        ? "unknown"
        : input.hasChoice
          ? null
          : "none";
  return { act, hold };
}

/** One entry of the Promises tab: an ordinary row, or a group standing in for its copies. */
export type PoolListEntry<R> =
  | { kind: "single"; row: R }
  | { kind: "group"; group: DisplayGroupEntry<CommitmentReadModel> };

/** A group as someone taking one up reads it: its copies, counted by `groupTakeUpCounts`. */
export interface TakeUpGroupEntry extends Omit<DisplayGroupEntry<CommitmentReadModel>, "counts"> {
  counts: GroupTakeUpCounts;
}

/** A group counted for someone taking one up, and whether its availability could be read. */
export interface CountedTakeUpGroup {
  group: TakeUpGroupEntry;
  /** False while a steward-reviewed group's requests can't be read: its row says so. */
  availabilityKnown: boolean;
}

/** A Promises tab or Take Part entry, its group counted as the group's page counts it. */
export type CountedPoolListEntry<R> =
  | { kind: "single"; row: R }
  | ({ kind: "group" } & CountedTakeUpGroup);

/**
 * A listed group counted as its page counts it (`groupTakeUpCounts`). `askedFor` is null when
 * the pool's requests could not be read: a steward-reviewed group's availability is then
 * unknown, as on its page, while an open group never reads requests.
 */
export function countTakeUpGroup(
  group: DisplayGroupEntry<CommitmentReadModel>,
  input: { clock: DueClock; askedFor: ReadonlySet<string> | null }
): CountedTakeUpGroup {
  const reviewed = group.children.some((copy) => copy.claimMode === "APPROVAL_GATED");
  return {
    group: {
      ...group,
      counts: groupTakeUpCounts(group, {
        clock: input.clock,
        askedFor: input.askedFor ?? NOBODY_ASKED,
      }),
    },
    availabilityKnown: !reviewed || input.askedFor !== null,
  };
}

/**
 * The Promises tab's entries. `rows` are what the filters let through, in
 * order; `grouped` folds every copy in scope, so a group's counts include the
 * copies the filters leave out. A group takes the place of its first row, and
 * the reader's own copies stay ordinary rows.
 */
export function selectPoolListEntries<R extends { commitment: CommitmentReadModel }>(input: {
  rows: readonly R[];
  grouped: readonly DisplayEntry<CommitmentReadModel>[];
  viewer: Address | null | undefined;
}): PoolListEntry<R>[] {
  const groupOf = new Map<string, DisplayGroupEntry<CommitmentReadModel>>();
  for (const entry of input.grouped) {
    if (entry.kind !== "group") continue;
    for (const copy of entry.children) groupOf.set(copy.id, entry);
  }
  const shown = new Set<string>();
  const entries: PoolListEntry<R>[] = [];
  for (const row of input.rows) {
    const group = groupOf.get(row.commitment.id);
    if (!group || isViewerCopy(row.commitment, input.viewer)) {
      entries.push({ kind: "single", row });
      continue;
    }
    if (shown.has(group.key)) continue;
    shown.add(group.key);
    entries.push({ kind: "group", group });
  }
  return entries;
}

/**
 * The group a route names: by its display-group id, and, when one id ever
 * splits by terms, by its key or by one of its copies. A copy's id is what a
 * link carries, since a copy stays in its group however its reward is edited.
 * Without either the first entry with the id stands.
 */
export function findDisplayGroup<T extends { commitmentId: bigint }>(
  entries: readonly DisplayEntry<T>[],
  displayGroupId: string,
  within: { key?: string | null; copyId?: string | null } = {}
): DisplayGroupEntry<T> | null {
  const matches = entries.filter(
    (entry): entry is DisplayGroupEntry<T> =>
      entry.kind === "group" && entry.displayGroupId === displayGroupId
  );
  return (
    matches.find((entry) => within.key && entry.key === within.key) ??
    matches.find((entry) =>
      entry.children.some((copy) => copy.commitmentId.toString() === within.copyId)
    ) ??
    matches[0] ??
    null
  );
}
