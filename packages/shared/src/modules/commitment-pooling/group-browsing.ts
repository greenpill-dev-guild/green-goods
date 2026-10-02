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
 *   A pending ask reserves nothing and changes no count.
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
import type { DisplayEntry, DisplayGroupEntry } from "./display-groups";
import { selectSeedTrayRoom } from "./seed-tray";
import { isCommitmentCreator, isSameAccount } from "./selectors";
import type { CommitmentProviderExposureRecord, CommitmentReadModel } from "./types-core";

/** What choosing a copy reads from each one. */
export type GroupCopy = Pick<
  CommitmentReadModel,
  | "commitmentId"
  | "onchainState"
  | "derivedState"
  | "creator"
  | "leadProvider"
  | "counterparty"
  | "direction"
  | "claimMode"
>;

const OPEN = new Set<string>(["OFFERED", "REQUESTED"]);

/** Whether anyone could take this copy up now: published, untaken, and not ended. */
function isOpenToTakeUp(copy: Pick<GroupCopy, "onchainState" | "derivedState">): boolean {
  return OPEN.has(copy.onchainState) && OPEN.has(copy.derivedState);
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
}

/** Whether one press may choose this copy, read against the latest facts about it. */
export function canChooseCopy(copy: GroupCopy, input: CopyChoiceInput): boolean {
  const id = copy.commitmentId.toString();
  if (!isOpenToTakeUp(copy) || input.skip?.has(id)) return false;
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
