import type {
  FactKind,
  FactOrigin,
  ReportContent,
  ReportField,
  ReportRequirement,
} from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { createLogger } from "../logger";
import {
  type DialogueProposal,
  parseProposal,
  proposalFromInterpretation,
} from "./dialogue-proposal";
import type { ModelMeter } from "./model-spend";

const log = createLogger("reporting");

/**
 * Model interpretation boundary. Jev chooses among intents and next steps the code permits;
 * OpenAI proposes field values with source references. Neither can choose an Action outside the
 * candidate list, grant authority, change consent or report an outcome: every proposal is
 * validated against the Action's inputs and committed only if the draft revision is unchanged.
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

/** What the conversation is for right now. */
export type DialogueGoal = "report" | "review" | "none";

export interface DialogueTurn {
  role: "person" | "assistant";
  text: string;
}

/** The question the conversation has open, as it was put. */
export interface DialogueQuestion {
  kind: string;
  field: string | null;
  text: string;
  options: string[];
}

/**
 * The bounded view of a conversation a model reads: the latest message, the open question and the
 * few turns before it, the draft's fields with where each came from, what is still missing, and
 * the gardens and activities on offer. Gardens are named by opaque identifiers that mean nothing
 * outside the turn. It holds no phone number, account address, link, signature or provider
 * identifier, and no history beyond its turns.
 */
export interface DialogueSnapshot {
  version: 1;
  locale: string;
  goal: DialogueGoal;
  draftRevision: number;
  message: { sourceEntryId: string; text: string };
  turns: DialogueTurn[];
  question: DialogueQuestion | null;
  content: Pick<ReportContent, "actionUID" | "title" | "timeSpentMinutes" | "feedback" | "details">;
  /** Where each accepted field came from, and whether the gardener stated it. */
  provenance: Partial<Record<ReportField, { origin: FactOrigin; stated: boolean }>>;
  conflicts: Array<{ field: ReportField; proposed: unknown }>;
  requirements: ReportRequirement[];
  gardens: Array<{ key: string; label: string }>;
  actions: Array<{ uid: number; title: string; inputs: WorkInput[] }>;
  observations: Array<{ assetId: string; digest: string; summary: string }>;
}

declare const passedPrivacyGateway: unique symbol;

/**
 * A snapshot that has passed the privacy gateway (`dialogueView` in
 * coordinator/dialogue-context.ts), the only place one is made. Provider adapters take nothing
 * else, so a request cannot reach a provider without it.
 */
export type InterpretationRequest = DialogueSnapshot & { readonly [passedPrivacyGateway]: true };

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
  /** The report's own outstanding questions a model would put next, validated; a hint at most. */
  ask?: string[];
}

export interface ReportInterpreter {
  /** `meter` hears about every provider request the interpretation sends. */
  interpret(
    request: InterpretationRequest,
    signal: AbortSignal,
    meter?: ModelMeter
  ): Promise<InterpretationResult>;
  /**
   * The same reading as a proposal of actions, from a provider that answers in them. Left out, the
   * reading above is restated as the actions it amounts to. Either way the result is a proposal.
   */
  propose?(
    request: InterpretationRequest,
    signal: AbortSignal,
    meter?: ModelMeter
  ): Promise<DialogueProposal>;
}

export class InterpretationUnavailableError extends Error {
  constructor(readonly reason: "disabled" | "timeout" | "provider_error" | "malformed") {
    super(`Interpretation unavailable: ${reason}`);
  }
}

/**
 * Asks a model what it proposes, within a deadline. A failure, a refusal, a timeout or a reply
 * that is not a proposal all yield null, and the turn goes on as it does with no model.
 */
export async function proposeWithDeadline(
  interpreter: ReportInterpreter | null,
  request: InterpretationRequest,
  timeoutMs: number,
  meter?: ModelMeter
): Promise<DialogueProposal | null> {
  if (!interpreter) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const proposed = interpreter.propose
      ? await interpreter.propose(request, controller.signal, meter)
      : proposalFromInterpretation(
          await interpreter.interpret(request, controller.signal, meter),
          request
        );
    const proposal = parseProposal(proposed);
    if (!proposal) throw new InterpretationUnavailableError("malformed");
    return proposal;
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
  /**
   * The dialogue planner, and whether it is switched on right now. On, it answers every reading
   * alone, in actions; off or absent, routing and extraction answer as they always have.
   */
  plan?:
    | ((
        request: InterpretationRequest,
        signal: AbortSignal,
        meter?: ModelMeter
      ) => Promise<DialogueProposal>)
    | null;
  planning?: () => boolean;
  route:
    | ((
        request: InterpretationRequest,
        signal: AbortSignal,
        meter?: ModelMeter
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
        signal: AbortSignal,
        meter?: ModelMeter
      ) => Promise<{
        intent: InterpretedIntent;
        gardenKey: string | null;
        actionUID: number | null;
        facts: ProposedFact[];
        model: string;
      }>)
    | null;
}): ReportInterpreter | null {
  const { route, extract, plan } = providers;
  if (!route && !extract && !plan) return null;
  const interpret: ReportInterpreter["interpret"] = async (request, signal, meter) => {
    const [routing, extraction] = await Promise.allSettled([
      route ? route(request, signal, meter) : Promise.resolve(null),
      extract ? extract(request, signal, meter) : Promise.resolve(null),
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
      models: [routed?.model, extracted?.model].filter((model): model is string => Boolean(model)),
    };
  };
  return {
    interpret,
    async propose(request, signal, meter) {
      if (plan && providers.planning?.()) return plan(request, signal, meter);
      return proposalFromInterpretation(await interpret(request, signal, meter), request);
    },
  };
}
