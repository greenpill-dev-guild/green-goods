import { findInput } from "@green-goods/shared/modules/agent-reporting";
import type { DraftRecord } from "../drafts";
import { askAction, askField, askGarden, type CatalogView } from "./prompting";
import type { TurnWriter } from "./writer";

/**
 * Deterministic correction path: with interpretation disabled, a gardener edits by choosing a
 * field and answering it again. The answer is gardener-stated, so it replaces any earlier value.
 */
export function askEditMenu(writer: TurnWriter, draft: DraftRecord): void {
  const labels: Array<[string, string]> = [];
  if (writer.core.settings.gardens.length > 1) labels.push(["garden", "Garden"]);
  labels.push(
    ["action", "Activity"],
    ["title", "Title"],
    ["timeSpentMinutes", "Time spent"],
    ["feedback", "Description"]
  );
  for (const input of draft.snapshot?.definition.inputs ?? []) {
    if (input.type !== "repeater") labels.push([`details.${input.key}`, input.title]);
  }
  writer.ask(
    {
      subjectKind: "draft",
      resourceId: draft.id,
      resourceRevision: draft.revision,
      kind: "edit_field",
      options: labels.map(([value, label], index) => ({ id: `${index}`, label, value })),
    },
    () => writer.text("report.editPrompt")
  );
}

export function askEditField(
  writer: TurnWriter,
  draft: DraftRecord,
  field: string,
  view: CatalogView
): void {
  const base = {
    subjectKind: "draft" as const,
    resourceId: draft.id,
    resourceRevision: draft.revision,
  };
  switch (field) {
    case "garden":
      return askGarden(writer, draft);
    case "action":
      return askAction(writer, draft, view);
    case "title":
      writer.ask({ ...base, kind: "title", fieldKey: "title" }, () =>
        writer.text("report.askTitle")
      );
      return;
    case "timeSpentMinutes":
      writer.ask({ ...base, kind: "time" }, () => writer.text("report.askTime"));
      return;
    case "feedback":
      writer.ask({ ...base, kind: "feedback", fieldKey: "feedback" }, () =>
        writer.text("report.askFeedback")
      );
      return;
    default: {
      const input = findInput(draft.snapshot, field.replace(/^details\./, ""));
      if (input) askField(writer, draft, input);
    }
  }
}
