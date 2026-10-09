import type { CeremonyAccount } from "./useCeremonyAccount";
import type { CeremonyFailure } from "./ceremony-storage";
import type { CommunityOffer } from "./community-offer";
import { agentReportingKeys } from "../../config/query-keys/agent-reporting";
import type { Address } from "../../types/domain";
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

/** What a status check reads from the ceremony's state. */
interface PollState {
  stage: CeremonyStage;
  error: CeremonyFailure | null;
  operation: OperationView | null;
  grant: GrantView | null;
}

/**
 * Whether the page keeps asking the Agent where things stand: while a chat pairs, while a request
 * is prepared or on its way, and for as long as an outcome is unknown, whichever stage that
 * surfaced in. Without an operation or grant there is nothing to ask about.
 */
export function shouldPollCeremony(state: PollState): boolean {
  if (state.stage === "pairing" || state.stage === "grant_submitted") return true;
  const waiting =
    state.stage === "loading" || state.stage === "submitted" || state.error === "outcome_unknown";
  return waiting && Boolean(state.operation || state.grant);
}

/** The record a status check reads: the grant's activation, the chat pairing, or the operation. */
export function ceremonyPollKey(state: PollState, challengeId: string | null) {
  if (state.grant && (state.stage === "grant_submitted" || state.stage === "loading")) {
    return agentReportingKeys.activation(state.grant.grantId);
  }
  return state.stage === "pairing"
    ? agentReportingKeys.challenge(challengeId ?? "none")
    : agentReportingKeys.operation(state.operation?.operationId ?? "none");
}

/** Only a final answer from the chain settles an unknown outcome; until then it stays. */
export function settlesUnknownOutcome(stage: CeremonyStage): boolean {
  return stage === "published" || stage === "failed" || stage === "not_sent";
}

/** Browser-scoped proof and publication flow; signing requires an explicit owner action.
 * Frozen envelopes are checked locally; the chain reconciles every uncertain send. */
export interface AgentReportingCeremony extends Omit<CeremonyAccount, "prove"> {
  inAppBrowser: boolean;
  passkeyUnavailable: boolean;
  linkCopied: boolean;
  openInBrowser: () => Promise<void>;
  stage: CeremonyStage;
  purpose: ChallengeResponse["purpose"] | null;
  channelLabel: string | null;
  pairingCode: string | null;
  /** The account this browser's challenge proved: the one the chat links, whatever is connected. */
  linkedAccount: Address | null;
  /** Settled before the link step opens, so the code screen never turns into an invitation. */
  communityOffer: CommunityOffer | null;
  joinFailure: "declined" | "not_sent" | null;
  joinSending: boolean;
  skipCommunity: () => void;
  joinCommunity: () => Promise<void>;
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
