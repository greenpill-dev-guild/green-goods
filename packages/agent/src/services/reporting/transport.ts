/**
 * The transport contract every chat adapter implements. The WhatsApp adapter normalizes Meta
 * webhooks into these events; the synthetic test transport and the Telegram-shaped fixtures use
 * the same shape, so the coordinator never learns which platform a message came from.
 *
 * A provider realm names one business sender or bot identity (for example
 * `whatsapp:<phone-number-id>`), so identical user IDs from different senders never collide.
 */
export interface InboundMediaReference {
  providerMediaId: string;
  declaredMime?: string;
  declaredName?: string;
  declaredSize?: number;
}

export interface InboundMessageEvent {
  kind: "message";
  providerRealm: string;
  /** Provider event identity: realm plus this ID is the inbound uniqueness key. */
  eventId: string;
  providerMessageId: string;
  chat: { externalChatId: string; threadId?: string; kind: "direct" | "group" };
  sender: { externalSubjectId: string };
  sentAt: number;
  text?: string;
  /** Interactive reply identifier the agent issued, e.g. `p:<promptId>:<optionId>`. */
  replyId?: string;
  replyToProviderMessageId?: string;
  media?: InboundMediaReference[];
  locale?: string;
}

export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

export interface InboundStatusEvent {
  kind: "delivery_status";
  providerRealm: string;
  eventId: string;
  providerMessageId: string;
  status: DeliveryStatus;
  errorCode?: string;
  occurredAt: number;
}

export type NormalizedInboundEvent = InboundMessageEvent | InboundStatusEvent;

export interface OutboundChoice {
  id: string;
  label: string;
}

export interface OutboundMessage {
  text: string;
  choices?: OutboundChoice[];
  link?: { url: string; label: string; copyLabel?: string };
}

export interface OutboundRequest {
  providerRealm: string;
  /** Decrypted only for the send; never logged. */
  externalChatId: string;
  threadId?: string;
  message: OutboundMessage;
  /** Stable across retries so providers that support it can deduplicate. */
  idempotencyKey: string;
}

/**
 * `accepted` is not delivery: later statuses arrive as inbound events. `uncertain` means the
 * provider may have accepted the message but the response was lost, so a retry could duplicate.
 */
export type OutboundResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "retryable"; errorCode: string; retryAfterMs?: number }
  | { status: "terminal"; errorCode: string }
  | { status: "uncertain"; errorCode: string };

export interface OutboundTransport {
  send(request: OutboundRequest): Promise<OutboundResult>;
}

/** Fetches provider media into bounded memory; adapters own authentication and redirects. */
export interface InboundMediaFetcher {
  fetch(
    providerRealm: string,
    media: InboundMediaReference,
    limits: { maxBytes: number; timeoutMs: number }
  ): Promise<{ bytes: Uint8Array; providerMime?: string }>;
}
