import {
  type ActionDefinitionSnapshot,
  applyReportChanges,
  type FieldChange,
  type FieldProvenance,
  outstandingFieldQuestions,
  outstandingRequirements,
  reconcileDetailsWithAction,
  type ReportContent,
  type ReportField,
  type SourceRef,
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
import { acceptsAmount, profiledInput } from "../questions";
import type { ReportingCore } from "../runtime";
import { commitContentChange, lifecycleState, questionProfileOf } from "./draft-commit";
import { announceGarden } from "./garden-step";
import { formatDetail } from "./field-questions";
import { type CatalogView, formatMinutes, gardenLabel, promptNextStep } from "./prompting";
import { readStory } from "./story-answers";
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
  /** The one field the open question asked for and got: an answer that needs no reading back. */
  answered?: ReportField;
  /** The linked account's only garden, when this turn gave it to the report without asking. */
  taken?: ReportingGarden;
  /** The reader that needs no model recognised a fact in this turn's words, held or new. */
  recognised?: boolean;
}

export function apply(work: Working, changes: FieldChange[]): void {
  if (changes.length === 0) return;
  const outcome = applyReportChanges(work.content, changes, work.snapshot);
  work.changed ||= outcome.applied.length > 0 || outcome.conflicts.length > 0;
  work.content = outcome.content;
}

/**
 * Reads the facts a message names outright and applies them as the gardener's own. `asked` is the
 * field, or the fields, the open question asks for. A fact the report already holds is left out,
 * so saying a value again changes nothing, and a confirmed report stays confirmed. Returns whether
 * the report changed.
 */
export function applyStory(
  writer: TurnWriter,
  draft: DraftRecord,
  work: Working,
  text: string,
  asked: ReportField | readonly ReportField[] | null = null
): boolean {
  const read = readStory(text, {
    snapshot: work.snapshot,
    profile: questionProfileOf(writer.core, draft, work.snapshot),
    details: work.content.details,
    locale: writer.ctx.locale,
    asked,
  });
  work.recognised ||= read.length > 0;
  const facts = read.filter(
    (fact) => JSON.stringify(valueOf(work.content, fact.field)) !== JSON.stringify(fact.value)
  );
  if (facts.length === 0) return false;
  const changedBefore = work.changed;
  work.changed = false;
  apply(
    work,
    facts.map((fact) => ({
      field: fact.field,
      value: fact.value,
      provenance: gardenerFact(writer.sourceEntryId(), fact.original, fact.unit),
    }))
  );
  const changed = work.changed;
  work.changed ||= changedBefore;
  return changed;
}

function valueOf(content: ReportContent, field: ReportField): unknown {
  if (field === "timeSpentMinutes") return content.timeSpentMinutes;
  return field.startsWith("details.") ? content.details[field.slice("details.".length)] : undefined;
}

/**
 * A report that has just taken its activity reads the gardener's own story again, now that it
 * knows which fields to look for, so what the story already said is not asked. Only fields still
 * empty are filled, each pointing at the message the story came from.
 */
function rereadStory(writer: TurnWriter, draft: DraftRecord, work: Working): void {
  const { content, snapshot } = work;
  const story = content.provenance.feedback;
  if (!snapshot || content.actionUID === null || content.actionUID === draft.content.actionUID)
    return;
  if (!content.feedback || !story?.gardenerStated) return;
  const facts = readStory(content.feedback, {
    snapshot,
    profile: questionProfileOf(writer.core, draft, snapshot),
    details: content.details,
    locale: writer.ctx.locale,
  }).filter((fact) =>
    fact.field === "timeSpentMinutes"
      ? content.timeSpentMinutes === null
      : content.details[fact.field.slice("details.".length)] === undefined
  );
  apply(
    work,
    facts.map((fact) => ({
      field: fact.field,
      value: fact.value,
      provenance: {
        ...story,
        original: fact.original,
        ...(fact.unit ? { originalUnit: fact.unit } : {}),
      },
    }))
  );
}

/**
 * What this turn took in, read back from the committed report: the details and time that changed,
 * each as the summary will show it, and a replaced value beside the one it replaced. Nothing is
 * said for the single field the open question asked for, since the answer was plain.
 */
function acknowledgement(
  writer: TurnWriter,
  before: DraftRecord,
  after: DraftRecord,
  answered: ReportField | undefined
): string | null {
  const profile = questionProfileOf(writer.core, after);
  const lines: Array<{ field: ReportField; title: string; now: string; was: string | null }> = [];
  for (const input of after.snapshot?.definition.inputs ?? []) {
    const now = after.content.details[input.key];
    const was = before.content.details[input.key];
    if (now === undefined || JSON.stringify(now) === JSON.stringify(was)) continue;
    const shown = (value: unknown, details: ReportContent["details"]) =>
      formatDetail(profiledInput(profile, input, details), value);
    lines.push({
      field: `details.${input.key}`,
      title: input.title,
      now: shown(now, after.content.details),
      was: was === undefined ? null : shown(was, before.content.details),
    });
  }
  const time = after.content.timeSpentMinutes;
  if (time !== null && time !== before.content.timeSpentMinutes) {
    const was = before.content.timeSpentMinutes;
    lines.push({
      field: "timeSpentMinutes",
      title: writer.text("report.factTime"),
      now: formatMinutes(time),
      was: was === null ? null : formatMinutes(was),
    });
  }
  // A summary follows a complete report and shows every field, so only replaced values are worth
  // saying first.
  const complete = outstandingRequirements(after.content, after.snapshot).length === 0;
  const said = complete ? lines.filter((line) => line.was !== null) : lines;
  if (said.length === 0 || (said.length === 1 && said[0]?.field === answered)) return null;
  const facts = said
    .map(({ title, now, was }) =>
      writer.text(was === null ? "report.factNew" : "report.factChanged", {
        title,
        now,
        was: was ?? "",
      })
    )
    .join("");
  return writer.text("report.accepted", { facts });
}

