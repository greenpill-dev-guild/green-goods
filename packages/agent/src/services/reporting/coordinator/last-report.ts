import type { Address } from "@green-goods/shared/types/domain";
import type { CatalogResult } from "../catalog";
import type { DraftRecord } from "../drafts";
import { type GardenScope, gardenScope, gardensIn, type ReportingGarden } from "../gardens";
import { promptsAsked, type PromptRecord } from "../prompts";
import type { ReportingCore } from "../runtime";
import { lastReport } from "../suggestions";
import type { TurnContext } from "./context";
import type { ConversationWriter } from "./writer";

/**
 * "Same as last time?": a report that has not named its garden or activity yet is offered the
 * ones the linked account's last published report had, once. It is an offer and nothing more: the
 * garden has to be one the account still reports to, the activity one that garden still offers,
 * and the person can take it, choose something else, or turn the offer off. Counts, time, photos
 * and the description always come from the new report.
 */
export interface Suggestion {
  garden: ReportingGarden;
  actionUID: number;
  /** The suggested garden's activities as this turn read them. */
  result: CatalogResult | null;
}

export const SUGGESTION_PROMPT = "suggest_last";
export const USE_SUGGESTION = "use";
export const NO_SUGGESTIONS = "never";

/** What this turn may suggest, with the suggested garden's activities read for it. */
export async function suggestionFor(
  core: ReportingCore,
  ctx: TurnContext,
  account: Address | null,
  read: { garden: ReportingGarden | null; result: CatalogResult | null },
  activitiesOf: (garden: ReportingGarden) => Promise<CatalogResult>
): Promise<Suggestion | undefined> {
  const { binding, draft } = ctx;
  if (!binding || !account) return undefined;
  if (draft && typeof draft.content.actionUID === "number") return undefined;
  if (draft && promptsAsked(core, "draft", draft.id).some(({ kind }) => kind === SUGGESTION_PROMPT))
    return undefined;
  const last = lastReport(core, {
    participantId: binding.participantId,
    chainId: core.settings.chainId,
    account,
  });
  // Only a garden the account still reports to: a suggestion gives no one a place in a garden.
  const garden = gardensIn(gardenScope(core.gardens, account)).find(
    (candidate) => candidate.address === last?.gardenAddress
  );
  if (!last || !garden) return undefined;
  const named = draft?.content.garden?.address;
  if (named && named !== garden.address) return undefined;
  const result =
    read.garden?.key === garden.key && read.result ? read.result : await activitiesOf(garden);
  return { garden, actionUID: last.actionUID, result };
}

/** The garden a tap on "yes" takes, so its activities are read in the turn that takes it. */
export function suggestedGarden(scope: GardenScope, prompt: PromptRecord): ReportingGarden | null {
  const [key] = (prompt.fieldKey ?? "").split("|");
  return gardensIn(scope).find((garden) => garden.key === key) ?? null;
}

/**
 * Puts the suggestion as the report's open question, when there is one to make and it has not
 * been made for this report. Returns whether it was put.
 */
export function offerLastReport(
  writer: ConversationWriter,
  draft: DraftRecord,
  suggestion: Suggestion | undefined
): boolean {
  if (!suggestion || draft.content.actionUID !== null) return false;
  if (promptsAsked(writer.core, "draft", draft.id).some(({ kind }) => kind === SUGGESTION_PROMPT))
    return false;
  const named = draft.content.garden?.address;
  if (named && named !== suggestion.garden.address) return false;
  const action = suggestion.result?.ok
    ? suggestion.result.actions.find(
        (candidate) => candidate.definition.actionUID === suggestion.actionUID
      )
    : undefined;
  // With the garden settled and the activity no longer offered, there is nothing to suggest.
  if (named && !action) return false;
  const title = action?.definition.title ?? "";
  writer.ask(
    {
      subjectKind: "draft",
      resourceId: draft.id,
      resourceRevision: draft.revision,
      kind: SUGGESTION_PROMPT,
      fieldKey: `${suggestion.garden.key}|${action ? suggestion.actionUID : ""}`,
      options: [
        { id: "use", label: writer.text("suggest.use"), value: USE_SUGGESTION },
        { id: "change", label: writer.text("suggest.change"), value: "change" },
        { id: "never", label: writer.text("suggest.never"), value: NO_SUGGESTIONS },
      ],
    },
    () =>
      writer.text(named ? "suggest.lastAction" : action ? "suggest.last" : "suggest.lastGarden", {
        garden: suggestion.garden.label,
        action: title,
      })
  );
  return true;
}
