import {
  type ActionDefinitionSnapshot,
  applyReportChanges,
  type FieldChange,
  type FieldProvenance,
  reconcileDetailsWithAction,
  outstandingRequirements,
  type ReportContent,
} from "@green-goods/shared/modules/agent-reporting";
import { resolveWorkSubmissionTitle } from "@green-goods/shared/utils/work/workTitles";
import type { DraftRecord } from "../drafts";
import type { InterpretationResult } from "../interpretation";
import { type GardenDirectory, gardenByKey, type ReportingGarden } from "../gardens";
import { commitContentChange } from "./draft-commit";
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

/** Fills garden and Action only when the garden list and the catalog leave no ambiguity. */
export function autoFill(
  writer: TurnWriter,
  work: Working,
  external: TurnExternal,
  sourceEntryId: string
): void {
  const gardens = writer.core.gardens.list();
  if (!work.content.garden && gardens.length === 1) {
    apply(work, [
      {
        field: "garden",
        value: gardenRef(gardens[0] as ReportingGarden),
        provenance: systemFact(sourceEntryId),
      },
    ]);
  }
  const result = external.catalog.result;
  const sameGarden =
    external.catalog.garden?.address.toLowerCase() === work.content.garden?.address.toLowerCase();
  if (work.content.actionUID === null && sameGarden && result?.ok && result.actions.length === 1) {
    adoptAction(work, result.actions[0] as ActionDefinitionSnapshot, systemFact(sourceEntryId));
  }
}

export function applyInterpretation(
  work: Working,
  result: InterpretationResult,
  external: TurnExternal,
  sourceEntryId: string,
  gardens: GardenDirectory
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
  const garden = result.gardenKey ? gardenByKey(gardens, result.gardenKey) : null;
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
  const next = work.changed
    ? commitContentChange(writer.core, draft, {
        content: work.content,
        snapshot: work.snapshot,
        cause,
        sourceEventId: writer.ctx.event.id,
      })
    : draft;
  if (draft.content.actionUID === null && next.content.actionUID !== null && next.snapshot) {
    const remaining = outstandingRequirements(next.content, next.snapshot).filter((item) =>
      ["detail", "time", "title", "feedback", "evidence"].includes(item.kind)
    ).length;
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
