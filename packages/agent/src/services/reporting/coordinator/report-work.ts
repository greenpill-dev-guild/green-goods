import {
  type ActionDefinitionSnapshot,
  applyReportChanges,
  type FieldChange,
  type FieldProvenance,
  outstandingFieldQuestions,
  reconcileDetailsWithAction,
  type ReportContent,
} from "@green-goods/shared/modules/agent-reporting";
import { resolveWorkSubmissionTitle } from "@green-goods/shared/utils/work/workTitles";
import type { Address } from "@green-goods/shared/types/domain";
import type { DraftRecord } from "../drafts";
import type { InterpretationResult } from "../interpretation";
import {
  findGarden,
  type GardenDirectory,
  type GardenScope,
  gardenScope,
  gardensIn,
  type ReportingGarden,
  soleGarden,
} from "../gardens";
import { commitContentChange, lifecycleState } from "./draft-commit";
import { announceGarden } from "./garden-step";
import { type CatalogView, gardenLabel, promptNextStep } from "./prompting";
import type { TurnWriter } from "./writer";

/**
 * The working copy of a draft during one turn. Changes go through Shared's report rules, so a
 * model proposal cannot overwrite a gardener-stated value, and the turn commits once at the end.
 */
export interface TurnExternal {
  catalog: CatalogView;
  interpretation: InterpretationResult | null;
}

export const gardenerFact = (
  sourceEntryId: string,
  original?: string,
  unit?: string
): FieldProvenance => ({
  kind: "reported",
  origin: "gardener",
  sources: [{ sourceEntryId }],
  ...(original ? { original } : {}),
  ...(unit ? { originalUnit: unit } : {}),
  gardenerStated: true,
});

const systemFact = (sourceEntryId: string): FieldProvenance => ({
  kind: "computed",
  origin: "system",
  sources: [{ sourceEntryId }],
  gardenerStated: false,
});

export function gardenRef(garden: ReportingGarden) {
  return { chainId: garden.chainId, address: garden.address };
}

export interface Working {
  content: ReportContent;
  snapshot: ActionDefinitionSnapshot | null;
  changed: boolean;
  /** The linked account's only garden, when this turn gave it to the report without asking. */
  taken?: ReportingGarden;
}

export function apply(work: Working, changes: FieldChange[]): void {
  if (changes.length === 0) return;
  const outcome = applyReportChanges(work.content, changes, work.snapshot);
  work.changed ||= outcome.applied.length > 0 || outcome.conflicts.length > 0;
  work.content = outcome.content;
}

/** Adopts an Action and its frozen definition, keeping only details that definition accepts. */
export function adoptAction(
  work: Working,
  snapshot: ActionDefinitionSnapshot,
  provenance: FieldProvenance
): void {
  work.snapshot = snapshot;
  apply(work, [{ field: "action", value: snapshot.definition.actionUID, provenance }]);
  if (work.content.actionUID !== snapshot.definition.actionUID) return;
  work.content = reconcileDetailsWithAction(work.content, snapshot).content;
  if (!work.content.title) {
    const title = resolveWorkSubmissionTitle({
      actionTitle: snapshot.definition.title,
      actionUID: snapshot.definition.actionUID,
    });
    apply(work, [
      {
        field: "title",
        value: title,
        provenance: { ...provenance, origin: "system", kind: "computed", gardenerStated: false },
      },
    ]);
  }
  work.changed = true;
}

/**
 * A report still being put together drops a garden the account now linked to its chat does not
 * report to. The indexer's answer is enough to ask again, never to refuse: a report that is
 * already confirmed keeps its garden, and the chain decides when it is published. Gardens that
 * cannot be read leave the choice alone.
 */
export function gardenToDrop(
  directory: GardenDirectory,
  draft: DraftRecord | null,
  account: Address | null
): ReportingGarden | null {
  if (!draft || !account || !["collecting", "review"].includes(lifecycleState(draft))) return null;
  const garden = findGarden(directory, draft.content.garden?.address);
  const scope = gardenScope(directory, account);
  if (!garden || scope.kind !== "own") return null;
  return scope.gardens.some((own) => own.key === garden.key) ? null : garden;
}

