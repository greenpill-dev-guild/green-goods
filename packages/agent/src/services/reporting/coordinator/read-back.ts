import {
  outstandingRequirements,
  type ReportContent,
  type ReportField,
} from "@green-goods/shared/modules/agent-reporting";
import type { DraftRecord } from "../drafts";
import { profiledInput } from "../questions";
import { type DescriptionChange, reviseDescription } from "./description";
import { questionProfileOf } from "./draft-commit";
import { formatDetail } from "./field-questions";
import { formatMinutes } from "./prompting";
import type { TurnWriter } from "./writer";

/**
 * What this turn took in, read back from the committed report: the details and time that changed,
 * each as the summary will show it, and a replaced value beside the one it replaced. Nothing is
 * said for the single field the open question asked for, since the answer was plain.
 */
export function acknowledgement(
  writer: TurnWriter,
  before: DraftRecord,
  after: DraftRecord,
  answered: ReportField | undefined,
  notes: readonly string[] = []
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
  // What happened to the description is said even when the change itself needs no reading back.
  if (said.length === 0 || (said.length === 1 && said[0]?.field === answered))
    return notes.length > 0 ? notes.join("").trim() : null;
  const facts = said
    .map(({ title, now, was }) =>
      writer.text(was === null ? "report.factNew" : "report.factChanged", {
        title,
        now,
        was: was ?? "",
      })
    )
    .join("");
  return `${writer.text("report.accepted", { facts })}${notes.join("")}`;
}

/**
 * Notes for the reply when the gardener changed, in this turn, a value their own description
 * also states: the description is the gardener's words and is never rewritten, so the reply says
 * it may still say the old value and how to change it. A model's reading changes nothing here.
 */
export function alignDescription(
  writer: TurnWriter,
  draft: Pick<DraftRecord, "id" | "snapshot">,
  before: ReportContent,
  content: ReportContent,
  snapshot: DraftRecord["snapshot"]
): { feedback: string | null; notes: string[] } {
  const notes: string[] = [];
  const description = content.feedback;
  if (!description || description !== before.feedback) return { feedback: null, notes };
  const turn = writer.sourceEntryId();
  const statedNow = (field: ReportField) => {
    const read = content.provenance[field];
    return Boolean(
      read?.gardenerStated && read.sources.some((source) => source.sourceEntryId === turn)
    );
  };
  const profile = questionProfileOf(writer.core, draft, snapshot);
  for (const definition of snapshot?.definition.inputs ?? []) {
    const was = before.details[definition.key];
    const now = content.details[definition.key];
    const field = `details.${definition.key}` as const;
    if (was === undefined || now === undefined || JSON.stringify(was) === JSON.stringify(now))
      continue;
    if (!statedNow(field)) continue;
    const shown = formatDetail(profiledInput(profile, definition, before.details), was);
    const change: DescriptionChange =
      typeof was === "number" && typeof now === "number"
        ? { kind: "number", before: was, after: now }
        : { kind: "words", before: shown, after: shown };
    const { revised, stale } = reviseDescription(description, change);
    if (revised || stale) notes.push(writer.text("report.descriptionStale", { was: shown }));
  }
  return { feedback: null, notes };
}
