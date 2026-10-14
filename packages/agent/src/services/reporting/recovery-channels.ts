import { bindingForSubject, subjectChannel } from "./participants";
import type { ReportingCore } from "./runtime";

/** Only this provider's old conversations move; another linked channel keeps its own drafts. */
export function recoverySources(
  core: ReportingCore,
  participantId: string,
  subjectId: string
): {
  subjects: string[];
  conversations: string[];
} {
  const rows = core.db
    .query(`SELECT b.channel_subject_id FROM channel_bindings b
    JOIN channel_subjects s ON s.id = b.channel_subject_id
    WHERE b.participant_id = $participant AND b.status IN ('active','suspended')
      AND substr(s.provider_realm, 1, instr(s.provider_realm, ':') - 1) = $channel`)
    .all({ participant: participantId, channel: subjectChannel(core, subjectId) }) as Array<{
    channel_subject_id: string;
  }>;
  const subjects = rows.map((row) => row.channel_subject_id);
  const conversations = new Set<string>();
  for (const subject of subjects) {
    const found = core.db
      .query(
        "SELECT DISTINCT conversation_id FROM inbox_events WHERE channel_subject_id = $subject AND conversation_id IS NOT NULL"
      )
      .all({ subject }) as Array<{ conversation_id: string }>;
    for (const row of found) conversations.add(row.conversation_id);
  }
  return { subjects, conversations: [...conversations] };
}

export function destinationAvailable(
  core: ReportingCore,
  participantId: string,
  newSubject: string,
  newConversation: string,
  sources: ReturnType<typeof recoverySources>
): boolean {
  const target = bindingForSubject(core, newSubject);
  if (!target || target.bindingStatus !== "provisional" || target.participantId === participantId)
    return false;
  if (
    core.db
      .query("SELECT 1 FROM account_bindings WHERE participant_id = $participant")
      .get({ participant: target.participantId })
  )
    return false;
  for (const table of ["work_drafts", "review_intents"]) {
    const open = core.db
      .query(`SELECT participant_id, conversation_id FROM ${table} WHERE lifecycle = 'open'
      AND (participant_id = $participant OR conversation_id = $conversation)`)
      .all({ participant: participantId, conversation: newConversation }) as Array<{
      participant_id: string;
      conversation_id: string;
    }>;
    if (
      open.some((row) => row.conversation_id === newConversation) ||
      open.filter((row) => sources.conversations.includes(row.conversation_id)).length > 1
    )
      return false;
  }
  return true;
}