/**
 * A report with no garden takes the only one its chat could choose. `sourceEntryId` names the
 * message during which that happened, and is only read when a garden is taken.
 */
export function takeSoleGarden(
  work: Working,
  scope: GardenScope,
  sourceEntryId: () => string
): void {
  const sole = soleGarden(scope);
  if (work.content.garden || !sole) return;
  apply(work, [
    { field: "garden", value: gardenRef(sole), provenance: systemFact(sourceEntryId()) },
  ]);
  // A chat with no account takes the only garden there is unannounced, as it always has: the
  // activity question that follows names it.
  if (scope.kind === "own" && work.content.garden) work.taken = sole;
}

/** Fills garden and Action only when the chat's gardens and the catalog leave no ambiguity. */
export function autoFill(
  writer: TurnWriter,
  work: Working,
  external: TurnExternal,
  sourceEntryId: string
): void {
  const account = writer.ctx.account?.address ?? null;
  takeSoleGarden(work, gardenScope(writer.core.gardens, account), () => sourceEntryId);
  const result = external.catalog.result;
  const sameGarden =
    external.catalog.garden?.address.toLowerCase() === work.content.garden?.address.toLowerCase();
  if (work.content.actionUID === null && sameGarden && result?.ok && result.actions.length === 1) {
    adoptAction(work, result.actions[0] as ActionDefinitionSnapshot, systemFact(sourceEntryId));
  }
}

/** `scope` is what the chat may choose from: a garden the model reads outside it is not taken. */
export function applyInterpretation(
  work: Working,
  result: InterpretationResult,
  external: TurnExternal,
  sourceEntryId: string,
  scope: GardenScope
): void {
  const provenance = (
    kind: FieldProvenance["kind"],
    original?: string,
    unit?: string
  ): FieldProvenance => ({
    kind,
    origin: "model",
    sources: [{ sourceEntryId }],
    ...(original ? { original } : {}),
    ...(unit ? { originalUnit: unit } : {}),
    model: result.models.join(","),
    gardenerStated: false,
  });
  const garden = gardensIn(scope).find((candidate) => candidate.key === result.gardenKey);
  if (garden)
    apply(work, [
      { field: "garden", value: gardenRef(garden), provenance: provenance("reported") },
    ]);
  const candidates = external.catalog.result?.ok ? external.catalog.result.actions : [];
  const action = candidates.find(
    (candidate) => candidate.definition.actionUID === result.actionUID
  );
  if (action && work.content.actionUID === null) adoptAction(work, action, provenance("reported"));
  apply(
    work,
    result.facts.map((fact) => ({
      field: fact.field,
      value: fact.value,
      provenance: provenance(fact.kind, fact.original, fact.unit),
    }))
  );
}

export function finish(
  writer: TurnWriter,
  draft: DraftRecord,
  work: Working,
  external: TurnExternal,
  cause: string
): DraftRecord {
  const account = writer.ctx.account?.address ?? null;
  takeSoleGarden(work, gardenScope(writer.core.gardens, account), () => writer.sourceEntryId());
  const next = work.changed
    ? commitContentChange(writer.core, draft, {
        content: work.content,
        snapshot: work.snapshot,
        cause,
        sourceEventId: writer.ctx.event.id,
      })
    : draft;
  if (work.taken) announceGarden(writer, work.taken);
  // An activity just adopted: say how many questions follow, the count each one is numbered against.
  if (draft.content.actionUID === null && next.content.actionUID !== null && next.snapshot) {
    const remaining = outstandingFieldQuestions(next.content, next.snapshot).length;
    if (remaining > 0) {
      writer.say(remaining === 1 ? "report.actionAdoptedOne" : "report.actionAdoptedMany", {
        action: next.snapshot.definition.title,
        garden: gardenLabel(writer.core.gardens, next.content.garden?.address),
        count: remaining,
      });
    }
  }
  promptNextStep(writer, next, external.catalog);
  return next;
}
