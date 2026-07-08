import type { ArrivalKind } from "@green-goods/shared";

/**
 * What the arrival toast's single action does. Resolved to a concrete side effect in Home
 * (the handlers depend on client routes + the UI store, so they can't live in shared).
 */
export type ArrivalActionKind =
  | "openWorkDashboardPending"
  | "openWorkDashboardNeedsReview"
  | "openWorkDashboardDrafts"
  | "startWork"
  | "openHelp";

export interface ArrivalToastSpec {
  /** toastService status shortcut. Orientation toasts use `info` — they point, they don't alarm. */
  status: "info" | "error";
  titleId: string;
  messageId: string;
  actionLabelId: string;
  action: ArrivalActionKind;
}

/**
 * Maps each actionable arrival kind to its copy + single next action. `none` resolves to no toast,
 * so it is intentionally excluded. The `*Id` values are literal `app.home.arrival.*` strings so the
 * shared locale-coverage gate's source-usage scan can see them.
 *
 * The `review` message carries a `{count}` placeholder — Home formats it with the
 * `needsReviewCount` from useArrivalState.
 */
export const ARRIVAL_TOASTS: Record<Exclude<ArrivalKind, "none">, ArrivalToastSpec> = {
  queue: {
    status: "info",
    titleId: "app.home.arrival.queue.title",
    messageId: "app.home.arrival.queue.message",
    actionLabelId: "app.home.arrival.queue.action",
    action: "openWorkDashboardPending",
  },
  draft: {
    status: "info",
    titleId: "app.home.arrival.draft.title",
    messageId: "app.home.arrival.draft.message",
    actionLabelId: "app.home.arrival.draft.action",
    action: "openWorkDashboardDrafts",
  },
  review: {
    status: "info",
    titleId: "app.home.arrival.review.title",
    messageId: "app.home.arrival.review.message",
    actionLabelId: "app.home.arrival.review.action",
    action: "openWorkDashboardNeedsReview",
  },
  operatorClear: {
    status: "info",
    titleId: "app.home.arrival.operatorClear.title",
    messageId: "app.home.arrival.operatorClear.message",
    actionLabelId: "app.home.arrival.operatorClear.action",
    action: "startWork",
  },
  gardener: {
    status: "info",
    titleId: "app.home.arrival.gardener.title",
    messageId: "app.home.arrival.gardener.message",
    actionLabelId: "app.home.arrival.gardener.action",
    action: "startWork",
  },
  signedIn: {
    status: "info",
    titleId: "app.home.arrival.signedIn.title",
    messageId: "app.home.arrival.signedIn.message",
    actionLabelId: "app.home.arrival.signedIn.action",
    action: "openHelp",
  },
};
