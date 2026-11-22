import type { ReportField, ReportRequirement } from "@green-goods/shared/modules/agent-reporting";
import * as z from "zod";
import type {
  InterpretationRequest,
  InterpretationResult,
  InterpretedIntent,
  ProposedFact,
} from "./interpretation";

/**
 * The only things a model can ask the conversation to do. A model proposes; code validates each
 * action against the snapshot it was given and decides what happens. There is no action that
 * consents, confirms, signs, sends, deletes, switches accounts or states an outcome, and a reply
 * naming one is refused whole: the turn then goes on as it would with no model at all.
 *
 * - `select_garden`, `select_activity`: one of the candidates the snapshot offered.
 * - `set_fields`: values for fields the snapshot allowed. `corrects` says the person is changing
 *   something they said before.
 * - `ask`: which of the report's own outstanding questions to put next, two at most.
 * - `show_summary`: the report looks complete. Code shows the summary only if it is.
 * - `request_link`: the person asked to connect an account. Code decides, and makes the link.
 * - `explain`: the person asked for status or help, or said hello. Code says what is true.
 */
export type ProposedAction =
  | { kind: "select_garden"; garden: string }
  | { kind: "select_activity"; activity: number }
  | { kind: "set_fields"; facts: ProposedFact[]; corrects: boolean }
  | { kind: "ask"; questions: string[] }
  | { kind: "show_summary" }
  | { kind: "request_link" }
  | { kind: "explain"; topic: ExplainTopic };

type ExplainTopic = "status" | "help" | "cancel" | "disconnect" | "greeting";

export interface DialogueProposal {
  version: 1;
  /** The draft revision and language of the snapshot this was proposed for. */
  revision: number;
  locale: string;
  actions: ProposedAction[];
  /** Model identifiers for provenance; never authority. */
  models: string[];
}

export const PROPOSAL_LIMITS = { actions: 8, facts: 20, questions: 2 } as const;

const factSchema = z.strictObject({
  field: z.string().max(120),
  value: z.union([z.string().max(2_000), z.number(), z.array(z.string().max(200)).max(50)]),
  kind: z.enum(["reported", "transcribed", "observed", "computed"]),
  original: z.string().max(500).optional(),
  unit: z.string().max(40).optional(),
});

const actionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("select_garden"), garden: z.string().max(120) }),
  z.strictObject({ kind: z.literal("select_activity"), activity: z.number().int() }),
  z.strictObject({
    kind: z.literal("set_fields"),
    facts: z.array(factSchema).max(PROPOSAL_LIMITS.facts),
    corrects: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal("ask"),
    questions: z.array(z.string().max(120)).max(PROPOSAL_LIMITS.questions),
  }),
  z.strictObject({ kind: z.literal("show_summary") }),
  z.strictObject({ kind: z.literal("request_link") }),
  z.strictObject({
    kind: z.literal("explain"),
    topic: z.enum(["status", "help", "cancel", "disconnect", "greeting"]),
  }),
]);

const proposalSchema = z.strictObject({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  locale: z.string().max(20),
  actions: z.array(actionSchema).max(PROPOSAL_LIMITS.actions),
  models: z.array(z.string().max(120)).max(4),
});

/** A proposal as a provider returned it, or null when it is not one: any unknown action refuses it. */
export function parseProposal(raw: unknown): DialogueProposal | null {
  const parsed = proposalSchema.safeParse(raw);
  return parsed.success ? (parsed.data as DialogueProposal) : null;
}

const TOPICS: Partial<Record<InterpretedIntent, ExplainTopic>> = {
  status: "status",
  help: "help",
  cancel: "cancel",
  disconnect: "disconnect",
  greeting: "greeting",
};

/** The routing and extraction pair's reading, said as the actions it amounts to. */
export function proposalFromInterpretation(
  result: InterpretationResult,
  request: Pick<InterpretationRequest, "draftRevision" | "locale">
): DialogueProposal {
  const actions: ProposedAction[] = [];
  if (result.gardenKey !== null) actions.push({ kind: "select_garden", garden: result.gardenKey });
  if (result.actionUID !== null)
    actions.push({ kind: "select_activity", activity: result.actionUID });
  if (result.facts.length > 0)
    actions.push({
      kind: "set_fields",
      facts: result.facts.slice(0, PROPOSAL_LIMITS.facts),
      corrects: result.intent === "correction",
    });
  const topic = TOPICS[result.intent];
  if (topic) actions.push({ kind: "explain", topic });
  if (result.intent === "connect") actions.push({ kind: "request_link" });
  return {
    version: 1,
    revision: request.draftRevision,
    locale: request.locale,
    actions,
    models: result.models,
  };
}

/** A question the report still has to ask, named as a proposal may name it. */
export function questionId(requirement: ReportRequirement): string | null {
  switch (requirement.kind) {
    case "detail":
      return `details.${requirement.key}`;
    case "time":
      return "timeSpentMinutes";
    case "title":
    case "feedback":
    case "evidence":
      return requirement.kind;
    default:
      return null;
  }
}

