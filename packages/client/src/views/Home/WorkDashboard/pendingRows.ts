import type { WorkDashboardPendingFilter } from "@green-goods/shared/stores/useUIStore";
import type { PendingCardKind } from "@/components/Cards/Work/PendingCard";

export type PendingKind = PendingCardKind;

/**
 * The list answers in this order (D12, O2): what can't go without you, work
 * waiting for your review, what's ready to upload, drafts, anything being
 * checked, then sent work in review.
 */
const KIND_ORDER: readonly PendingKind[] = [
  "needs",
  "needsReview",
  "upload",
  "draft",
  "checking",
  "review",
];

/** The filter that holds each kind. */
const FILTER_OF_KIND: Record<PendingKind, Exclude<WorkDashboardPendingFilter, "all">> = {
  needs: "needs",
  needsReview: "needsReview",
  upload: "upload",
  draft: "editing",
  checking: "checking",
  review: "review",
};

/** The filter select's options, in the list's order. */
const FILTER_ORDER: readonly WorkDashboardPendingFilter[] = [
  "all",
  "needs",
  "needsReview",
  "upload",
  "editing",
  "checking",
  "review",
];

export interface PendingPlace {
  kind: PendingKind;
  /** Within a kind, work comes before proof, as the frames list them. */
  source: "work" | "proof";
  /** When it was saved, edited or submitted, in milliseconds. */
  at: number;
}

/** One list sorted by what needs you; within a need, work before proof, newest first. */
export function sortPendingRows<T extends PendingPlace>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (left, right) =>
      KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
      Number(left.source === "proof") - Number(right.source === "proof") ||
      right.at - left.at
  );
}

/** Whether a filter lists rows of this kind. */
function filterHolds(filter: WorkDashboardPendingFilter, kind: PendingKind): boolean {
  return filter === "all" || FILTER_OF_KIND[kind] === filter;
}

/** Where a read behind the list stands. */
export interface PendingRead {
  isLoading: boolean;
  isError: boolean;
}

/**
 * The kinds of row each read can list: the work waiting for your review with
 * the reviews you made here, your own work, and the proof this phone's queue
 * holds. Drafts are on this phone and never wait.
 */
const KINDS_BY_READ = {
  needsReview: ["needsReview", "needs", "upload", "checking"],
  myWork: ["needs", "upload", "checking", "review"],
  queue: ["needs", "upload", "checking"],
} as const satisfies Record<string, readonly PendingKind[]>;

export type PendingReadName = keyof typeof KINDS_BY_READ;

/**
 * The reads that could fill a filter, taken together: whether any is still
 * loading, and which failed. A filter that shows nothing answers to these alone.
 */
export function readsBehindFilter(
  filter: WorkDashboardPendingFilter,
  reads: Record<PendingReadName, PendingRead>
): { isLoading: boolean; failed: PendingReadName[] } {
  const behind = (Object.keys(KINDS_BY_READ) as PendingReadName[]).filter((read) =>
    KINDS_BY_READ[read].some((kind) => filterHolds(filter, kind))
  );
  return {
    isLoading: behind.some((read) => reads[read].isLoading),
    failed: behind.filter((read) => reads[read].isError),
  };
}

export function filterPendingRows<T extends Pick<PendingPlace, "kind">>(
  rows: readonly T[],
  filter: WorkDashboardPendingFilter
): T[] {
  return rows.filter((row) => filterHolds(filter, row.kind));
}

/**
 * The filters worth offering (D17): All, then each state the list holds. A
 * filter with nothing in it is left out, except the one in use, so the select
 * never shows a choice it doesn't list. Needs review only ever holds work for
 * a steward, so only stewards see it.
 */
export function pendingFilterOptions(
  rows: readonly Pick<PendingPlace, "kind">[],
  active: WorkDashboardPendingFilter
): WorkDashboardPendingFilter[] {
  const present = new Set(rows.map((row) => FILTER_OF_KIND[row.kind]));
  return FILTER_ORDER.filter(
    (filter) => filter === "all" || filter === active || present.has(filter)
  );
}
