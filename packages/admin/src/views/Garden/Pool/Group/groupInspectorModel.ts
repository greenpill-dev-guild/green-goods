/**
 * What the group inspector lists (PRD-1022 D3, screen 14): the copies someone
 * took, each led by the person, with when they took it, where the proof
 * stands and who confirmed it; and the copies nobody has taken, as one row.
 * Every copy keeps its own lifecycle, so nothing here is a group decision.
 *
 * The dates come from the pool's activity, newest first and bounded; a fact
 * the window doesn't reach is left out rather than guessed. What the record
 * itself says (proof count, state) never depends on the window.
 */

import {
  type DisplayBucket,
  displayBucketOf,
} from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type {
  CommitmentEventRecord,
  CommitmentReadModel,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";

/** The inspector's filter: every copy, or one count's. */
export type GroupScope = "all" | Exclude<DisplayBucket, "other">;

export interface GroupTakenRow {
  commitment: CommitmentReadModel;
  bucket: DisplayBucket;
  /** Which of this person's copies it is, from 1, in the order they took them. */
  nth: number;
  /** In milliseconds, when the window reaches them. */
  tookAt: number | null;
  proofAt: number | null;
  confirmedAt: number | null;
  confirmedBy: Address | null;
}

export interface GroupInspectorRows {
  taken: GroupTakenRow[];
  /** Copies nobody has taken: one row in the list. */
  available: CommitmentReadModel[];
}

// Most in need of attention first: waiting to be confirmed, proof in, in progress.
const BUCKET_ORDER: Record<DisplayBucket, number> = {
  inProgress: 0,
  kept: 1,
  ended: 2,
  other: 3,
  available: 4,
};

function attention(commitment: CommitmentReadModel): number {
  if (commitment.onchainState === "READY_FOR_CONFIRMATION") return 0;
  return commitment.evidenceCount > 0 ? 1 : 2;
}

/** The latest event of a kind for a copy, or the earliest with `first`. */
function eventFor(
  events: readonly CommitmentEventRecord[],
  commitmentId: bigint,
  type: string,
  first = false
): CommitmentEventRecord | null {
  const matching = events.filter(
    (event) => event.commitmentId === commitmentId && event.eventType === type
  );
  if (matching.length === 0) return null;
  const sorted = [...matching].sort((a, b) => a.timestamp - b.timestamp);
  return (first ? sorted[0] : sorted[sorted.length - 1]) ?? null;
}

export function groupInspectorRows(
  children: readonly CommitmentReadModel[],
  events: readonly CommitmentEventRecord[]
): GroupInspectorRows {
  const available: CommitmentReadModel[] = [];
  const taken: GroupTakenRow[] = [];
  for (const commitment of children) {
    const bucket = displayBucketOf(commitment.onchainState);
    if (bucket === "available") {
      available.push(commitment);
      continue;
    }
    const took = eventFor(events, commitment.commitmentId, "ACCEPTED", true);
    const proof = eventFor(events, commitment.commitmentId, "EVIDENCE_ATTACHED");
    const confirmed = eventFor(events, commitment.commitmentId, "CONFIRMATION_RECORDED");
    taken.push({
      commitment,
      bucket,
      nth: 1,
      tookAt: took ? took.timestamp * 1000 : null,
      proofAt: proof ? proof.timestamp * 1000 : null,
      confirmedAt: confirmed ? confirmed.timestamp * 1000 : null,
      confirmedBy: confirmed?.actor ?? null,
    });
  }

  // Repeat participation: count each person's copies in the order they took them.
  const byPerson = new Map<string, GroupTakenRow[]>();
  for (const row of taken) {
    const who = row.commitment.counterparty?.toLowerCase();
    if (who) byPerson.set(who, [...(byPerson.get(who) ?? []), row]);
  }
  for (const rows of byPerson.values()) {
    rows
      .sort(
        (a, b) =>
          (a.tookAt ?? Number(a.commitment.commitmentId)) -
          (b.tookAt ?? Number(b.commitment.commitmentId))
      )
      .forEach((row, index) => {
        row.nth = index + 1;
      });
  }

  taken.sort(
    (a, b) =>
      BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] ||
      attention(a.commitment) - attention(b.commitment) ||
      Number(a.commitment.commitmentId - b.commitment.commitmentId)
  );
  return { taken, available };
}

/** The rows a filter keeps, and whether the not-taken row shows under it. */
export function scopeRows(
  rows: GroupInspectorRows,
  scope: GroupScope
): { taken: GroupTakenRow[]; showAvailable: boolean } {
  return {
    taken: scope === "all" ? rows.taken : rows.taken.filter((row) => row.bucket === scope),
    showAvailable: (scope === "all" || scope === "available") && rows.available.length > 0,
  };
}
