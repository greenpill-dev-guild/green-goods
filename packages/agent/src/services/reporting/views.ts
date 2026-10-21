import type { OperationView, ResourceView } from "@green-goods/shared/modules/agent-reporting";
import { latestAttempt } from "./attempts";
import { currentConfirmation } from "./confirmations";
import { formatMinutes, gardenLabel } from "./coordinator/prompting";
import { lifecycleState } from "./coordinator/draft-commit";
import { DraftContentUnavailableError, loadDraft } from "./drafts";
import { type OperationRecord, operationForSubject } from "./operations";
import { loadReview, reviewState } from "./reviews";
import type { ReportingCore } from "./runtime";
import type { BrowserSession } from "./sessions";

// The labels and values the signing and review pages show; the agent's copy test reads them here.
const VIEW_COPY = {
  activity: "Activity",
  timeSpent: "Time spent",
  description: "Description",
  work: "Work",
  gardener: "Gardener",
  decision: "Decision",
  approve: "Approve",
  reject: "Reject",
  confidence: "Confidence",
  confidenceLevels: ["", "Low", "Medium", "High"],
  noConfidence: "None",
  feedback: "Feedback",
  method: "Method",
  humanReview: "Human review",
} as const;

/**
 * Read models for the browser ceremony, built from validated state rather than model wording.
 * A draft view names exactly what the confirmation covered; private provenance and raw source
 * messages never leave the Agent.
 */
export function operationView(core: ReportingCore, operation: OperationRecord): OperationView {
  const attempt = latestAttempt(core, operation.id);
  const exposeEnvelope = ["prepared", "sending", "reconciling", "published"].includes(
    operation.state
  );
  return {
    operationId: operation.id,
    kind: operation.kind,
    state: operation.state,
    authorizationMode: operation.authorizationMode,
    attemptVersion: operation.attemptVersion,
    envelope: exposeEnvelope ? operation.envelope : null,
    attempt: attempt
      ? { attemptId: attempt.id, attemptNumber: attempt.attemptNumber, state: attempt.state }
      : null,
    transactionHash: operation.transactionHash as `0x${string}` | null,
    attestationUid: operation.attestationUid as `0x${string}` | null,
    failureCode: operation.failureCode,
  };
}

export function draftView(core: ReportingCore, draftId: string): ResourceView | null {
  let draft;
  try {
    draft = loadDraft(core, draftId);
  } catch (error) {
    if (error instanceof DraftContentUnavailableError) return null;
    throw error;
  }
  if (!draft) return null;
  const { content, snapshot } = draft;
  const lines = [
    { label: VIEW_COPY.activity, value: snapshot?.definition.title ?? "" },
    {
      label: VIEW_COPY.timeSpent,
      value: content.timeSpentMinutes === null ? "" : formatMinutes(content.timeSpentMinutes),
    },
    { label: VIEW_COPY.description, value: content.feedback ?? "" },
    ...(snapshot?.definition.inputs ?? [])
      .filter((input) => content.details[input.key] !== undefined)
      .map((input) => {
        const value = content.details[input.key];
        const labels = input.type === "band" ? input.bandLabels : input.optionLabels;
        const text = Array.isArray(value)
          ? value.map((key) => labels?.[key] ?? key).join(", ")
          : typeof value === "number"
            ? `${value}${input.unit ? ` ${input.unit}` : ""}`
            : (labels?.[String(value)] ?? String(value));
        return { label: input.title, value: text };
      }),
  ];
  const confirmation = currentConfirmation(core, { draftId });
  const operation = operationForSubject(core, { draftId });
  return {
    ok: true,
    kind: "draft",
    resourceId: draft.id,
    revision: draft.revision,
    state: lifecycleState(draft),
    gardenLabel: gardenLabel(core.gardens, content.garden?.address),
    title: content.title ?? "",
    lines,
    evidence: content.evidence.map((item) => ({
      assetId: item.assetId,
      mime: item.mime,
      digest: item.sanitizedDigest,
    })),
    summaryDigest: (confirmation?.summaryDigest as `0x${string}` | undefined) ?? null,
    operation: operation && operation.state !== "cancelled" ? operationView(core, operation) : null,
  };
}

/**
 * A steward's decision as the signing page shows it: the published work it concerns and the exact
 * decision fields that become public. The gardener's private draft material is never included.
 */
export function reviewView(core: ReportingCore, reviewId: string): ResourceView | null {
  const review = loadReview(core, reviewId);
  if (!review) return null;
  const { content } = review;
  const confidence =
    content.decision === "approve" && content.confidence
      ? VIEW_COPY.confidenceLevels[content.confidence]
      : VIEW_COPY.noConfidence;
  const confirmation = currentConfirmation(core, { reviewIntentId: review.id });
  const operation = operationForSubject(core, { reviewIntentId: review.id });
  return {
    ok: true,
    kind: "review",
    resourceId: review.id,
    revision: review.revision,
    state: reviewState(review),
    gardenLabel: gardenLabel(core.gardens, content.gardenAddress),
    title: review.workTitle,
    lines: [
      { label: VIEW_COPY.work, value: content.workUID },
      { label: VIEW_COPY.gardener, value: content.gardenerAddress },
      {
        label: VIEW_COPY.decision,
        value: content.decision === "reject" ? VIEW_COPY.reject : VIEW_COPY.approve,
      },
      { label: VIEW_COPY.confidence, value: confidence ?? "" },
      { label: VIEW_COPY.feedback, value: content.feedback ?? "" },
      { label: VIEW_COPY.method, value: VIEW_COPY.humanReview },
    ],
    evidence: [],
    summaryDigest: (confirmation?.summaryDigest as `0x${string}` | undefined) ?? null,
    operation: operation && operation.state !== "cancelled" ? operationView(core, operation) : null,
  };
}

/** True when the operation belongs to the session's own draft or decision and account. */
export function sessionOwnsOperation(session: BrowserSession, operation: OperationRecord): boolean {
  const { resourceKind, resourceId } = session.request;
  const resource =
    resourceKind === "draft"
      ? operation.draftId
      : resourceKind === "review"
        ? operation.reviewIntentId
        : null;
  return (
    resource !== null &&
    resource === resourceId &&
    operation.authorAccountId === session.accountBindingId
  );
}
