import { type Address, getAddress, isAddress } from "viem";
import type { WorkInput } from "../../types/domain";
import type { ActionDefinitionSnapshot } from "./action-snapshot";
import { reportingDigest } from "./canonical";
import { validateDetailValue } from "./field-answers";

/**
 * A story-first work report as the agent assembles it in chat.
 *
 * Every accepted value carries provenance: where it came from, how it was obtained and whether
 * the gardener stated it. A value the gardener stated can only be replaced by the gardener; a
 * model proposal that disagrees becomes a recorded conflict to ask about, never a silent edit.
 */
export interface GardenRef {
  chainId: number;
  address: Address;
}

export type FactKind = "reported" | "transcribed" | "observed" | "computed";
export type FactOrigin = "gardener" | "model" | "system";

export interface SourceRef {
  sourceEntryId: string;
  assetId?: string;
  assetDigest?: string;
  /** Page, region or cell range such as `Sheet1!B2:B9`. */
  location?: string;
}

export interface FieldProvenance {
  kind: FactKind;
  origin: FactOrigin;
  sources: SourceRef[];
  /** Private source wording, for example "two and a half hours". */
  original?: string;
  originalUnit?: string;
  model?: string;
  gardenerStated: boolean;
}

export type ReportField =
  | "garden"
  | "action"
  | "title"
  | "timeSpentMinutes"
  | "feedback"
  | `details.${string}`;

export type DetailValue = string | number | string[];

export interface EvidenceItem {
  assetId: string;
  sanitizedDigest: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
}

export interface FieldConflict {
  field: ReportField;
  proposed: unknown;
  provenance: FieldProvenance;
}

export interface ReportContent {
  version: 1;
  garden: GardenRef | null;
  actionUID: number | null;
  title: string | null;
  timeSpentMinutes: number | null;
  feedback: string | null;
  details: Record<string, DetailValue>;
  evidence: EvidenceItem[];
  provenance: Partial<Record<ReportField, FieldProvenance>>;
  conflicts: FieldConflict[];
}

export interface FieldChange {
  field: ReportField;
  /** `null` clears the field. */
  value: unknown;
  provenance: FieldProvenance;
}

export type ChangeRejectionReason =
  | "invalid_value"
  | "unknown_field"
  | "action_not_confirmed"
  | "unsupported_input";

export interface ChangeOutcome {
  content: ReportContent;
  applied: ReportField[];
  conflicts: FieldConflict[];
  rejected: Array<{ field: ReportField; reason: ChangeRejectionReason }>;
}

export const MAX_TIME_SPENT_MINUTES = 10_080;
export const MAX_TITLE_LENGTH = 120;
export const MAX_FEEDBACK_LENGTH = 4_000;

export function emptyReport(): ReportContent {
  return {
    version: 1,
    garden: null,
    actionUID: null,
    title: null,
    timeSpentMinutes: null,
    feedback: null,
    details: {},
    evidence: [],
    provenance: {},
    conflicts: [],
  };
}

function detailKey(field: ReportField): string | null {
  return field.startsWith("details.") ? field.slice("details.".length) : null;
}

function currentValue(content: ReportContent, field: ReportField): unknown {
  switch (field) {
    case "garden":
      return content.garden;
    case "action":
      return content.actionUID;
    case "title":
      return content.title;
    case "timeSpentMinutes":
      return content.timeSpentMinutes;
    case "feedback":
      return content.feedback;
    default:
      return content.details[detailKey(field) ?? ""] ?? null;
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeGarden(value: unknown): GardenRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { chainId, address } = value as Partial<GardenRef>;
  if (!Number.isSafeInteger(chainId) || !address || !isAddress(address)) return undefined;
  return { chainId: chainId as number, address: getAddress(address).toLowerCase() as Address };
}

function normalizeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : undefined;
}

/** Returns the normalized value, or undefined when the value is invalid for the field. */
function normalizeField(
  field: ReportField,
  value: unknown,
  snapshot: ActionDefinitionSnapshot | null
): unknown | undefined {
  if (value === null) return null;
  switch (field) {
    case "garden":
      return normalizeGarden(value);
    case "action":
      return Number.isSafeInteger(value) && (value as number) >= 0 ? value : undefined;
    case "title":
      return normalizeText(value, MAX_TITLE_LENGTH);
    case "feedback":
      return normalizeText(value, MAX_FEEDBACK_LENGTH);
    case "timeSpentMinutes":
      return Number.isInteger(value) &&
        (value as number) >= 0 &&
        (value as number) <= MAX_TIME_SPENT_MINUTES
        ? value
        : undefined;
    default: {
      const input = findInput(snapshot, detailKey(field) ?? "");
      if (!input) return undefined;
      const checked = validateDetailValue(input, value);
      return checked.ok ? checked.value : undefined;
    }
  }
}

