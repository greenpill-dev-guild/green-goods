import type { CommitmentWorkDecision } from "./work-decisions";

export interface SubmittedWorkDecisionIdentity {
  workUID: string;
  decisionUID: string;
}

export type WorkDecisionReadbackStatus =
  | "idle"
  | "pending"
  | "succeeded"
  | "unavailable"
  | "needsFreshReview";

/** Counted-only indexed readback for one steward reconciliation submission. */
export function selectWorkDecisionReadback(input: {
  submitted: readonly SubmittedWorkDecisionIdentity[];
  byWorkUID: ReadonlyMap<string, CommitmentWorkDecision>;
  readAvailable: boolean;
  isError: boolean;
}): WorkDecisionReadbackStatus {
  if (input.submitted.length === 0) return "idle";
  const rows = input.submitted.map((submitted) => ({
    submitted,
    current: input.byWorkUID.get(submitted.workUID.toLowerCase()),
  }));
  if (rows.some(({ current }) => current?.state === "needsFreshReview")) {
    return "needsFreshReview";
  }
  if (
    !input.readAvailable ||
    input.isError ||
    rows.some(({ current }) => current?.state === "unavailable")
  ) {
    return "unavailable";
  }
  return rows.every(
    ({ submitted, current }) =>
      current?.state === "counted" &&
      current.currentDecisionUID?.toLowerCase() === submitted.decisionUID.toLowerCase()
  )
    ? "succeeded"
    : "pending";
}
