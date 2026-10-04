import type { Address, Hex } from "viem";
import type { ActionDefinitionSnapshot } from "./action-snapshot";
import { reportingDigest } from "./canonical";
import {
  type DetailValue,
  type EvidenceItem,
  type GardenRef,
  type ReportContent,
  type ReportField,
  reportContentDigest,
} from "./report";

export type ReportRequirement =
  | { kind: "conflict"; field: ReportField }
  | { kind: "garden" }
  | { kind: "action" }
  | { kind: "unsupported_input"; key: string }
  | { kind: "detail"; key: string }
  | { kind: "time" }
  | { kind: "title" }
  | { kind: "feedback" }
  | { kind: "evidence"; minimum: number; have: number }
  | { kind: "evidence_limit"; maximum: number; have: number };

export function minimumEvidence(snapshot: ActionDefinitionSnapshot): number {
  const { required, minImageCount } = snapshot.definition.media;
  return required ? Math.max(1, minImageCount) : Math.max(0, minImageCount);
}

/**
 * What still blocks confirmation, in the order the conversation should resolve it. Contradictions
 * come first so the agent asks before building on a disputed value; time spent must come from the
 * gardener's words or an identified document, never from what a photograph appears to show.
 */
export function outstandingRequirements(
  content: ReportContent,
  snapshot: ActionDefinitionSnapshot | null
): ReportRequirement[] {
  const requirements: ReportRequirement[] = content.conflicts.map((conflict) => ({
    kind: "conflict" as const,
    field: conflict.field,
  }));
  if (!content.garden) requirements.push({ kind: "garden" });
  if (
    content.actionUID === null ||
    !snapshot ||
    snapshot.definition.actionUID !== content.actionUID
  ) {
    requirements.push({ kind: "action" });
  } else {
    for (const input of snapshot.definition.inputs) {
      if (!input.required) continue;
      if (input.type === "repeater")
        requirements.push({ kind: "unsupported_input", key: input.key });
      else if (content.details[input.key] === undefined)
        requirements.push({ kind: "detail", key: input.key });
    }
  }
  const time = content.provenance.timeSpentMinutes;
  if (content.timeSpentMinutes === null || !time || time.kind === "observed") {
    requirements.push({ kind: "time" });
  }
  if (!content.title) requirements.push({ kind: "title" });
  if (!content.feedback) requirements.push({ kind: "feedback" });
  if (snapshot) {
    const minimum = minimumEvidence(snapshot);
    const maximum = snapshot.definition.media.maxImageCount;
    if (content.evidence.length < minimum) {
      requirements.push({ kind: "evidence", minimum, have: content.evidence.length });
    }
    if (maximum !== null && content.evidence.length > maximum) {
      requirements.push({ kind: "evidence_limit", maximum, have: content.evidence.length });
    }
  }
  return requirements;
}

/** Stable place of a field question in the activity's required questions. Selection and
 * contradictions have no number; answered fields retain their place as the report progresses. */
export function reportQuestionPosition(
  content: ReportContent,
  snapshot: ActionDefinitionSnapshot | null,
  requirement: ReportRequirement
): { position: number; total: number } | null {
  if (!snapshot) return null;
  const questions: ReportRequirement[] = [
    ...snapshot.definition.inputs
      .filter((input) => input.required && input.type !== "repeater")
      .map((input) => ({ kind: "detail" as const, key: input.key })),
    { kind: "time" },
    { kind: "title" },
    { kind: "feedback" },
  ];
  const minimum = minimumEvidence(snapshot);
  if (minimum > 0) questions.push({ kind: "evidence", minimum, have: content.evidence.length });
  const position = questions.findIndex(
    (question) =>
      question.kind === requirement.kind &&
      (question.kind !== "detail" ||
        (requirement.kind === "detail" && question.key === requirement.key))
  );
  return position < 0 ? null : { position: position + 1, total: questions.length };
}

export interface ReportSummary {
  draftId: string;
  revision: number;
  garden: GardenRef;
  actionUID: number;
  actionDefinitionDigest: Hex;
  title: string;
  timeSpentMinutes: number;
  feedback: string;
  details: Record<string, DetailValue>;
  evidence: EvidenceItem[];
  contentDigest: Hex;
  /** The linked account the report will be published from; null until pairing completes. */
  account: Address | null;
}

export class ReportNotReadyError extends Error {
  constructor(readonly requirements: ReportRequirement[]) {
    super("Report has outstanding requirements");
  }
}

export function buildReportSummary(input: {
  draftId: string;
  revision: number;
  content: ReportContent;
  snapshot: ActionDefinitionSnapshot | null;
  account: Address | null;
}): ReportSummary {
  const { content, snapshot } = input;
  const requirements = outstandingRequirements(content, snapshot);
  if (requirements.length > 0 || !snapshot || !content.garden) {
    throw new ReportNotReadyError(requirements);
  }
  return {
    draftId: input.draftId,
    revision: input.revision,
    garden: content.garden,
    actionUID: snapshot.definition.actionUID,
    actionDefinitionDigest: snapshot.digest,
    title: content.title as string,
    timeSpentMinutes: content.timeSpentMinutes as number,
    feedback: content.feedback as string,
    details: content.details,
    evidence: content.evidence,
    contentDigest: reportContentDigest(content),
    account: input.account ? (input.account.toLowerCase() as Address) : null,
  };
}

/** The digest a confirmation token binds: revision, content, Action definition and account. */
export function reportSummaryDigest(summary: ReportSummary): Hex {
  return reportingDigest("report-summary", summary);
}
