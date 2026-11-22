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
 * Brings the description in step with the values this turn replaced. A count, a choice or a time
 * the description states is changed where it stands; where it cannot be found for certain, the
 * description is left and a note says it still states the old value. A description the turn itself
 * rewrote is left alone. Returns the description to keep and what to tell the gardener.
 */
export function alignDescription(
  writer: TurnWriter,
  draft: Pick<DraftRecord, "id" | "snapshot">,
  before: ReportContent,
  content: ReportContent,
  snapshot: DraftRecord["snapshot"]
): { feedback: string | null; notes: string[] } {
  const notes: string[] = [];
  let description = content.feedback;
  if (!description || description !== before.feedback) return { feedback: null, notes };
  const profile = questionProfileOf(writer.core, draft, snapshot);
  const changes: Array<{ change: DescriptionChange; was: string }> = [];
  for (const definition of snapshot?.definition.inputs ?? []) {
    const was = before.details[definition.key];
    const now = content.details[definition.key];
    if (was === undefined || now === undefined || JSON.stringify(was) === JSON.stringify(now))
      continue;
    const shown = (value: unknown, details: ReportContent["details"]) =>
      formatDetail(profiledInput(profile, definition, details), value);
    if (typeof was === "number" && typeof now === "number") {
      const beforeWords = before.provenance[`details.${definition.key}`]?.original;
      changes.push({
        change: {
          kind: "number",
          before: was,
          after: now,
          ...(beforeWords ? { beforeWords } : {}),
        },
        was: shown(was, before.details),
      });
    } else if (typeof was === "string" && typeof now === "string") {
      changes.push({
        change: {
          kind: "words",
          before: shown(was, before.details),
          after: shown(now, content.details),
        },
        was: shown(was, before.details),
      });
    }
  }
  const timeWas = before.provenance.timeSpentMinutes?.original;
  const timeNow = content.provenance.timeSpentMinutes?.original;
  if (
    before.timeSpentMinutes !== null &&
    content.timeSpentMinutes !== before.timeSpentMinutes &&
    timeWas &&
    timeNow
  )
    changes.push({ change: { kind: "words", before: timeWas, after: timeNow }, was: timeWas });
  for (const { change, was } of changes) {
    const { revised, stale } = reviseDescription(description, change);
    if (revised) description = revised;
    if (revised || stale)
      notes.push(
        writer.text(revised ? "report.descriptionRevised" : "report.descriptionStale", { was })
      );
  }
  return { feedback: description === content.feedback ? null : description, notes };
}
