import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import type { MessageDescriptor } from "react-intl";
import { STEP_NAMES } from "./messages";

type Stage = AgentReportingCeremony["stage"];

/** Stages after the request left this page: the page names what was sent and where it stands. */
const SENT = new Set<Stage>([
  "linked",
  "submitted",
  "published",
  "not_sent",
  "failed",
  "grant_submitted",
  "grant_active",
]);

/**
 * What a ceremony stage means for the page, read once so the heading, the notice, the bar and the
 * acts all agree on it.
 */
export interface CeremonyScreen {
  stage: Stage;
  isLink: boolean;
  isReview: boolean;
  isGrant: boolean;
  /** A decision is being recorded, on its own or as a review permission's first item. */
  decides: boolean;
  /** Publishing and reviewing take two signatures; the page says so before the first one. */
  twoSignatures: boolean;
  /** A send whose outcome is unknown is never offered again; the chain reconciles it. */
  uncertain: boolean;
  opening: boolean;
  proving: boolean;
  publishing: boolean;
  granting: boolean;
  /** The link can't be used, or the step isn't available here: a state, not a step. */
  unusable: boolean;
  /** The request has left this page, so the page names what was sent and where it stands. */
  sent: boolean;
  /** A permission's second step checks its limits and prepares its first item. */
  permissionStep: boolean;
  /**
   * The flow's named steps and the one in progress, 1-based. Null where nothing is stepped
   * through: before the link is opened, once the request has left the page, and on a dead end.
   */
  steps: { names: MessageDescriptor[]; current: number } | null;
}

export function readCeremonyScreen({
  stage,
  purpose,
  resource,
  error,
}: Pick<AgentReportingCeremony, "stage" | "purpose" | "resource" | "error">): CeremonyScreen {
  const isLink = purpose === "link_account";
  const isReview = purpose === "review_decision";
  const isGrant = purpose === "grant_reporting" || purpose === "grant_review";
  const uncertain = error === "outcome_unknown";
  const opening = stage === "intro" || stage === "opening";
  const proving = stage === "connect" || stage === "proving";
  const unusable = stage === "unavailable" || stage === "unsupported";
  const permissionStep = isGrant && stage === "grant_ready" && !resource;

  const sent = SENT.has(stage) || (uncertain && !opening && !proving && !unusable);
  const current = (() => {
    if (proving) return 1;
    if (isLink) return 2;
    // In the other flows, an account the chat doesn't know yet is linked within the account step.
    if (stage === "pairing") return 1;
    if (isGrant) return permissionStep ? 2 : 3;
    return 2;
  })();
  const names = isLink
    ? [STEP_NAMES.account, STEP_NAMES.link]
    : isGrant
      ? [STEP_NAMES.account, STEP_NAMES.permission, STEP_NAMES.review]
      : [STEP_NAMES.account, STEP_NAMES.review];

  return {
    stage,
    isLink,
    isReview,
    isGrant,
    decides: isReview || purpose === "grant_review",
    twoSignatures: purpose === "publish_work" || isReview || isGrant,
    uncertain,
    opening,
    proving,
    publishing: stage === "review" || stage === "signing",
    granting: stage === "grant_ready" || stage === "grant_signing",
    unusable,
    sent,
    permissionStep,
    steps: opening || unusable || sent || purpose === null ? null : { names, current },
  };
}
