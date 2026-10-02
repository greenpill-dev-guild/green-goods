import type { CeremonyAccount } from "./useCeremonyAccount";
import type { CeremonyFailure } from "./ceremony-storage";
import type {
  AccessResponse,
  ChallengeResponse,
  GrantView,
  OperationView,
  ResourceView,
} from "../../modules/agent-reporting/api-contract";
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
  | "unsupported"
  | "grant_ready"
  | "grant_signing"
  | "grant_submitted"
  | "grant_active";

const ACTIVE_ATTEMPTS = new Set(["reserved", "wallet_pending", "signed", "broadcast", "uncertain"]);
// Permission grants and recovery have their own pages; this one links, publishes and reviews.
export const PURPOSES = new Set<ChallengeResponse["purpose"]>([
  "link_account",
  "publish_work",
  "review_decision",
  "grant_reporting",
  "grant_review",
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

export function stageForGrant(state: string): CeremonyStage {
  if (state === "active") return "grant_active";
  if (["owner_authorization_pending", "proposed"].includes(state)) return "grant_ready";
  if (["enabling", "reconciling_setup"].includes(state)) return "grant_submitted";
  return state === "paused" || state === "failed" ? "failed" : "unavailable";
}

/** Browser-scoped proof and publication flow; signing requires an explicit owner action.
 * Frozen envelopes are checked locally; the chain reconciles every uncertain send. */
export interface AgentReportingCeremony extends Omit<CeremonyAccount, "prove"> {
  stage: CeremonyStage;
  purpose: ChallengeResponse["purpose"] | null;
  channelLabel: string | null;
  pairingCode: string | null;
  sessionAccount: AccessResponse["account"] | null;
  resource: ResourceView | null;
  operation: OperationView | null;
  grant: GrantView | null;
  issues: EnvelopeIssue[];
  error: CeremonyFailure | null;
  start: () => Promise<void>;
  prove: () => Promise<void>;
  publish: () => Promise<void>;
  installGrant: () => Promise<void>;
  leave: () => Promise<void>;
}
