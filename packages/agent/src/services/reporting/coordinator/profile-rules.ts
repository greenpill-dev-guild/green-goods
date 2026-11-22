import type { DraftRecord } from "../drafts";
import { acceptsAmount } from "../questions";
import type { ReportingCore } from "../runtime";
import { questionProfileOf } from "./draft-commit";
import type { Working } from "./report-work";

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
