import { applyReportChanges, emptyReport } from "@green-goods/shared/modules/agent-reporting";
import { createDraft, type DraftRecord } from "../drafts";
import { gardenScope } from "../gardens";
import { recordMediaIntake } from "../media-intake";
import { closeConversationPrompt } from "../prompts";
import { requestConnection, welcome } from "./account-steps";
import { isGreeting } from "./commands";
import type { TurnPlan } from "./context";
import {
  commitContentChange,
  commitLifecycle,
  EDITABLE_STATES,
  lifecycleState,
} from "./draft-commit";
import { promptNextStep } from "./prompting";
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

/** The longest message the model may call a hello or an account request rather than a story. */
const MAX_ASIDE_WORDS = 12;

/**
 * Files sent once the summary is out change what would be confirmed, before they are even
 * processed. The report goes back to review as a correction would: the summary showing no longer
 * confirms it, and a confirmation not yet being sent is withdrawn with its publication. The
 * summary is put again once the files are in.
 */
function reopenForFiles(writer: TurnWriter, draft: DraftRecord): DraftRecord {
  const state = lifecycleState(draft);
  if (state === "collecting") return draft;
  const reopened = commitContentChange(writer.core, draft, {
    content: draft.content,
    cause: "files",
    sourceEventId: writer.ctx.event.id,
  });
  // Past the summary, the open question is about publishing what was confirmed.
  if (state !== "review") closeConversationPrompt(writer.core, writer.ctx.conversationId);
  return reopened;
}

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
  if (plan.media.length === 0) {
    if (intent === "status") return handleReportCommand(writer, { kind: "status" }, external);
    // The model's reading of a hello or an account request is trusted only for a short message:
    // a long one is a story, whatever it opens with, and must reach the report.
    const brief = text !== null && text.split(/\s+/u).length <= MAX_ASIDE_WORDS;
    // Linking only sends a link, so the model's reading is enough. Unlinking changes what the
    // chat may do, so like cancelling it takes the command itself.
    if (brief && intent === "connect") return requestConnection(writer, null);
    if (brief && intent === "disconnect") return writer.say("link.disconnectHint");
    if (intent === "help" || intent === "cancel")
      return writer.say(intent === "cancel" && draft ? "report.cancelHint" : "help");
    // A hello describes no work. It gets a welcome, and an open report asks its question again.
    if (text && (isGreeting(text) || (brief && intent === "greeting"))) {
      if (!draft) return welcome(writer);
      writer.say("chat.hello");
      if (["collecting", "review"].includes(lifecycleState(draft)))
        return promptNextStep(writer, draft, external.catalog);
      return handleReportCommand(writer, { kind: "status" }, external);
    }
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
    draft = reopenForFiles(writer, draft);
  }

  const work: Working = { content: draft.content, snapshot: draft.snapshot, changed: false };
  if (external.interpretation) {
    const scope = gardenScope(core.gardens, ctx.account?.address ?? null);
    applyInterpretation(work, external.interpretation, external, sourceEntryId, scope);
  } else if (text && ctx.draft && !work.content.feedback) {
    apply(work, [
      { field: "feedback", value: text, provenance: gardenerFact(sourceEntryId, text) },
    ]);
  }
  // Files are answered by the media job once they are processed, whether or not they could be
  // used: one reply for all of them, then the next question. That job takes the chat's only
  // garden itself, so the garden is said and the next question asked once, not twice. A caption
  // is applied now, and its question waits for the files.
  const fileOnly = !text && plan.media.length > 0;
  if (!fileOnly) autoFill(writer, work, external, sourceEntryId);

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
  if (fileOnly && !work.changed) return;
  if (!work.changed && !["collecting", "review"].includes(lifecycleState(draft))) {
    // Past confirmation an unchanged message must not reissue the summary over the open question.
    handleReportCommand(writer, { kind: "status" }, external);
    return;
  }
  finish(writer, draft, work, external, ctx.draft ? "message" : "story", {
    ask: plan.media.length === 0,
  });
}
