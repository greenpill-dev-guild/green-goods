import * as z from "zod";
import {
  type InterpretationRequest,
  type InterpretedIntent,
  InterpretationUnavailableError,
} from "./interpretation";
import { type ModelMeter, tokenCeiling } from "./model-spend";

/**
 * Jev routing: typed Choice judgments over a bounded snapshot. Jev picks the turn's intent and,
 * when still open, a garden or Action from the candidates code offers; it never extracts values,
 * chooses anything outside those lists, or sees phone numbers, addresses, links or signatures.
 * A low-confidence choice is treated as no choice so the coordinator asks instead of guessing.
 */
export interface JevConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetch?: typeof fetch;
}

export interface Routing {
  intent: InterpretedIntent;
  gardenKey: string | null;
  actionUID: number | null;
  model: string;
}

const MIN_CONFIDENCE = 0.55;

const INTENTS: Record<InterpretedIntent, string> = {
  report_content: "The message describes work done, adds details, or answers a question about it.",
  correction: "The message changes something already said about the report.",
  status: "The message asks what is happening with a report.",
  help: "The message asks how this works or what to do.",
  cancel: "The message asks to stop or discard the current report.",
  connect: "The message asks to log in, sign in, or connect or link an account or wallet.",
  disconnect: "The message asks to log out, disconnect the account, or use a different account.",
  greeting: "The message only says hello or makes small talk and describes no work.",
  unclear: "None of the above, or the message is too ambiguous to tell.",
};

const answerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  confidence: z.number().min(0).max(1),
});
const responseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), answerSchema),
});
// The API reference marks both counts as integers; the official SDK allows null for either.
const usageSchema = z.object({
  usage: z.object({
    input_tokens: z.number().int().nonnegative().nullable(),
    output_tokens: z.number().int().nonnegative().nullable(),
  }),
});

type Question = { type: "choice"; instructions: string; criteria: Record<string, string> };

function questionsFor(request: InterpretationRequest): Record<string, Question> {
  const questions: Record<string, Question> = {
    intent: {
      type: "choice",
      instructions: "What does the gardener's latest message ask for?",
      criteria: INTENTS,
    },
  };
  if (!request.content.actionUID && request.gardens.length > 1) {
    questions.garden = {
      type: "choice",
      instructions: "Which garden does the message say the work was done in?",
      criteria: {
        ...Object.fromEntries(request.gardens.map((garden) => [garden.key, garden.label])),
        none: "The message does not clearly name one of these gardens.",
      },
    };
  }
  if (!request.content.actionUID && request.actions.length > 0) {
    questions.action = {
      type: "choice",
      instructions: "Which activity best matches the work described?",
      criteria: {
        ...Object.fromEntries(
          request.actions
            .slice(0, 250)
            .map((action) => [
              `a${action.uid}`,
              `${action.title}: ${action.inputs.map((input) => input.title).join(", ")}`,
            ])
        ),
        none: "The message does not clearly match one of these activities.",
      },
    };
  }
  return questions;
}

function stateFor(request: InterpretationRequest) {
  return {
    workflowVersion: 1,
    draftRevision: request.draftRevision,
    locale: request.locale,
    message: request.message.text,
    confirmedFields: {
      title: request.content.title,
      timeSpentMinutes: request.content.timeSpentMinutes,
      details: request.content.details,
    },
    stillNeeded: request.requirements.map((requirement) => requirement.kind),
  };
}

/** Room for any framing Jev adds to the questions, which the request does not show. */
const JEV_FRAMING_RESERVE_TOKENS = 1_000;

/**
 * Jev bills input tokens only and states them in each reply's `usage`. The meter reserves the
 * request at its token ceiling plus room for Jev's own framing before it is sent, and settles it
 * with what the reply states.
 */
export async function routeWithJev(
  config: JevConfig,
  request: InterpretationRequest,
  signal: AbortSignal,
  meter?: ModelMeter
): Promise<Routing> {
  const request_ = config.fetch ?? fetch;
  const body = JSON.stringify({
    state: stateFor(request),
    model: config.model,
    questions: questionsFor(request),
  });
  const settle = meter?.({
    provider: "jev",
    model: config.model,
    purpose: "routing",
    reserve: { inputTokens: tokenCeiling(body) + JEV_FRAMING_RESERVE_TOKENS },
  });
  let response: Response;
  try {
    response = await request_(`${config.baseUrl.replace(/\/+$/, "")}/v1/systemone`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body,
      signal,
    });
  } catch {
    settle?.({ outcome: "unanswered" });
    throw new InterpretationUnavailableError(signal.aborted ? "timeout" : "provider_error");
  }
  if (!response.ok) {
    settle?.({ outcome: "failed" });
    throw new InterpretationUnavailableError("provider_error");
  }
  const json: unknown = await response.json().catch(() => null);
  const usage = usageSchema.safeParse(json);
  settle?.({
    outcome: "answered",
    ...(usage.success && usage.data.usage.input_tokens !== null
      ? {
          usage: {
            inputTokens: usage.data.usage.input_tokens,
            outputTokens: usage.data.usage.output_tokens ?? 0,
          },
        }
      : {}),
  });
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.answers.intent) {
    throw new InterpretationUnavailableError("malformed");
  }
  const confident = (id: string): string | null => {
    const answer = parsed.data.answers[id];
    return answer && answer.confidence >= MIN_CONFIDENCE && answer.choice !== "none"
      ? answer.choice
      : null;
  };
  const intent = confident("intent");
  const gardenKey = confident("garden");
  const action = confident("action");
  const actionUID = action?.startsWith("a") ? Number(action.slice(1)) : null;
  return {
    intent: intent && intent in INTENTS ? (intent as InterpretedIntent) : "unclear",
    gardenKey: request.gardens.some((garden) => garden.key === gardenKey) ? gardenKey : null,
    actionUID:
      actionUID !== null && request.actions.some((candidate) => candidate.uid === actionUID)
        ? actionUID
        : null,
    model: parsed.data.model,
  };
}
