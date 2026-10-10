import { findInput } from "@green-goods/shared/modules/agent-reporting";
import type { DraftRecord } from "../drafts";
import { askGarden } from "./garden-step";
import { askAction, askAnotherGarden, askField, type CatalogView } from "./prompting";
import type { TurnWriter } from "./writer";

/**
 * Deterministic correction path: with interpretation disabled, a gardener edits by choosing a
 * field and answering it again. The answer is gardener-stated, so it replaces any earlier value.
 */
export function askEditMenu(writer: TurnWriter, draft: DraftRecord): void {
  const labels: Array<[string, string]> = [];
  // A linked chat can always change garden or join another; one with no account needs a choice.
  if (writer.ctx.account || writer.core.gardens.list().length > 1)
    labels.push(["garden", writer.text("edit.garden")]);
  labels.push(
    ["action", writer.text("edit.action")],
    ["title", writer.text("edit.title")],
    ["timeSpentMinutes", writer.text("edit.time")],
    ["feedback", writer.text("edit.feedback")]
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
      return askGarden(writer, draft, writer.ctx.account?.address ?? null);
    case "action":
      if (askAnotherGarden(writer, draft, writer.ctx.account?.address ?? null)) return;
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
