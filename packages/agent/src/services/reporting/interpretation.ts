import type {
  FactKind,
  ReportContent,
  ReportField,
  ReportRequirement,
} from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { createLogger } from "../logger";

const log = createLogger("reporting");

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
  | "connect"
  | "disconnect"
  | "greeting"
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
  } catch (error) {
    // The turn goes on without the model; the operator's log says that it did, and why.
    log.warn(
      {
        cause:
          error instanceof InterpretationUnavailableError
            ? error.reason
            : error instanceof Error
              ? error.name
              : "unknown",
      },
      "A message could not be interpreted; the turn continues without the model"
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Combines the configured providers for one text turn: at most one Jev routing call and one
 * OpenAI extraction call, run together. Jev's typed decisions win for intent, garden and Action;
 * extracted facts come only from OpenAI. One failing provider does not discard the other.
 */
export function createModelInterpreter(providers: {
  route:
    | ((
        request: InterpretationRequest,
        signal: AbortSignal
      ) => Promise<{
        intent: InterpretedIntent;
        gardenKey: string | null;
        actionUID: number | null;
        model: string;
      }>)
    | null;
  extract:
    | ((
        request: InterpretationRequest,
        signal: AbortSignal
      ) => Promise<{
        intent: InterpretedIntent;
        gardenKey: string | null;
        actionUID: number | null;
        facts: ProposedFact[];
        model: string;
      }>)
    | null;
}): ReportInterpreter | null {
  const { route, extract } = providers;
  if (!route && !extract) return null;
  return {
    async interpret(request, signal) {
      const [routing, extraction] = await Promise.allSettled([
        route ? route(request, signal) : Promise.resolve(null),
        extract ? extract(request, signal) : Promise.resolve(null),
      ]);
      const routed = routing.status === "fulfilled" ? routing.value : null;
      const extracted = extraction.status === "fulfilled" ? extraction.value : null;
      if (!routed && !extracted) throw new InterpretationUnavailableError("provider_error");
      const intent = routed?.intent ?? extracted?.intent ?? "unclear";
      const contentIntent = intent === "report_content" || intent === "correction";
      return {
        intent,
        gardenKey: routed ? routed.gardenKey : (extracted?.gardenKey ?? null),
        actionUID: routed ? routed.actionUID : (extracted?.actionUID ?? null),
        facts: contentIntent ? (extracted?.facts ?? []) : [],
        models: [routed?.model, extracted?.model].filter((model): model is string =>
          Boolean(model)
        ),
      };
    },
  };
}