export function findInput(
  snapshot: ActionDefinitionSnapshot | null,
  key: string
): WorkInput | undefined {
  return snapshot?.definition.inputs.find((input) => input.key === key);
}

function assign(content: ReportContent, field: ReportField, value: unknown): ReportContent {
  const key = detailKey(field);
  if (key !== null) {
    const details = { ...content.details };
    if (value === null) delete details[key];
    else details[key] = value as DetailValue;
    return { ...content, details };
  }
  if (field === "garden") {
    // Actions are garden-scoped: a new garden needs its Action selected again.
    return { ...content, garden: value as GardenRef | null, actionUID: null };
  }
  if (field === "action") return { ...content, actionUID: value as number | null };
  return { ...content, [field]: value };
}

/**
 * Applies proposed changes in order. `snapshot` is the Action definition the details are checked
 * against; details are rejected until an Action and its snapshot are established.
 */
export function applyReportChanges(
  content: ReportContent,
  changes: readonly FieldChange[],
  snapshot: ActionDefinitionSnapshot | null
): ChangeOutcome {
  let next: ReportContent = { ...content, provenance: { ...content.provenance } };
  const applied: ReportField[] = [];
  const conflicts: FieldConflict[] = [];
  const rejected: ChangeOutcome["rejected"] = [];

  for (const change of changes) {
    const key = detailKey(change.field);
    if (key !== null) {
      if (!snapshot || next.actionUID !== snapshot.definition.actionUID) {
        rejected.push({ field: change.field, reason: "action_not_confirmed" });
        continue;
      }
      const input = findInput(snapshot, key);
      if (!input) {
        rejected.push({ field: change.field, reason: "unknown_field" });
        continue;
      }
      if (input.type === "repeater") {
        rejected.push({ field: change.field, reason: "unsupported_input" });
        continue;
      }
    }
    const value = normalizeField(change.field, change.value, snapshot);
    if (value === undefined) {
      rejected.push({ field: change.field, reason: "invalid_value" });
      continue;
    }
    const existing = next.provenance[change.field];
    if (
      change.provenance.origin !== "gardener" &&
      existing?.gardenerStated &&
      !sameValue(currentValue(next, change.field), value)
    ) {
      conflicts.push({ field: change.field, proposed: value, provenance: change.provenance });
      continue;
    }
    next = assign(next, change.field, value);
    if (value === null) delete next.provenance[change.field];
    else next.provenance[change.field] = change.provenance;
    if (change.field === "garden") delete next.provenance.action;
    // A gardener's own statement settles any earlier recorded disagreement about the field.
    next.conflicts = next.conflicts.filter(
      (conflict) => change.provenance.origin !== "gardener" || conflict.field !== change.field
    );
    applied.push(change.field);
  }

  next.conflicts = [...next.conflicts, ...conflicts];
  return { content: next, applied, conflicts, rejected };
}

/** Drops details the (new) Action does not define or no longer accepts. */
export function reconcileDetailsWithAction(
  content: ReportContent,
  snapshot: ActionDefinitionSnapshot
): { content: ReportContent; dropped: string[] } {
  const details: Record<string, DetailValue> = {};
  const provenance = { ...content.provenance };
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(content.details)) {
    const input = findInput(snapshot, key);
    const checked = input ? validateDetailValue(input, value) : { ok: false as const };
    if (checked.ok) details[key] = checked.value;
    else {
      dropped.push(key);
      delete provenance[`details.${key}`];
    }
  }
  return { content: { ...content, details, provenance }, dropped };
}

/**
 * Adds one sanitized image as candidate evidence, once per digest. How many images an Action
 * needs or allows is checked by the report requirements, so a gardener can still remove extras.
 */
export function withEvidence(content: ReportContent, item: EvidenceItem): ReportContent {
  if (content.evidence.some((existing) => existing.sanitizedDigest === item.sanitizedDigest)) {
    return content;
  }
  return { ...content, evidence: [...content.evidence, item] };
}

/** Identifies what would be published: fields and selected evidence, not private provenance. */
export function reportContentDigest(content: ReportContent) {
  return reportingDigest("report-content", {
    garden: content.garden,
    actionUID: content.actionUID,
    title: content.title,
    timeSpentMinutes: content.timeSpentMinutes,
    feedback: content.feedback,
    details: content.details,
    evidence: content.evidence,
  });
}
