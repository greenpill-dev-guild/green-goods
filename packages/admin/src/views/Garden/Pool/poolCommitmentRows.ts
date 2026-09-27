import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";

export type PoolCommitmentScope = "open" | "confirmed" | "past";

/** A stats count's own list; null is the scope chips' ordinary list. */
export type PoolCommitmentFocus = "pastDue" | "recovery" | null;

/** Keep scope, count focus, and the displayed-title search in one projection. */
export function selectPoolCommitmentRows({
  model,
  scope,
  focus,
  search,
  titleOf,
}: {
  model: Pick<PoolConsoleController["model"], "groups" | "dueLive" | "needsRecovery">;
  scope: PoolCommitmentScope;
  focus: PoolCommitmentFocus;
  search: string;
  titleOf: (row: CommitmentReadModel) => string;
}): CommitmentReadModel[] {
  const base =
    focus === "pastDue"
      ? model.dueLive
      : focus === "recovery"
        ? model.needsRecovery
        : model.groups[scope];
  const needle = search.trim().toLowerCase();
  return needle ? base.filter((row) => titleOf(row).toLowerCase().includes(needle)) : base;
}
