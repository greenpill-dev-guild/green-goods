/**
 * Promises shown as groups
 *
 * Copies a steward created together carry one display-group id in their
 * metadata (PRD-1022 D1). Lists fold them into one entry, and every copy stays
 * its own commitment underneath: its own take-up, proof, confirmation and
 * history. The fold is presentation only; nothing here is an authority.
 *
 * The rules:
 * - Only the id folds copies together, and only when their material terms
 *   match too. The same words with a different deadline, reward rail, claim
 *   mode, cycle or creator never become one entry.
 * - The reward amount is left out of the terms, because Edit Reward changes it
 *   on the copies nobody has taken; the group stays one row (D14).
 * - Counts come from published records only. What a steward meant to create
 *   is never shown as something to take up.
 * - A record whose metadata is missing, unreadable or of a later version is an
 *   ordinary row. Nothing is hidden inside a group the app can't read.
 * - Every state lands in a bucket, so no copy disappears from the counts.
 *
 * @module modules/commitment-pooling/display-groups
 */

import { type CommitmentMetadataV1, isResolvableMetadataCID } from "./metadata";
import type { CommitmentReadModel } from "./types-core";

/** What a record needs for grouping: its words, its state, and the terms that make copies alike. */
export type GroupableCommitment = Pick<
  CommitmentReadModel,
  | "chainId"
  | "onchainState"
  | "cycleId"
  | "targetUnits"
  | "declaredUnitValue"
  | "declaredValueBasis"
  | "confirmers"
  | "poolId"
  | "commitmentSeriesId"
  | "creator"
  | "unitLabel"
  | "needUID"
  | "counterCommitmentId"
  | "considerationRail"
  | "considerationSource"
  | "considerationToken"
  | "direction"
  | "commitmentType"
  | "claimMode"
  | "dueDate"
  | "requiresAssessment"
  | "contributorPolicy"
  | "confirmationThreshold"
  | "protocolFallbackEnabled"
  | "metadataCID"
>;

/** The count words: available, in progress, kept, ended; `other` keeps an unseen record counted. */
export interface DisplayGroupCounts {
  published: number;
  /** Published and not taken up. Pending asks don't reduce it. */
  available: number;
  /** Taken up and not yet kept: accepted, waiting to be confirmed, or disputed. */
  inProgress: number;
  kept: number;
  /** Cancelled, withdrawn or expired. Never available again. */
  ended: number;
  /** Not seen by the indexer yet. */
  other: number;
}

export interface DisplayGroupEntry<T> {
  kind: "group";
  /** Stable across renders: the group's id and its terms. */
  key: string;
  displayGroupId: string;
  /** The published copies, in the order they were given. */
  children: T[];
  counts: DisplayGroupCounts;
}

export interface DisplaySingleEntry<T> {
  kind: "single";
  record: T;
}

export type DisplayEntry<T> = DisplayGroupEntry<T> | DisplaySingleEntry<T>;

/** The count a copy falls in. */
export type DisplayBucket = Exclude<keyof DisplayGroupCounts, "published">;

const BUCKET: Record<GroupableCommitment["onchainState"], DisplayBucket> = {
  OFFERED: "available",
  REQUESTED: "available",
  ACCEPTED: "inProgress",
  READY_FOR_CONFIRMATION: "inProgress",
  DISPUTED: "inProgress",
  FULFILLED: "kept",
  CANCELLED: "ended",
  EXPIRED: "ended",
  UNKNOWN: "other",
};

/** Which count a copy falls in, by its state on chain: available, in progress, kept, ended or other. */
export function displayBucketOf(state: GroupableCommitment["onchainState"]): DisplayBucket {
  return BUCKET[state] ?? "other";
}

function countDisplayGroup(children: readonly GroupableCommitment[]): DisplayGroupCounts {
  const counts: DisplayGroupCounts = {
    published: 0,
    available: 0,
    inProgress: 0,
    kept: 0,
    ended: 0,
    other: 0,
  };
  for (const child of children) {
    counts.published += 1;
    counts[displayBucketOf(child.onchainState)] += 1;
  }
  return counts;
}

