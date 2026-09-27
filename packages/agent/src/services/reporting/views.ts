import type { OperationView, ResourceView } from "@green-goods/shared/modules/agent-reporting";
import { latestAttempt } from "./attempts";
import { currentConfirmation } from "./confirmations";
import { formatMinutes, gardenLabel } from "./coordinator/prompting";
import { lifecycleState } from "./coordinator/draft-commit";
import { DraftContentUnavailableError, loadDraft } from "./drafts";
import { type OperationRecord, operationForSubject } from "./operations";
import type { ReportingCore } from "./runtime";

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
    gardenLabel: gardenLabel(core.settings.gardens, content.garden?.address),
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
