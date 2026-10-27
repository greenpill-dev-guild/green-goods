import type {
  PoolConsoleController,
  VoucherConsoleView,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  type DisplayEntry,
  type DisplayGroupEntry,
  groupCommitmentsForDisplay,
} from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";

export type PoolCommitmentScope = "open" | "confirmed" | "past";

/** A stats count's own list; null is the scope chips' ordinary list. */
export type PoolCommitmentFocus = "pastDue" | "recovery" | null;

/** One row of Offers and Requests: a promise, or a group of copies made together. */
export type PoolCommitmentEntry = DisplayEntry<CommitmentReadModel>;
export type PoolCommitmentGroup = DisplayGroupEntry<CommitmentReadModel>;

/**
 * The pool's recovery list with the voucher bookings whose return didn't go
 * through added (PRD-1297): anyone can retry the same transfer, so they need
 * recovery like a past-due or disputed promise, and the count follows.
 */
export function withVoucherRecovery<
  M extends Pick<PoolConsoleController["model"], "needsRecovery" | "counts">,
>(
  model: M,
  commitments: readonly CommitmentReadModel[],
  vouchers: Pick<VoucherConsoleView, "bookingFor">
): M {
  const listed = new Set(model.needsRecovery.map((row) => row.id));
  const failed = commitments.filter(
    (row) =>
      !listed.has(row.id) &&
      ["return-failed", "transfer-failed", "transfer-pending"].includes(
        vouchers.bookingFor(row.commitmentId)?.stage.kind ?? ""
      )
  );
  if (failed.length === 0) return model;
  const needsRecovery = [...model.needsRecovery, ...failed];
  return {
    ...model,
    needsRecovery,
    counts: { ...model.counts, needsRecovery: needsRecovery.length },
  };
}

/** A group as the pool reads it now, so an open inspector follows its counts. */
export function currentGroup(
  commitments: readonly CommitmentReadModel[],
  metadataByCID: PoolConsoleController["titles"],
  key: string
): PoolCommitmentGroup | null {
  for (const entry of groupCommitmentsForDisplay({ commitments, metadataByCID })) {
    if (entry.kind === "group" && entry.key === key) return entry;
  }
  return null;
}

/**
 * Keep scope, count focus, and the displayed-title search in one projection.
 *
 * In a scope's list, copies made together fold into one group row (PRD-1022
 * D3) that counts every copy of the group, whichever scope each copy is in; the
 * row sits where the group's first copy in this scope would. A count's own
 * list (past due, needs recovery) names each promise on its own: attention
 * always surfaces one promise at a time. So does a copy that `standsAlone`
 * (a voucher booking waiting on the steward's act, PRD-1297), beside the group
 * that still counts it.
 */
export function selectPoolCommitmentRows({
  model,
  commitments,
  metadataByCID,
  scope,
  focus,
  search,
  titleOf,
  standsAlone,
}: {
  model: Pick<PoolConsoleController["model"], "groups" | "dueLive" | "needsRecovery">;
  /** Every promise in the pool, for whole-group counts. */
  commitments: readonly CommitmentReadModel[];
  metadataByCID: PoolConsoleController["titles"];
  scope: PoolCommitmentScope;
  focus: PoolCommitmentFocus;
  search: string;
  titleOf: (row: CommitmentReadModel) => string;
  /** A copy that needs the steward on its own row, out of its group's fold. */
  standsAlone?: (row: CommitmentReadModel) => boolean;
}): PoolCommitmentEntry[] {
  const base =
    focus === "pastDue"
      ? model.dueLive
      : focus === "recovery"
        ? model.needsRecovery
        : model.groups[scope];
  const needle = search.trim().toLowerCase();
  const rows = needle ? base.filter((row) => titleOf(row).toLowerCase().includes(needle)) : base;
  if (focus !== null) return rows.map((record) => ({ kind: "single", record }));

  const groupOf = new Map<string, PoolCommitmentGroup>();
  for (const entry of groupCommitmentsForDisplay({ commitments, metadataByCID })) {
    if (entry.kind === "group") for (const child of entry.children) groupOf.set(child.id, entry);
  }
  const placed = new Set<string>();
  return rows.flatMap((record): PoolCommitmentEntry[] => {
    const group = groupOf.get(record.id);
    if (!group) return [{ kind: "single", record }];
    // The group still counts a copy that stands alone, and keeps its row when every copy does.
    const own: PoolCommitmentEntry[] = standsAlone?.(record) ? [{ kind: "single", record }] : [];
    if (placed.has(group.key)) return own;
    placed.add(group.key);
    return [group, ...own];
  });
}
