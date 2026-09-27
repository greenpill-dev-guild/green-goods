import type {
  FactKind,
  ReportContent,
  ReportField,
  ReportRequirement,
} from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";

/**
 * Model interpretation boundary. Jev chooses among intents and next steps the code permits;
 * OpenAI proposes field values with source references. Neither can choose an Action outside the
 * candidate list, grant authority, change consent or report an outcome: every proposal is
 * validated against the Action's inputs and committed only if the draft revision is unchanged.
 *
 * Requests carry a bounded snapshot: no phone numbers, wallet addresses, links, signatures or
 * unrelated chat history.
 */
export type InterpretedIntent =
  | "report_content"
  | "correction"
  | "status"
  | "help"
  | "cancel"
  | "unclear";

export interface InterpretationRequest {
  locale: string;
  draftRevision: number;
  message: { sourceEntryId: string; text: string };
  content: Pick<ReportContent, "actionUID" | "title" | "timeSpentMinutes" | "feedback" | "details">;
  requirements: ReportRequirement[];
  gardens: Array<{ key: string; label: string }>;
  actions: Array<{ uid: number; title: string; inputs: WorkInput[] }>;
  observations: Array<{ assetId: string; digest: string; summary: string }>;
}

export interface ProposedFact {
  field: ReportField;
  value: unknown;
  kind: FactKind;
  /** The words the value was read from. */
  original?: string;
  unit?: string;
}

export interface InterpretationResult {
  intent: InterpretedIntent;
  gardenKey: string | null;
  actionUID: number | null;
  facts: ProposedFact[];
  /** Model identifiers for provenance; never authority. */
  models: string[];
}

export interface ReportInterpreter {
  interpret(request: InterpretationRequest, signal: AbortSignal): Promise<InterpretationResult>;
}

export class InterpretationUnavailableError extends Error {
  constructor(readonly reason: "disabled" | "timeout" | "provider_error" | "malformed") {
    super(`Interpretation unavailable: ${reason}`);
  }
}

/** Runs an interpreter within a deadline; any failure yields null so the turn falls back. */
export async function interpretWithDeadline(
  interpreter: ReportInterpreter | null,
  request: InterpretationRequest,
  timeoutMs: number
): Promise<InterpretationResult | null> {
  if (!interpreter) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await interpreter.interpret(request, controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
