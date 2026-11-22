import type { ActionDefinitionSnapshot } from "@green-goods/shared/modules/agent-reporting";
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
