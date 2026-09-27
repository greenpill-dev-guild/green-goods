import * as z from "zod";
import {
  type InterpretationRequest,
  type InterpretedIntent,
  InterpretationUnavailableError,
} from "./interpretation";

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

export async function routeWithJev(
  config: JevConfig,
  request: InterpretationRequest,
  signal: AbortSignal
): Promise<Routing> {
  const request_ = config.fetch ?? fetch;
  let response: Response;
  try {
    response = await request_(`${config.baseUrl.replace(/\/+$/, "")}/v1/systemone`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        state: stateFor(request),
        model: config.model,
        questions: questionsFor(request),
      }),
      signal,
    });
  } catch {
    throw new InterpretationUnavailableError(signal.aborted ? "timeout" : "provider_error");
  }
  if (!response.ok) throw new InterpretationUnavailableError("provider_error");
  const parsed = responseSchema.safeParse(await response.json().catch(() => null));
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
