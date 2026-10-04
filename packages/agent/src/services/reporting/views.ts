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
    { label: "Activity", value: snapshot?.definition.title ?? "" },
    {
      label: "Time spent",
      value: content.timeSpentMinutes === null ? "" : formatMinutes(content.timeSpentMinutes),
    },
    { label: "Description", value: content.feedback ?? "" },
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
      ? ["", "Low", "Medium", "High"][content.confidence]
      : "None";
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
      { label: "Work", value: content.workUID },
      { label: "Gardener", value: content.gardenerAddress },
      { label: "Decision", value: content.decision === "reject" ? "Reject" : "Approve" },
      { label: "Confidence", value: confidence ?? "" },
      { label: "Feedback", value: content.feedback ?? "" },
      { label: "Method", value: "Human review" },
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
