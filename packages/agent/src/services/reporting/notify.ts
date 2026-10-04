import { ConversationWriter } from "./coordinator/writer";
import { bindingForSubject } from "./participants";
import type { ReportingCore } from "./runtime";

/**
 * A writer for background work (jobs and browser commands) that must reply in a participant's
 * conversation. The recipient is resolved from the conversation's own sender and the live binding
 * at write time; a participant who has since relinked elsewhere is not addressed here.
 */
export function participantWriter(
  core: ReportingCore,
  input: { participantId: string; conversationId: string; dedupePrefix: string }
): ConversationWriter | null {
  const sender = core.db
    .query(
      `SELECT channel_subject_id FROM inbox_events
       WHERE conversation_id = $conversation AND channel_subject_id IS NOT NULL
       ORDER BY arrival_seq DESC LIMIT 1`
    )
    .get({ conversation: input.conversationId }) as { channel_subject_id: string } | null;
  if (!sender) return null;
  const binding = bindingForSubject(core, sender.channel_subject_id);
  if (!binding || binding.participantId !== input.participantId) return null;
  return new ConversationWriter(core, {
    conversationId: input.conversationId,
    subjectId: sender.channel_subject_id,
    binding,
    locale: binding.locale ?? "en",
    dedupePrefix: input.dedupePrefix,
  });
}

export function conversationRealm(core: ReportingCore, conversationId: string): string {
  const row = core.db
    .query("SELECT provider_realm FROM conversations WHERE id = $id")
    .get({ id: conversationId }) as { provider_realm: string } | null;
  if (!row) throw new Error("Conversation does not exist");
  return row.provider_realm;
}
