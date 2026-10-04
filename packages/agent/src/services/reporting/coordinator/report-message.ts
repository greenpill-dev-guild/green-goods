import { applyReportChanges, emptyReport } from "@green-goods/shared/modules/agent-reporting";
import { createDraft } from "../drafts";
import { recordMediaIntake } from "../media-intake";
import type { TurnPlan } from "./context";
import { commitLifecycle, EDITABLE_STATES, lifecycleState } from "./draft-commit";
import { handleReportCommand } from "./report-commands";
import {
  apply,
  applyInterpretation,
  autoFill,
  finish,
  gardenerFact,
  type TurnExternal,
  type Working,
} from "./report-work";
import type { TurnWriter } from "./writer";

/** A story, correction or attachment that is not an answer to the open question. */
export function handleReportMessage(
  writer: TurnWriter,
  plan: Extract<TurnPlan, { kind: "message" }>,
  external: TurnExternal
): void {
  const { ctx, core } = writer;
  const binding = ctx.binding;
  if (!binding) throw new Error("Report messages require a consented participant");
  const sourceEntryId = writer.sourceEntryId();
  const text = plan.text?.trim() || null;
  let draft = ctx.draft;

  // Interpreted non-content intents route to deterministic replies; cancelling still needs the
  // explicit command, so a misread message can never discard a report.
  const intent = external.interpretation?.intent;
  if (
    plan.media.length === 0 &&
    (intent === "status" || intent === "help" || intent === "cancel")
  ) {
    if (intent === "status") return handleReportCommand(writer, { kind: "status" }, external);
    return writer.say(intent === "cancel" && draft ? "report.cancelHint" : "help");
  }

  if (draft && !EDITABLE_STATES.has(lifecycleState(draft))) {
    commitLifecycle(core, draft, [{ type: "DEFERRED_INPUT", sourceId: sourceEntryId }], {
      participantAction: true,
    });
    writer.say("report.frozen");
    return;
  }
  if (!draft) {
    const content = emptyReport();
    const initial = text
      ? applyReportChanges(
          content,
          [{ field: "feedback", value: text, provenance: gardenerFact(sourceEntryId, text) }],
          null
        ).content
      : content;
    draft = createDraft(core, {
      participantId: binding.participantId,
      conversationId: ctx.conversationId,
      content: initial,
      sourceEventId: ctx.event.id,
    });
  }
  if (plan.media.length > 0) {
    recordMediaIntake(core, {
      conversationId: ctx.conversationId,
      participantId: binding.participantId,
      draftId: draft.id,
      sourceEntryId,
      media: plan.media,
    });
  }

  const work: Working = { content: draft.content, snapshot: draft.snapshot, changed: false };
  if (external.interpretation) {
    applyInterpretation(work, external.interpretation, external, sourceEntryId, core.gardens);
  } else if (text && ctx.draft && !work.content.feedback) {
    apply(work, [
      { field: "feedback", value: text, provenance: gardenerFact(sourceEntryId, text) },
    ]);
  }
  autoFill(writer, work, external, sourceEntryId);

  if (
    !work.changed &&
    text &&
    ctx.draft &&
    !external.interpretation &&
    lifecycleState(draft) === "review"
  ) {
    // Without interpretation a free-text correction cannot be applied safely; offer the edit menu.
    writer.say("report.editPrompt");
    return;
  }
  if (!text && plan.media.length > 0 && !work.changed) return; // the media job replies after processing
  if (!work.changed && !["collecting", "review"].includes(lifecycleState(draft))) {
    // Past confirmation an unchanged message must not reissue the summary over the open question.
    handleReportCommand(writer, { kind: "status" }, external);
    return;
  }
  finish(writer, draft, work, external, ctx.draft ? "message" : "story");
}
