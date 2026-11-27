import {
  type ActionDefinitionSnapshot,
  parseDurationAnswer,
  parseNumberAnswer,
} from "@green-goods/shared/modules/agent-reporting";
import type { CatalogResult } from "../catalog";
import { type GardenScope, gardensIn, type ReportingGarden } from "../gardens";
import type { InterpretationResult, ReportInterpreter } from "../interpretation";
import type { PromptOption, PromptRecord } from "../prompts";
import { QUESTION_PROFILES, questionProfileFor } from "../questions";
import type { ReportingCore } from "../runtime";
import type { TurnContext, TurnPlan } from "./context";
import { interpretTurn } from "./dialogue-context";
import { readStory } from "./story-answers";

/**
 * What models read in one turn, inside one deadline and in at most two calls. A message is read
 * against whatever the report can be told about: its own activity's fields, or the fields of the
 * few activities it may still choose. When that reading names the garden of a report that had
 * none, the message is read once more against that garden's activities, so the activity and its
 * details come from the same words and are not asked again. When an answer chooses the activity,
 * the report's own story is read once against it, for the same reason. There is no third call.
 */
export interface TurnReading {
  interpretation: InterpretationResult | null;
  reread: InterpretationResult | null;
  garden: ReportingGarden | null;
  result: CatalogResult | null;
}

/** Too little of the deadline left to be worth a second call. */
const MIN_SECOND_CALL_MS = 1_500;

/** The activity an answer to the activity question picks: by its button, its number or its name. */
export function answeredActivity(
  prompt: PromptRecord,
  option: PromptOption | null,
  text: string | null,
  actions: readonly ActionDefinitionSnapshot[]
): ActionDefinitionSnapshot | null {
  const presented = prompt.options
    .filter((choice) => !choice.value.startsWith("page:"))
    .map((choice) => choice.value);
  const typed = text?.trim().toLowerCase();
  const uid =
    option?.value ??
    presented[Number(text) - 1] ??
    actions
      .find((action) => action.definition.title.toLowerCase() === typed)
      ?.definition.actionUID.toString();
  return actions.find((action) => action.definition.actionUID.toString() === uid) ?? null;
}

/** A report's questions that offer a list of choices. */
const REPORT_CHOICES = new Set([
  "select_garden",
  "select_action",
  "field",
  "time_unit",
  "conflict",
  "edit_field",
]);

/**
 * Typed words that do not answer the report's open question as it stands, and that the reader
 * that needs no model cannot place either; null for anything else. For a list of choices: words
 * that are neither numbers nor one of the choices' own labels. For a number or the time: words
 * that are not that amount and name no fact outright. A garden or activity named in other words
 * still lands here, and the answer handler tries its own matching before it turns to the model.
 */
export function unansweredWords(
  core: ReportingCore,
  ctx: TurnContext,
  plan: TurnPlan
): string | null {
  if (plan.kind !== "answer" || plan.option !== null) return null;
  const { prompt } = plan;
  const text = plan.text?.trim();
  if (!text) return null;
  if (prompt.kind === "time" || (prompt.kind === "field" && prompt.options.length === 0)) {
    const snapshot = ctx.draft?.snapshot ?? null;
    const input = snapshot?.definition.inputs.find(({ key }) => key === prompt.fieldKey);
    // A text field takes any words as its answer.
    if (prompt.kind === "field" && input?.type !== "number") return null;
    const amount = prompt.kind === "time" ? parseDurationAnswer(text) : parseNumberAnswer(text);
    // A bare number at the time question is asked its unit; that needs no model either.
    if (amount.ok || amount.reason === "unit_required") return null;
    const named = readStory(text, {
      snapshot,
      profile: questionProfileFor(snapshot, core.questions ?? QUESTION_PROFILES),
      details: ctx.draft?.content.details ?? {},
      locale: ctx.locale,
      asked: prompt.kind === "time" ? "timeSpentMinutes" : `details.${prompt.fieldKey}`,
    });
    return named.length > 0 ? null : text;
  }
  if (!REPORT_CHOICES.has(prompt.kind) || prompt.options.length === 0) return null;
  const said = text.toLowerCase();
  const numbers = said.split(/[\s,;]+/u).every((part) => /^\d+$/u.test(part));
  const label = prompt.options.some((choice) => choice.label.toLowerCase() === said);
  return numbers || label ? null : text;
}

