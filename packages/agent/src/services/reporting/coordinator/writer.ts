import { type CopyValues, type ReportingCopyKey, reportingText } from "../copy";
import { enqueueReply } from "../outbox";
import { issuePrompt, type PromptOption, type PromptRecord, replyIdFor } from "../prompts";
import type { ReportingCore } from "../runtime";
import type { OutboundMessage } from "../transport";
import type { TurnContext } from "./context";

/**
 * Collects one turn's writes inside its commit transaction. Replies get deterministic dedupe
 * keys (event, position, kind), so a turn replayed after a crash cannot enqueue a reply twice,
 * and the source entry for the inbound message is written once and referenced by provenance.
 */
export class TurnWriter {
  private replyIndex = 0;
  private sourceId: string | null = null;

  constructor(
    readonly core: ReportingCore,
    readonly ctx: TurnContext
  ) {}

  text(key: ReportingCopyKey, values: CopyValues = {}): string {
    return reportingText(this.ctx.locale, key, {
      support: this.core.settings.supportContact,
      ...values,
    });
  }

  /** The immutable record of this inbound message that field provenance points at. */
  sourceEntryId(): string {
    if (this.sourceId) return this.sourceId;
    const existing = this.core.db
      .query("SELECT id FROM source_entries WHERE inbox_event_id = $event")
      .get({ event: this.ctx.event.id }) as { id: string } | null;
    if (existing) return (this.sourceId = existing.id);
    const id = this.core.ids.id();
    const { message } = this.ctx;
    this.core.db
      .query(
        `INSERT INTO source_entries
           (id, conversation_id, channel_subject_id, channel_binding_id, participant_id, inbox_event_id,
            kind, content_ciphertext, received_at)
         VALUES ($id, $conversation, $subject, $binding, $participant, $event, $kind, $content, $received)`
      )
      .run({
        id,
        conversation: this.ctx.conversationId,
        subject: this.ctx.subjectId,
        binding: this.ctx.binding?.bindingId ?? null,
        participant: this.ctx.binding?.participantId ?? null,
        event: this.ctx.event.id,
        kind: message.replyId ? "reply" : message.media?.length ? "media" : "text",
        content: this.core.keyring.seal(
          JSON.stringify({
            text: message.text ?? null,
            replyId: message.replyId ?? null,
            media: message.media ?? [],
          }),
          `source_entries.content:${id}`
        ),
        received: message.sentAt,
      });
    return (this.sourceId = id);
  }

  reply(message: OutboundMessage, kind: string, promptId?: string, operationId?: string): void {
    const index = this.replyIndex;
    this.replyIndex += 1;
    enqueueReply(this.core, {
      conversationId: this.ctx.conversationId,
      subjectId: this.ctx.subjectId,
      participantId: this.ctx.binding?.participantId ?? null,
      bindingId: this.ctx.binding?.bindingId ?? null,
      identityEpoch: this.ctx.binding?.identityEpoch ?? null,
      promptId: promptId ?? null,
      operationId: operationId ?? null,
      dedupeKey: `${this.ctx.event.id}:${index}:${kind}`,
      replyKind: kind,
      audience: "conversation",
      message,
    });
  }

  say(key: ReportingCopyKey, values: CopyValues = {}): void {
    this.reply({ text: this.text(key, values) }, key);
  }

  /** Issues the conversation's single open question and sends it with numbered choices. */
  ask(
    input: {
      subjectKind: PromptRecord["subjectKind"];
      resourceId: string | null;
      resourceRevision: number | null;
      kind: string;
      fieldKey?: string | null;
      options?: PromptOption[];
      page?: number;
    },
    text: (prompt: PromptRecord) => string,
    link?: OutboundMessage["link"]
  ): PromptRecord {
    const prompt = issuePrompt(this.core, {
      conversationId: this.ctx.conversationId,
      subjectId: this.ctx.subjectId,
      participantId: this.ctx.binding?.participantId ?? null,
      ...input,
    });
    const choices = prompt.options.map((option) => ({
      id: replyIdFor(prompt, option),
      label: option.label,
    }));
    const numbered =
      prompt.options.length > 0
        ? `\n${prompt.options.map((option, index) => `${index + 1}. ${option.label}`).join("\n")}`
        : "";
    this.reply(
      {
        text: `${text(prompt)}${numbered}`,
        ...(choices.length ? { choices } : {}),
        ...(link ? { link } : {}),
      },
      `prompt:${input.kind}`,
      prompt.id
    );
    return prompt;
  }
}
