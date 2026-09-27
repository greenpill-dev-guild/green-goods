import type { ChallengeResponse, OperationView } from "../../modules/agent-reporting/api-contract";
import {
  type EnvelopeIssue,
  envelopeIssues,
  resolveReportingDeployment,
} from "../../modules/agent-reporting/envelope";

/** Where a ceremony page stands, derived from the Agent's records rather than kept locally. */
export type CeremonyStage =
  | "intro"
  | "opening"
  | "connect"
  | "proving"
  | "pairing"
  | "linked"
  | "loading"
  | "review"
  | "signing"
  | "submitted"
  | "published"
  | "not_sent"
  | "failed"
  | "unavailable"
  | "unsupported";

const ACTIVE_ATTEMPTS = new Set(["reserved", "wallet_pending", "signed", "broadcast", "uncertain"]);
// Permission grants and recovery have their own pages; this one links, publishes and reviews.
export const PURPOSES = new Set<ChallengeResponse["purpose"]>([
  "link_account",
  "publish_work",
  "review_decision",
]);

export function stageForOperation(operation: OperationView | null): CeremonyStage {
  if (!operation) return "unavailable";
  switch (operation.state) {
    case "published":
      return "published";
    case "sending":
    case "reconciling":
      return "submitted";
    case "prepared":
      return operation.authorizationMode === "delegated" ||
        (operation.attempt && ACTIVE_ATTEMPTS.has(operation.attempt.state))
        ? "submitted"
        : "review";
    case "failed":
      return operation.failureCode === "rejected_before_send" ? "not_sent" : "failed";
    case "preparation_failed":
    case "cancelled":
      return "failed";
    default:
      // Created or preparing: the frozen envelope is not ready yet.
      return "loading";
  }
}

export function issuesFor(operation: OperationView | null): EnvelopeIssue[] {
  const envelope = operation?.envelope;
  if (!envelope) return [];
  try {
    return envelopeIssues(envelope, {
      deployment: resolveReportingDeployment(envelope.chainId),
      account: envelope.accountAddress,
    });
  } catch {
    return ["wrong_chain"];
  }
}
