import {
  type ActionDefinitionSnapshot,
  outstandingRequirements,
  type ReportField,
} from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { pendingGoal } from "../dialogue-goal";
import type { ReportingGarden } from "../gardens";
import {
  type DialogueGoal,
  type DialogueSnapshot,
  type InterpretationRequest,
  type InterpretationResult,
  interpretWithDeadline,
  type ReportInterpreter,
} from "../interpretation";
import { createLogger } from "../../logger";
import { modelMeter } from "../model-spend";
import { MODEL_INPUT_POLICY, REDACTION_MARK, sanitizeModelText } from "../model-policy";
import type { ReportingCore } from "../runtime";
import type { TurnContext } from "./context";
import { earlierTurns, openQuestion } from "./dialogue-turns";

/**
 * The privacy gateway. A model reads a conversation only as the snapshot built here: free text is
 * sanitized, lists are bounded, gardens are named by identifiers made up for the turn, and earlier
 * turns come only from this chat, this identity and this consent.
 */
interface DialogueView {
  request: InterpretationRequest;
  /** A model's answer with its garden named as the directory names it. */
  resolve(result: InterpretationResult): InterpretationResult;
}

const log = createLogger("reporting");

const label = (text: string) => sanitizeModelText(text, MODEL_INPUT_POLICY.maxLabelChars);

/**
 * The choices a model may name. A choice is named by its own value, which the report then stores,
 * so a value the sanitizer would change is left out instead of being sent altered: the model
 * cannot pick it, and the gardener still can.
 */
const namable = (values: readonly string[]) => values.filter((value) => label(value) === value);

/**
 * Whether a field may be named to a model. A field is named by its key, which comes back in every
 * value proposed for it, so a key the sanitizer would change is left out with everything said
 * about it: the model cannot fill the field, and the gardener is still asked for it.
 */
const namedField = (field: string) => {
  const key = field.replace(/^details\./u, "");
  return label(key) === key;
};

function labels(
  map: Record<string, string> | undefined,
  values: readonly string[]
): Record<string, string> | undefined {
  return map
    ? Object.fromEntries(
        values
          .filter((value) => map[value] !== undefined)
          .map((value) => [value, label(map[value] as string)])
      )
    : undefined;
}

/** A field as a model may read it. A repeater's nested fields are never asked in chat, so they stay out. */
function publicInput(input: WorkInput): WorkInput {
  const options = namable(input.options ?? []);
  const bands = input.bands ? namable(input.bands) : undefined;
  const optionLabels = labels(input.optionLabels, options);
  const bandLabels = labels(input.bandLabels, bands ?? []);
  return {
    key: input.key,
    title: label(input.title),
    placeholder: label(input.placeholder ?? ""),
    type: input.type,
    required: input.required,
    options,
    ...(bands ? { bands } : {}),
    ...(optionLabels ? { optionLabels } : {}),
    ...(bandLabels ? { bandLabels } : {}),
    ...(input.unit ? { unit: label(input.unit) } : {}),
  };
}

const fieldText = (value: string | null) =>
  value === null ? null : sanitizeModelText(value, MODEL_INPUT_POLICY.maxFieldChars);

/** A field's value as a model may read it; anything that is not plain text or a number stays out. */
function publicValue(value: unknown): unknown {
  if (typeof value === "string") return fieldText(value);
  if (Array.isArray(value)) return value.map((item) => label(String(item)));
  return typeof value === "number" ? value : null;
}

function goalOf(core: ReportingCore, ctx: TurnContext): DialogueGoal {
  if (ctx.review) return "review";
  if (ctx.draft) return "report";
  const pending = ctx.binding
    ? pendingGoal(core, {
        conversationId: ctx.conversationId,
        participantId: ctx.binding.participantId,
        identityEpoch: ctx.binding.identityEpoch,
      })
    : null;
  return pending ?? "none";
}

/**
 * Keeps the snapshot inside its size bound: earlier turns go first, then the last activities
 * listed. A snapshot still too large after that is not sent at all, and the turn goes on without
 * the model.
 */
function bounded(snapshot: DialogueSnapshot): DialogueSnapshot {
  const fits = (candidate: DialogueSnapshot) =>
    JSON.stringify(candidate).length <= MODEL_INPUT_POLICY.maxSnapshotChars;
  let next = snapshot;
  while (!fits(next) && next.turns.length > 0) next = { ...next, turns: next.turns.slice(1) };
  while (!fits(next) && next.actions.length > 1)
    next = { ...next, actions: next.actions.slice(0, -1) };
  if (!fits(next)) throw new Error("The dialogue snapshot exceeds its size bound");
  return next;
}

