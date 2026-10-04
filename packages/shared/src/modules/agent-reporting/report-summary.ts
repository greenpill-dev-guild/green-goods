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

const FIELD_QUESTIONS = new Set<ReportRequirement["kind"]>([
  "detail",
  "time",
  "title",
  "feedback",
  "evidence",
]);

/** The field questions a report still has to ask, in the order it asks them. */
export function outstandingFieldQuestions(
  content: ReportContent,
  snapshot: ActionDefinitionSnapshot | null
): ReportRequirement[] {
  return outstandingRequirements(content, snapshot).filter((item) =>
    FIELD_QUESTIONS.has(item.kind)
  );
}

function sameQuestion(one: ReportRequirement, other: ReportRequirement): boolean {
  return (
    one.kind === other.kind &&
    (one.kind !== "detail" || (other.kind === "detail" && one.key === other.key))
  );
}

/**
 * The place of a field question among the ones this report puts to the gardener: "2 of 3".
 * `asked` is what the conversation has already asked for this report. A question that was asked
 * and is now answered keeps its place; a field the gardener's story already covered was never
 * asked, so it is left out and the last question is always "n of n". Garden, activity and
 * contradiction questions carry no number, nor does a field asked again to change it.
 */
export function reportQuestionPosition(
  content: ReportContent,
  snapshot: ActionDefinitionSnapshot | null,
  requirement: ReportRequirement,
  asked: readonly ReportRequirement[] = []
): { position: number; total: number } | null {
  if (!snapshot) return null;
  const waiting = outstandingFieldQuestions(content, snapshot);
  const index = waiting.findIndex((question) => sameQuestion(question, requirement));
  if (index < 0) return null;
  // A detail of an activity the report no longer names is not one of this report's questions.
  const required = (question: ReportRequirement) =>
    question.kind !== "detail" ||
    snapshot.definition.inputs.some(
      (input) => input.key === question.key && input.required && input.type !== "repeater"
    );
  const answered = asked.filter(
    (question, at) =>
      FIELD_QUESTIONS.has(question.kind) &&
      required(question) &&
      asked.findIndex((other) => sameQuestion(other, question)) === at &&
      !waiting.some((item) => sameQuestion(item, question))
  ).length;
  return { position: answered + index + 1, total: answered + waiting.length };
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
