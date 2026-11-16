import { createLogger } from "../logger";
import { ConversationWriter } from "./coordinator/writer";
import { bindingForSubject } from "./participants";
import type { ReportingCore } from "./runtime";

const log = createLogger("reporting");

/** A dedupe prefix opens with a word naming the reply's purpose; any other opening is an id. */
const PURPOSE = /^[a-z]+(?:-[a-z]+)*$/;

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
  if (!sender) return noRecipient("no_sender", input.dedupePrefix);
  const binding = bindingForSubject(core, sender.channel_subject_id);
  if (!binding) return noRecipient("no_binding", input.dedupePrefix);
  if (binding.participantId !== input.participantId)
    return noRecipient("binding_moved", input.dedupePrefix);
  return new ConversationWriter(core, {
    conversationId: input.conversationId,
    subjectId: sender.channel_subject_id,
    binding,
    locale: binding.locale ?? "en",
    dedupePrefix: input.dedupePrefix,
  });
}

/**
 * A reply with nobody to address is never written, so the miss leaves a warning: why, and what
 * the reply was for. Only the purpose word is logged, never the ids that follow it.
 */
function noRecipient(
  reason: "no_sender" | "no_binding" | "binding_moved",
  dedupePrefix: string
): null {
  const [head = ""] = dedupePrefix.split(":", 1);
  log.warn(
    { reason, purpose: PURPOSE.test(head) ? head : "other" },
    "No live recipient in a participant's conversation"
  );
  return null;
}

export function conversationRealm(core: ReportingCore, conversationId: string): string {
  const row = core.db
    .query("SELECT provider_realm FROM conversations WHERE id = $id")
    .get({ id: conversationId }) as { provider_realm: string } | null;
  if (!row) throw new Error("Conversation does not exist");
  return row.provider_realm;
}
