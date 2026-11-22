import * as z from "zod";
import {
  type DialogueProposal,
  type ProposedAction,
  PROPOSAL_LIMITS,
  questionId,
} from "./dialogue-proposal";
import { type InterpretationRequest, InterpretationUnavailableError } from "./interpretation";
import {
  allowedFields,
  candidateSchemas,
  factsOutput,
  factsSchema,
  proposedFacts,
  READING_RULES,
  readingInput,
} from "./model-extraction";
import type { ModelMeter } from "./model-spend";
import { type OpenAIConfig, structuredResponse } from "./openai-responses";

/**
 * The dialogue planner: one OpenAI call that reads a message against the bounded snapshot and
 * answers with actions from the closed list in dialogue-proposal.ts. Its reply has no field for
 * words to the person, so it cannot state an outcome, a consent or a link: it names candidates,
 * proposes values, and says which of the report's own questions it would put next. Everything it
 * returns is a proposal that `validateProposal` and the report rules still have to accept.
 */
const NEXT = ["continue", "link", "status", "help", "cancel", "disconnect", "greeting"] as const;

const PLANNER_RULES = [
  READING_RULES,
  "Say what the conversation should do next with `next`: `continue` for anything about the report itself; `link` when the person asks to log in or connect an account; `status`, `help`, `cancel`, `disconnect` or `greeting` when that is all the message asks for.",
  "Set `corrects` to true only when the person is changing something they said before.",
  "With `ask`, name at most two of the questions still needed that are worth putting next, most useful first. Leave it empty when you have no preference.",
  "You cannot confirm, publish, consent, delete or report a result. Never try to say that any of those happened.",
].join("\n");

const outputSchema = z.object({
  garden: z.string().nullable(),
  activity: z.number().int().nullable(),
  corrects: z.boolean(),
  facts: factsOutput,
  ask: z.array(z.string().max(120)).max(PROPOSAL_LIMITS.questions),
  next: z.enum(NEXT),
});

export async function planWithOpenAI(
  config: OpenAIConfig,
  request: InterpretationRequest,
  signal: AbortSignal,
  meter?: ModelMeter
): Promise<DialogueProposal> {
  const fields = allowedFields(request);
  const questions = request.requirements.flatMap((requirement) => questionId(requirement) ?? []);
  const candidates = candidateSchemas(request);
  const { model, output: raw } = await structuredResponse(
    config,
    {
      purpose: "extraction",
      instructions: PLANNER_RULES,
      content: [{ type: "input_text", text: JSON.stringify(readingInput(request, fields)) }],
      schemaName: "dialogue_actions",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["garden", "activity", "corrects", "facts", "ask", "next"],
        properties: {
          garden: candidates.garden,
          activity: candidates.activity,
          corrects: { type: "boolean" },
          facts: factsSchema(fields),
          ask: {
            type: "array",
            maxItems: PROPOSAL_LIMITS.questions,
            // A list with nothing to choose from still needs a schema that accepts no items.
            items: { type: "string", enum: questions.length > 0 ? questions : [""] },
          },
          next: { type: "string", enum: NEXT },
        },
      },
      maxOutputTokens: 1_200,
    },
    signal,
    meter
  );
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) throw new InterpretationUnavailableError("malformed");
  const output = parsed.data;
  const actions: ProposedAction[] = [];
  if (output.garden !== null) actions.push({ kind: "select_garden", garden: output.garden });
  if (output.activity !== null)
    actions.push({ kind: "select_activity", activity: output.activity });
  const facts = proposedFacts(output.facts, fields);
  if (facts.length > 0) actions.push({ kind: "set_fields", facts, corrects: output.corrects });
  const ask = output.ask.filter(Boolean);
  if (ask.length > 0) actions.push({ kind: "ask", questions: ask });
  if (output.next === "link") actions.push({ kind: "request_link" });
  else if (output.next !== "continue") actions.push({ kind: "explain", topic: output.next });
  return {
    version: 1,
    revision: request.draftRevision,
    locale: request.locale,
    actions,
    models: [model],
  };
}