/**
 * The rules a report's question profile puts on its numbers, kept whatever set them: a gardener's
 * answer, a model's reading, a disagreement settled, or a file. A count is a whole number of one or
 * more; a number whose meaning follows another field's choice is taken out when that choice
 * changes without it, so it is asked again in its new unit and never shown in the wrong one.
 */
export function keepProfileRules(core: ReportingCore, draft: DraftRecord, work: Working): void {
  const profile = questionProfileOf(core, draft, work.snapshot);
  if (!profile) return;
  const before = draft.content.details;
  const now = work.content.details;
  for (const [key, question] of Object.entries(profile.fields)) {
    const value = now[key];
    if (value === undefined) continue;
    const chooser = question.by?.field;
    // A number held before its type was chosen, or under another type, has no meaning in the new
    // unit: it goes, and is asked again. One given with its type in this turn stays.
    const rechosen =
      chooser !== undefined &&
      before[chooser] !== now[chooser] &&
      JSON.stringify(before[key]) === JSON.stringify(value);
    if (!rechosen && acceptsAmount(profile, key, now, value)) continue;
    const { [key]: _dropped, ...details } = work.content.details;
    const { [`details.${key}` as const]: _read, ...provenance } = work.content.provenance;
    work.content = {
      ...work.content,
      details,
      provenance,
      conflicts: work.content.conflicts.filter((conflict) => conflict.field !== `details.${key}`),
    };
    work.changed = true;
  }
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

/**
 * A report holds no more photos than its activity accepts. Evidence is kept in the order its
 * files were sent, so the first ones sent stay; the rest stay private and out of the report, and
 * so does what only they gave. Returns the activity's maximum when photos were taken off,
 * otherwise null.
 */
export function keepAcceptedPhotos(work: Working): number | null {
  const maximum = work.snapshot?.definition.media.maxImageCount ?? null;
  if (maximum === null || work.content.evidence.length <= maximum) return null;
  const takenOff = new Set(work.content.evidence.slice(maximum).map((photo) => photo.assetId));
  work.content = withoutFactsFrom(
    { ...work.content, evidence: work.content.evidence.slice(0, maximum) },
    takenOff
  );
  work.changed = true;
  return maximum;
}

/**
 * Takes the given photos out of what the report read. A detail another source also gave keeps
 * that source; one only these photos gave goes, and so do the disagreements they raised. A value
 * one of them replaced is not brought back, so a required detail is asked for again. A photo is
 * read only for its activity's details, so nothing else in the report can come from one.
 */
function withoutFactsFrom(content: ReportContent, photos: ReadonlySet<string>): ReportContent {
  const others = (sources: readonly SourceRef[]) =>
    sources.filter(({ assetId }) => assetId === undefined || !photos.has(assetId));
  const details = { ...content.details };
  const provenance = { ...content.provenance };
  for (const key of Object.keys(details)) {
    const field = `details.${key}` as const;
    const read = provenance[field];
    if (!read) continue;
    const kept = others(read.sources);
    if (kept.length === read.sources.length) continue;
    if (kept.length > 0) {
      provenance[field] = { ...read, sources: kept };
      continue;
    }
    delete details[key];
    delete provenance[field];
  }
  const conflicts = content.conflicts.filter(
    (conflict) => others(conflict.provenance.sources).length > 0
  );
  return { ...content, details, provenance, conflicts };
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

/**
 * Commits the turn's changes and says what follows from them. `ask: false` leaves the next
 * question to the reply that follows files being processed, so it is asked once.
 */
export function finish(
  writer: TurnWriter,
  draft: DraftRecord,
  work: Working,
  external: TurnExternal,
  cause: string,
  { ask = true }: { ask?: boolean } = {}
): DraftRecord {
  const account = writer.ctx.account?.address ?? null;
  takeSoleGarden(work, gardenScope(writer.core.gardens, account), () => writer.sourceEntryId());
  // A turn that waits for files reads nothing back, so it reads nothing the gardener was not shown.
  if (ask) rereadStory(writer, draft, work);
  keepProfileRules(writer.core, draft, work);
  // An activity chosen after the photos may accept fewer of them than were sent.
  const photoLimit = keepAcceptedPhotos(work);
  const next = work.changed
    ? commitContentChange(writer.core, draft, {
        content: work.content,
        snapshot: work.snapshot,
        cause,
        sourceEventId: writer.ctx.event.id,
      })
    : draft;
  if (work.taken) announceGarden(writer, work.taken);
  if (photoLimit !== null) writer.say("report.photosKept", { maximum: photoLimit });
  // What follows opens the next question, so one reply says what was understood and what is next.
  // An activity just adopted: say how many questions follow, the count each one is numbered against.
  if (draft.content.actionUID === null && next.content.actionUID !== null && next.snapshot) {
    const remaining = outstandingFieldQuestions(next.content, next.snapshot).length;
    if (remaining > 0) {
      writer.preface(
        writer.text(remaining === 1 ? "report.actionAdoptedOne" : "report.actionAdoptedMany", {
          action: next.snapshot.definition.title,
          garden: gardenLabel(writer.core.gardens, next.content.garden?.address),
          count: remaining,
        })
      );
    }
  }
  // Files are answered once they are processed, in one reply; nothing is read back before that.
  const understood = ask ? acknowledgement(writer, draft, next, work.answered) : null;
  if (understood) writer.preface(understood);
  if (ask) promptNextStep(writer, next, external.catalog);
  writer.flushPreface();
  return next;
}