type RefusalReason = "not_offered" | "not_allowed" | "not_outstanding" | "repeated" | "empty";

export interface ValidatedProposal {
  /** What the turn applies, in the shape its handlers read. */
  interpretation: InterpretationResult;
  /** Outstanding questions the model would put next, in its order. */
  ask: string[];
  /** Each action left out, and why: for the log and the tests, never for the person. */
  refused: Array<{ kind: ProposedAction["kind"]; reason: RefusalReason }>;
}

/** The fields a proposal may set for this snapshot: the report's own, or every candidate's. */
function allowedFields(request: InterpretationRequest): Set<string> {
  const chosen = request.actions.filter((action) => action.uid === request.content.actionUID);
  const schemas = chosen.length > 0 ? chosen : request.actions;
  return new Set([
    "title",
    "timeSpentMinutes",
    "feedback",
    ...schemas.flatMap((action) => action.inputs.map((input) => `details.${input.key}`)),
  ]);
}

/** Whether the snapshot already holds this value for this field. */
function holds(request: InterpretationRequest, field: string, value: unknown): boolean {
  const { content } = request;
  const held = field.startsWith("details.")
    ? content.details[field.slice("details.".length)]
    : content[field as "title" | "timeSpentMinutes" | "feedback"];
  return held !== undefined && held !== null && JSON.stringify(held) === JSON.stringify(value);
}

/**
 * Checks a proposal against the snapshot it answers. A proposal for another revision or language
 * is refused whole (null): the report moved on, or the model answered something else. Otherwise
 * each action is kept only if the snapshot offered what it names; values are checked again, field
 * by field, when they are applied.
 */
export function validateProposal(
  proposal: DialogueProposal,
  request: InterpretationRequest
): ValidatedProposal | null {
  if (proposal.revision !== request.draftRevision || proposal.locale !== request.locale)
    return null;
  const refused: ValidatedProposal["refused"] = [];
  const refuse = (action: ProposedAction, reason: RefusalReason) =>
    void refused.push({ kind: action.kind, reason });
  const fields = allowedFields(request);
  const outstanding = new Set(
    request.requirements.flatMap((requirement) => questionId(requirement) ?? [])
  );
  let gardenKey: string | null = null;
  let actionUID: number | null = null;
  let facts: ProposedFact[] = [];
  let corrects = false;
  let topic: ExplainTopic | null = null;
  let link = false;
  const ask: string[] = [];
  const seen = new Set<ProposedAction["kind"]>();

  for (const action of proposal.actions) {
    // One of each kind: a second garden, or a second list of values, is not a second opinion.
    if (seen.has(action.kind)) {
      refuse(action, "repeated");
      continue;
    }
    seen.add(action.kind);
    switch (action.kind) {
      case "select_garden":
        if (request.gardens.some((garden) => garden.key === action.garden))
          gardenKey = action.garden;
        else refuse(action, "not_offered");
        break;
      case "select_activity":
        if (request.actions.some((candidate) => candidate.uid === action.activity))
          actionUID = action.activity;
        else refuse(action, "not_offered");
        break;
      case "set_fields": {
        const kept = action.facts.filter((fact) => fields.has(fact.field));
        if (kept.length < action.facts.length) refuse(action, "not_allowed");
        // A value the report already holds is no news: restating the report does not make a
        // question about its status a report, and changes nothing.
        facts = kept
          .filter((fact) => !holds(request, fact.field, fact.value))
          .map((fact) => ({ ...fact, field: fact.field as ReportField }));
        corrects = action.corrects && facts.length > 0;
        break;
      }
      case "ask": {
        const kept = action.questions.filter((question) => outstanding.has(question));
        if (kept.length < action.questions.length) refuse(action, "not_outstanding");
        ask.push(...new Set(kept));
        break;
      }
      case "show_summary":
        // Nothing to carry: code shows the summary whenever, and only when, nothing is missing.
        break;
      case "request_link":
        link = true;
        break;
      case "explain":
        topic = action.topic;
        break;
    }
  }
  if (proposal.actions.length === 0) refused.push({ kind: "explain", reason: "empty" });
  // Content comes first: a message that gives details and also says hello is a report. A garden
  // or an activity named in passing does not turn a question about status or help into one: the
  // question is answered, as it was before proposals, and what it named stays in the reading.
  const asides = link || topic !== null;
  const reports = facts.length > 0 || ((actionUID !== null || gardenKey !== null) && !asides);
  const intent: InterpretedIntent = reports
    ? corrects
      ? "correction"
      : "report_content"
    : link
      ? "connect"
      : (topic ?? "unclear");
  return {
    interpretation: { intent, gardenKey, actionUID, facts, models: proposal.models },
    ask,
    refused,
  };
}
