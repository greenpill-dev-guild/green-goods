import { grantConsent, withdrawConsent } from "../consent";
import { enqueueJob } from "../jobs";
import { releaseQuarantine } from "../inbox";
import { audit, ensureParticipant } from "../participants";
import { closeConversationPrompt, resolvePrompt } from "../prompts";
import { commitLifecycle, EDITABLE_STATES, lifecycleState } from "./draft-commit";
import type { TurnWriter } from "./writer";

/**
 * First contact and consent. Before processing consent the agent reads only enough of a message
 * to recognize the answer to its notice; everything else stays quarantined and expires with the
 * pre-consent window. STOP and DELETE withdraw consent for existing participants even while
 * intake is paused, and withdrawal reaches the dispatch boundary through the paused grants and the
 * consent checks made before every send.
 */
export function sendConsentNotice(writer: TurnWriter): void {
  const { core, ctx } = writer;
  const processors = ctx.modelEnabled ? writer.text("consent.processors") : "";
  writer.ask(
    {
      subjectKind: "consent",
      resourceId: ctx.subjectId,
      resourceRevision: null,
      kind: "processing_consent",
      options: [
        { id: "agree", label: writer.text("consent.agree"), value: "agree" },
        { id: "decline", label: writer.text("consent.decline"), value: "decline" },
      ],
    },
    () => writer.text("consent.notice", { processors })
  );
  core.db
    .query(
      "UPDATE channel_subjects SET notice_version = $version, notice_sent_at = $now WHERE id = $id"
    )
    .run({ id: ctx.subjectId, version: core.settings.noticeVersion, now: core.clock.now() });
}

function purgeQuarantined(writer: TurnWriter): void {
  writer.core.db
    .query(
      `UPDATE inbox_events SET payload_ciphertext = NULL, state = 'expired'
       WHERE channel_subject_id = $subject AND state = 'quarantined' AND id <> $current`
    )
    .run({ subject: writer.ctx.subjectId, current: writer.ctx.event.id });
}

export function answerConsent(writer: TurnWriter, answer: "agree" | "decline"): void {
  const { core, ctx } = writer;
  if (ctx.prompt?.kind === "processing_consent") resolvePrompt(core, ctx.prompt.id);
  if (answer === "decline") {
    purgeQuarantined(writer);
    writer.say("consent.declined");
    audit(core, "consent_declined", { kind: "channel_subject", id: ctx.subjectId });
    return;
  }
  const binding = ensureParticipant(core, ctx.subjectId, ctx.message.locale ?? null);
  grantConsent(core, {
    subjectId: ctx.subjectId,
    participantId: binding.participantId,
    purpose: "processing",
    sourceEventId: ctx.event.id,
  });
  releaseQuarantine(core, ctx.subjectId);
  // Later replies in this turn address the newly consented participant.
  writer.ctx.binding = binding;
  writer.say("consent.granted");
  audit(core, "consent_granted", { kind: "participant", id: binding.participantId });
}

/** STOP or DELETE from a consented participant. */
export function withdrawProcessing(writer: TurnWriter, mode: "stop" | "delete"): void {
  const { core, ctx } = writer;
  withdrawConsent(core, ctx.subjectId, ["processing", "voice"], `chat:${mode}`);
  closeConversationPrompt(core, ctx.conversationId);
  const cancelled =
    ctx.draft && EDITABLE_STATES.has(lifecycleState(ctx.draft))
      ? commitLifecycle(core, ctx.draft, [{ type: "CANCEL" }], { participantAction: true }).refused
          .length === 0
      : false;
  if (ctx.binding) {
    core.db
      .query(
        `UPDATE execution_grants SET state = 'paused', version = version + 1, updated_at = $now
         WHERE participant_id = $participant AND state = 'active'`
      )
      .run({ participant: ctx.binding.participantId, now: core.clock.now() });
    // STOP removes the cancelled report's private content; DELETE removes all unpublished content.
    if (mode === "delete") {
      enqueueJob(core, {
        kind: "purge_private_content",
        subjectId: ctx.binding.participantId,
        dedupeKey: `purge:participant:${ctx.binding.participantId}:${ctx.event.id}`,
        payload: { scope: "participant" },
      });
    } else if (cancelled && ctx.draft) {
      enqueueJob(core, {
        kind: "purge_private_content",
        subjectId: ctx.draft.id,
        dedupeKey: `purge:draft:${ctx.draft.id}`,
        payload: { scope: "draft" },
      });
    }
  }
  writer.say(mode === "stop" ? "consent.stopped" : "consent.deleted");
  audit(core, `consent_withdrawn_${mode}`, { kind: "channel_subject", id: ctx.subjectId });
}

/**
 * The answer to the separate voice-note question. Agreeing records voice consent and requeues the
 * notes held for it; declining leaves them untranscribed, and nothing from them leaves the Agent.
 */
export function answerVoiceConsent(writer: TurnWriter, answer: string): void {
  const { core, ctx } = writer;
  if (ctx.prompt?.kind === "voice_consent") resolvePrompt(core, ctx.prompt.id);
  const binding = ctx.binding;
  if (!binding) return;
  const held = core.db
    .query(
      `SELECT id FROM media_assets WHERE participant_id = $participant AND asset_kind = 'audio'
       AND state = 'quarantined'`
    )
    .all({ participant: binding.participantId }) as Array<{ id: string }>;
  const now = core.clock.now();
  if (answer !== "agree") {
    core.db
      .query(
        `UPDATE media_assets SET state = 'unsupported', updated_at = $now
         WHERE participant_id = $participant AND asset_kind = 'audio' AND state = 'quarantined'`
      )
      .run({ participant: binding.participantId, now });
    writer.say("voice.declined");
    audit(core, "voice_consent_declined", { kind: "participant", id: binding.participantId });
    return;
  }
  grantConsent(core, {
    subjectId: ctx.subjectId,
    participantId: binding.participantId,
    purpose: "voice",
    sourceEventId: ctx.event.id,
  });
  for (const { id } of held) {
    core.db
      .query("UPDATE media_assets SET state = 'received', updated_at = $now WHERE id = $id")
      .run({ id, now });
    enqueueJob(core, {
      kind: "process_media",
      subjectId: id,
      dedupeKey: `media:voice:${id}:${ctx.event.id}`,
    });
  }
  writer.say("voice.granted");
  audit(core, "voice_consent_granted", { kind: "participant", id: binding.participantId });
}
