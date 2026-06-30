import type { ArrivalKind } from "@green-goods/shared";

/**
 * What the arrival toast's single action does. Resolved to a concrete side effect in Home
 * (the handlers depend on client routes + the UI store, so they can't live in shared).
 */
export type ArrivalActionKind =
  | "openWorkDashboardPending"
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
  member: {
    status: "info",
    titleId: "app.home.arrival.member.title",
    messageId: "app.home.arrival.member.message",
    actionLabelId: "app.home.arrival.member.action",
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