/** The display group a record's metadata names, or null when it names none this build can read. */
function displayGroupIdOf(
  record: Pick<GroupableCommitment, "metadataCID">,
  metadataByCID: ReadonlyMap<string, CommitmentMetadataV1>
): string | null {
  if (!isResolvableMetadataCID(record.metadataCID)) return null;
  return metadataByCID.get(record.metadataCID.trim())?.displayGroup?.id ?? null;
}

const text = (value: unknown) =>
  value === null || value === undefined ? "" : typeof value === "string" ? value : String(value);

/**
 * The terms that make two copies the same promise to someone taking one up.
 * The reward amount is not among them (Edit Reward), and neither is anything
 * that changes as a copy is taken up or kept.
 */
function materialTermsKey(record: GroupableCommitment): string {
  const confirmers = [...(record.confirmers ?? [])].map((a) => a.toLowerCase()).sort();
  return [
    record.chainId,
    record.poolId,
    record.cycleId,
    record.creator?.toLowerCase(),
    record.commitmentSeriesId,
    record.direction,
    record.commitmentType,
    record.claimMode,
    record.contributorPolicy,
    record.unitLabel,
    record.targetUnits,
    record.dueDate,
    record.requiresAssessment,
    confirmers.join(","),
    record.confirmationThreshold,
    record.protocolFallbackEnabled,
    record.considerationRail,
    record.considerationSource?.toLowerCase(),
    record.considerationToken?.toLowerCase(),
    record.needUID,
    record.counterCommitmentId,
    record.declaredUnitValue,
    record.declaredValueBasis,
  ]
    .map(text)
    .join("|");
}

/**
 * Fold copies of one set into one entry, in the order the list was given: a
 * group takes the place of its first copy. `minimum` is how many published
 * copies a group needs to show as one; below it they stay ordinary rows.
 */
export function groupCommitmentsForDisplay<T extends GroupableCommitment>(input: {
  commitments: readonly T[];
  metadataByCID: ReadonlyMap<string, CommitmentMetadataV1>;
  minimum?: number;
}): DisplayEntry<T>[] {
  const minimum = Math.max(1, input.minimum ?? 2);
  const groups = new Map<string, DisplayGroupEntry<T>>();
  const order: Array<{ single: T } | { group: string }> = [];
  for (const record of input.commitments) {
    const displayGroupId = displayGroupIdOf(record, input.metadataByCID);
    if (!displayGroupId) {
      order.push({ single: record });
      continue;
    }
    const key = `${displayGroupId}|${materialTermsKey(record)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.children.push(record);
      continue;
    }
    groups.set(key, {
      kind: "group",
      key,
      displayGroupId,
      children: [record],
      counts: countDisplayGroup([]),
    });
    order.push({ group: key });
  }
  return order.flatMap((slot): DisplayEntry<T>[] => {
    if ("single" in slot) return [{ kind: "single", record: slot.single }];
    const group = groups.get(slot.group) as DisplayGroupEntry<T>;
    if (group.children.length < minimum) {
      return group.children.map((record) => ({ kind: "single", record }));
    }
    return [{ ...group, counts: countDisplayGroup(group.children) }];
  });
}

/**
 * Edit Reward, for a group or a single commitment (D14): open until one copy is
 * kept, and it changes only the copies nobody has taken, because the contract
 * locks a reward at take-up. A copy still waiting to be created keeps the
 * reward it was frozen with, so the edit waits until none is left.
 */
export function selectRewardEdit<T extends Pick<GroupableCommitment, "onchainState">>(
  children: readonly T[],
  options: { unsent?: number } = {}
): { open: true; targets: T[] } | { open: false; reason: "kept" | "unsent" | "none-available" } {
  if (children.some((child) => child.onchainState === "FULFILLED")) {
    return { open: false, reason: "kept" };
  }
  if ((options.unsent ?? 0) > 0) return { open: false, reason: "unsent" };
  const targets = children.filter((child) => displayBucketOf(child.onchainState) === "available");
  return targets.length > 0 ? { open: true, targets } : { open: false, reason: "none-available" };
}
