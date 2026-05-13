import * as db from "../services/db";
import { agentActionLabel, agentMessage } from "../i18n";
import type { InboundMessage, OutboundResponse } from "../types";

export type IdempotentHandler = "approve" | "reject" | "submit-confirm";
export type IdempotentAction = "approval" | "rejection" | "submission";

export function messageIdempotencyKey(handler: IdempotentHandler, message: InboundMessage): string {
  return `${handler}:${message.platform}:${message.sender.platformId}:${message.id}`;
}

export async function getCompletedIdempotencyResponse(
  handler: IdempotentHandler,
  message: InboundMessage
): Promise<OutboundResponse | undefined> {
  const record = await db.getIdempotencyRecord(messageIdempotencyKey(handler, message));
  return record?.status === "completed" ? record.response : undefined;
}

export async function getExistingIdempotencyResponse(
  handler: IdempotentHandler,
  message: InboundMessage,
  action: IdempotentAction
): Promise<OutboundResponse | undefined> {
  const record = await db.getIdempotencyRecord(messageIdempotencyKey(handler, message));
  if (!record) {
    return undefined;
  }

  return record.status === "completed" && record.response
    ? record.response
    : idempotencyInProgressResponse(action, message.locale);
}

export async function claimMessageIdempotency(
  handler: IdempotentHandler,
  message: InboundMessage
): Promise<boolean> {
  return db.claimIdempotencyKey({
    key: messageIdempotencyKey(handler, message),
    handler,
    platform: message.platform,
    platformId: message.sender.platformId,
    messageId: message.id,
  });
}

export async function completeMessageIdempotency(
  handler: IdempotentHandler,
  message: InboundMessage,
  response: OutboundResponse
): Promise<void> {
  await db.completeIdempotencyKey(messageIdempotencyKey(handler, message), response);
}

export function idempotencyInProgressResponse(
  action: IdempotentAction,
  locale?: string
): OutboundResponse {
  return {
    text: agentMessage(locale, "idempotency.inProgress", {
      action: agentActionLabel(locale, action),
    }),
  };
}
