import {
  outstandingRequirements,
  type ReportContent,
  type ReportField,
} from "@green-goods/shared/modules/agent-reporting";
import type { DraftRecord } from "../drafts";
import { profiledInput } from "../questions";
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