/** Builds the view of this turn a model may read. `gardens` and `activities` are what the chat is offered. */
function dialogueView(
  core: ReportingCore,
  ctx: TurnContext,
  input: {
    text: string;
    gardens: readonly ReportingGarden[];
    activities: readonly ActionDefinitionSnapshot[];
  }
): DialogueView {
  const content = ctx.draft?.content ?? null;
  const offered = input.gardens.slice(0, MODEL_INPUT_POLICY.maxGardens);
  const gardenKeys = new Map(offered.map((garden, index) => [`g${index + 1}`, garden.key]));
  /** The identifier this turn gave a garden, or null for one it does not offer. */
  const gardenId = (address: string | undefined): string | null => {
    const at = offered.findIndex((garden) => garden.address === address?.toLowerCase());
    return at < 0 ? null : `g${at + 1}`;
  };
  // The report's own activity is listed first, so a long catalogue never crowds it out.
  const activities = [...input.activities].sort(
    (one, other) =>
      Number(other.definition.actionUID === content?.actionUID) -
      Number(one.definition.actionUID === content?.actionUID)
  );
  const provenance: DialogueSnapshot["provenance"] = {};
  for (const [field, read] of Object.entries(content?.provenance ?? {})) {
    if (read && namedField(field))
      provenance[field as ReportField] = { origin: read.origin, stated: read.gardenerStated };
  }
  const snapshot = bounded({
    version: MODEL_INPUT_POLICY.version,
    locale: ctx.locale,
    goal: goalOf(core, ctx),
    draftRevision: ctx.draft?.revision ?? 0,
    message: {
      sourceEntryId: ctx.event.id,
      text: sanitizeModelText(input.text, MODEL_INPUT_POLICY.maxMessageChars),
    },
    turns: earlierTurns(core, ctx),
    question: openQuestion(core, ctx),
    content: {
      actionUID: content?.actionUID ?? null,
      title: fieldText(content?.title ?? null),
      timeSpentMinutes: content?.timeSpentMinutes ?? null,
      feedback: fieldText(content?.feedback ?? null),
      details: Object.fromEntries(
        Object.entries(content?.details ?? {})
          .filter(([key]) => namedField(key))
          .map(([key, value]) => [key, publicValue(value)])
      ) as DialogueSnapshot["content"]["details"],
    },
    provenance,
    conflicts: (content?.conflicts ?? [])
      .filter((conflict) => namedField(conflict.field))
      .map((conflict) => ({
        field: conflict.field,
        proposed:
          conflict.field === "garden"
            ? gardenId((conflict.proposed as { address?: string } | null)?.address)
            : publicValue(conflict.proposed),
      })),
    requirements: (content
      ? outstandingRequirements(content, ctx.draft?.snapshot ?? null)
      : []
    ).filter((need) =>
      "key" in need ? namedField(need.key) : !("field" in need) || namedField(need.field)
    ),
    gardens: [...gardenKeys.keys()].map((key, index) => ({
      key,
      label: label(offered[index]?.label ?? ""),
    })),
    actions: activities.slice(0, MODEL_INPUT_POLICY.maxActivities).map((activity) => ({
      uid: activity.definition.actionUID,
      title: label(activity.definition.title),
      inputs: activity.definition.inputs.filter((input) => namedField(input.key)).map(publicInput),
    })),
    observations: [],
  });
  return {
    request: snapshot as InterpretationRequest,
    resolve: (result) => ({
      ...result,
      gardenKey: result.gardenKey === null ? null : (gardenKeys.get(result.gardenKey) ?? null),
      // A value read from where an identifier was taken out is not a value the gardener gave.
      facts: result.facts.filter((fact) => !REDACTION_MARK.test(JSON.stringify(fact.value))),
    }),
  };
}

/**
 * What a model reads in the turn, or null when it could not be asked. Building its view reads
 * earlier messages back; one that cannot be read, or a view too large to send, is no reason to
 * leave the person without an answer, so the turn goes on without the model, as it does when the
 * model itself fails.
 */
export async function interpretTurn(
  core: ReportingCore,
  interpreter: ReportInterpreter,
  timeoutMs: number,
  ctx: TurnContext,
  input: Parameters<typeof dialogueView>[2]
): Promise<InterpretationResult | null> {
  let view: DialogueView;
  try {
    view = dialogueView(core, ctx, input);
  } catch (error) {
    log.warn(
      { cause: error instanceof Error ? error.name : "unknown" },
      "A conversation's context could not be built; the turn continues without the model"
    );
    return null;
  }
  const read = await interpretWithDeadline(interpreter, view.request, timeoutMs, modelMeter(core));
  return read && view.resolve(read);
}
