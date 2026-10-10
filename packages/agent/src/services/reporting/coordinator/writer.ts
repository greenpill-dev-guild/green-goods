import { drawsChoiceButtons } from "../channels";
import { type CopyValues, type ReportingCopyKey, reportingText } from "../copy";
import { enqueueReply } from "../outbox";
import type { ParticipantBinding } from "../participants";
import { issuePrompt, type PromptOption, type PromptRecord, replyIdFor } from "../prompts";
import type { ReportingCore } from "../runtime";
import type { OutboundLink, OutboundMessage } from "../transport";
import type { TurnContext } from "./context";

export interface ReplyTarget {
  conversationId: string;
  subjectId: string;
  binding: ParticipantBinding | null;
  locale: string;
  /** Stable prefix for reply dedupe keys: an inbound event ID or a job's own identity. */
  dedupePrefix: string;
}

/**
 * Writes replies and questions for one conversation inside the caller's transaction. Replies get
 * deterministic dedupe keys (prefix, position, kind), so a replayed turn or job cannot enqueue a
 * message twice.
 */
export class ConversationWriter {
  private replyIndex = 0;

  constructor(
    readonly core: ReportingCore,
    readonly target: ReplyTarget
  ) {}

  /** Whether this conversation's channel draws choices as buttons, so no code needs typing. */
  usesButtons(): boolean {
    const row = this.core.db
      .query("SELECT provider_realm FROM conversations WHERE id = $id")
      .get({ id: this.target.conversationId }) as { provider_realm: string } | null;
    return row ? drawsChoiceButtons(row.provider_realm) : false;
  }

  text(key: ReportingCopyKey, values: CopyValues = {}): string {
    return reportingText(this.target.locale, key, {
      support: this.core.settings.supportContact,
      ...values,
    });
  }

  /**
   * A link in a reply opens one of the reporting pages, where an account signs. Those need the
   * person's own browser, so the reply says so and offers the link to copy.
   */
  reply(message: OutboundMessage, kind: string, promptId?: string, operationId?: string): void {
    this.enqueue(
      message.link
        ? {
            ...message,
            text: `${message.text.trimEnd()}\n\n${this.text("link.browserHint")}`,
            link: { ...message.link, copyLabel: this.text("link.copyButton") },
          }
        : message,
      kind,
      promptId,
      operationId
    );
  }

  private enqueue(
    message: OutboundMessage,
    kind: string,
    promptId?: string,
    operationId?: string
  ): void {
    const index = this.replyIndex;
    this.replyIndex += 1;
    const binding = this.target.binding;
    enqueueReply(this.core, {
      conversationId: this.target.conversationId,
      subjectId: this.target.subjectId,
      participantId: binding?.participantId ?? null,
      bindingId: binding?.bindingId ?? null,
      identityEpoch: binding?.identityEpoch ?? null,
      promptId: promptId ?? null,
      operationId: operationId ?? null,
      dedupeKey: `${this.target.dedupePrefix}:${index}:${kind}`,
      replyKind: kind,
      audience: "conversation",
      message,
    });
  }

  say(key: ReportingCopyKey, values: CopyValues = {}, link?: OutboundMessage["link"]): void {
    this.reply({ text: this.text(key, values), ...(link ? { link } : {}) }, key);
  }

  /** A reply that names the linked account, with a button that copies its address. */
  sayWithAccount(
    key: ReportingCopyKey,
    values: CopyValues,
    account: string,
    link?: OutboundMessage["link"]
  ): void {
    this.reply(
      {
        text: this.text(key, { account, ...values }),
        copy: { label: this.text("link.copyAddress"), text: account },
        ...(link ? { link } : {}),
      },
      key
    );
  }

  /** A reply with links to public records. Nothing is signed there, so any browser will do. */
  sayWithRecords(key: ReportingCopyKey, records: OutboundLink[]): void {
    this.enqueue({ text: this.text(key), records }, key);
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
      conversationId: this.target.conversationId,
      subjectId: this.target.subjectId,
      participantId: this.target.binding?.participantId ?? null,
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

/** A conversation writer bound to one inbound event, which also records its source entry. */
export class TurnWriter extends ConversationWriter {
  private sourceId: string | null = null;

  constructor(
    core: ReportingCore,
    readonly ctx: TurnContext
  ) {
    super(core, {
      conversationId: ctx.conversationId,
      subjectId: ctx.subjectId,
      get binding() {
        return ctx.binding;
      },
      get locale() {
        return ctx.locale;
      },
      dedupePrefix: ctx.event.id,
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
}