/** Whether the words alone already give every required detail of the activity, and the time. */
function storyCovers(
  core: ReportingCore,
  ctx: TurnContext,
  story: string,
  activity: ActionDefinitionSnapshot
): boolean {
  const read = new Set(
    readStory(story, {
      snapshot: activity,
      profile: questionProfileFor(activity, core.questions ?? QUESTION_PROFILES),
      details: {},
      locale: ctx.locale,
    }).map((fact) => fact.field)
  );
  const timed =
    typeof ctx.draft?.content.timeSpentMinutes === "number" || read.has("timeSpentMinutes");
  return (
    timed &&
    activity.definition.inputs
      .filter((input) => input.required && input.type !== "repeater")
      .every((input) => read.has(`details.${input.key}`))
  );
}

export async function readTurn(input: {
  core: ReportingCore;
  interpreter: ReportInterpreter;
  timeoutMs: number;
  ctx: TurnContext;
  plan: TurnPlan;
  scope: GardenScope;
  garden: ReportingGarden | null;
  result: CatalogResult | null;
  /** The words of this turn a model may read, if any. */
  said: string | null;
  activitiesOf: (garden: ReportingGarden) => Promise<CatalogResult>;
}): Promise<TurnReading> {
  const { core, interpreter, timeoutMs, ctx, plan, scope, said } = input;
  let { garden, result } = input;
  const started = performance.now();
  const remaining = () => timeoutMs - (performance.now() - started);
  const draft = ctx.draft;
  // A report that has its activity is read against that activity as it was frozen, whether or
  // not the catalogue was read this turn: a correction can then name any of its fields.
  const offered = result?.ok ? result.actions : draft?.snapshot ? [draft.snapshot] : [];

  const chosen =
    plan.kind === "answer" && plan.prompt.kind === "select_action" && result?.ok
      ? answeredActivity(plan.prompt, plan.option, plan.text, result.actions)
      : null;
  if (chosen) {
    const story = draft?.content.provenance.feedback?.gardenerStated
      ? draft.content.feedback
      : null;
    const reread =
      story && !storyCovers(core, ctx, story, chosen)
        ? await interpretTurn(core, interpreter, timeoutMs, ctx, {
            text: story,
            gardens: [],
            activities: [chosen],
          })
        : null;
    return { interpretation: null, reread, garden, result };
  }
  if (!said) return { interpretation: null, reread: null, garden, result };

  let interpretation = await interpretTurn(core, interpreter, timeoutMs, ctx, {
    text: said,
    gardens: gardensIn(scope),
    activities: offered,
  });
  // A garden the model read for a report that has none yet: its activities are read in this turn
  // too, so the reply can ask which activity instead of failing to list them.
  const named = gardensIn(scope).find((candidate) => candidate.key === interpretation?.gardenKey);
  if (interpretation && named && !garden && !draft?.content.garden) {
    garden = named;
    result = await input.activitiesOf(named);
    if (result.ok && result.actions.length > 0 && remaining() > MIN_SECOND_CALL_MS) {
      const second = await interpretTurn(core, interpreter, remaining(), ctx, {
        text: said,
        gardens: [named],
        activities: result.actions,
      });
      if (second) {
        const again = new Set(second.facts.map((fact) => fact.field));
        interpretation = {
          ...interpretation,
          actionUID: second.actionUID ?? interpretation.actionUID,
          facts: [
            ...interpretation.facts.filter((fact) => !again.has(fact.field)),
            ...second.facts,
          ],
          models: [...new Set([...interpretation.models, ...second.models])],
        };
      }
    }
  }
  return { interpretation, reread: null, garden, result };
}
