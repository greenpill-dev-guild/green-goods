import type {
  AttachmentKind,
  CaptureType,
  ChatMessage,
  ChatMessageAttachment,
  ChatMessageStatus,
  Platform,
} from "../../types";
import type { FundingIntentRecord } from "../funding-intents";

export interface FundingIntentRow {
  id: string;
  gardenId: string;
  gardenName: string;
  gardenLocation: string | null;
  destinationType: FundingIntentRecord["destinationType"];
  destinationAddress: FundingIntentRecord["destinationAddress"];
  fundingIntent: FundingIntentRecord["fundingIntent"];
  paymentMethod: FundingIntentRecord["paymentMethod"];
  availabilityKey: string;
  clientRequestId: string;
  idempotencyFingerprint: string;
  amountUsd: string;
  chainId: number;
  token: FundingIntentRecord["token"];
  provider: "thirdweb";
  providerSessionId: string | null;
  providerPaymentId: string | null;
  status: FundingIntentRecord["status"];
  payerEmailHash: string | null;
  receiptTokenHash: string;
  quoteExpiresAt: string;
  checkoutExpiresAt: string | null;
  receiverAddress: FundingIntentRecord["receiverAddress"] | null;
  sourceRoute: FundingIntentRecord["sourceRoute"] | null;
  managementUrl: FundingIntentRecord["managementUrl"] | null;
  quotedAssetAmount: string | null;
  minAssetAmount: string | null;
  fundedAssetAmount: string | null;
  fundingTxHash: string | null;
  failureCode: FundingIntentRecord["failureCode"] | null;
  checkoutSession: string | null;
  transactionAttempts: string;
  createdAt: string;
  updatedAt: string;
}

type SqlValue = string | number | null;

export interface ChatMessageRow {
  id: string;
  platform: string;
  chatId: string;
  threadId: string | null;
  messageId: string;
  senderPlatformId: string;
  senderDisplayName: string | null;
  text: string;
  replyToMessageId: string | null;
  inferredType: string;
  status: string;
  postedAt: number;
  updatedAt: number;
}

export interface ChatMessageAttachmentRow {
  id: string;
  chatMessageId: string;
  ordinal: number;
  kind: string;
  telegramFileId: string;
  mimeType: string | null;
  fileSize: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  createdAt: number;
}

export function serializeFundingIntent(record: FundingIntentRecord): SqlValue[] {
  return [
    record.id,
    record.gardenId,
    record.gardenName,
    record.gardenLocation ?? null,
    record.destinationType,
    record.destinationAddress,
    record.fundingIntent,
    record.paymentMethod,
    record.availabilityKey,
    record.clientRequestId,
    record.idempotencyFingerprint,
    record.amountUsd,
    record.chainId,
    record.token,
    record.provider,
    record.providerSessionId ?? null,
    record.providerPaymentId ?? null,
    record.status,
    record.payerEmailHash ?? null,
    record.receiptTokenHash,
    record.quoteExpiresAt,
    record.checkoutExpiresAt ?? null,
    record.receiverAddress ?? null,
    record.sourceRoute ?? null,
    record.managementUrl ?? null,
    record.quotedAssetAmount ?? null,
    record.minAssetAmount ?? null,
    record.fundedAssetAmount ?? null,
    record.fundingTxHash ?? null,
    record.failureCode ?? null,
    record.checkoutSession ? JSON.stringify(record.checkoutSession) : null,
    JSON.stringify(record.transactionAttempts),
    record.createdAt,
    record.updatedAt,
  ];
}

export function serializeFundingIntentForUpdate(record: FundingIntentRecord): SqlValue[] {
  const [, ...withoutId] = serializeFundingIntent(record);
  return [...withoutId, record.id];
}

export function deserializeChatMessage(
  row: ChatMessageRow,
  attachments: ChatMessageAttachment[]
): ChatMessage {
  return {
    id: row.id,
    platform: row.platform as Platform,
    chatId: row.chatId,
    threadId: row.threadId ?? undefined,
    messageId: row.messageId,
    senderPlatformId: row.senderPlatformId,
    senderDisplayName: row.senderDisplayName ?? undefined,
    text: row.text,
    replyToMessageId: row.replyToMessageId ?? undefined,
    inferredType: row.inferredType as CaptureType,
    status: row.status as ChatMessageStatus,
    postedAt: row.postedAt,
    updatedAt: row.updatedAt,
    attachments,
  };
}

export function deserializeChatMessageAttachment(
  row: ChatMessageAttachmentRow
): ChatMessageAttachment {
  return {
    id: row.id,
    chatMessageId: row.chatMessageId,
    ordinal: row.ordinal,
    kind: row.kind as AttachmentKind,
    telegramFileId: row.telegramFileId,
    mimeType: row.mimeType ?? undefined,
    fileSize: row.fileSize ?? undefined,
    duration: row.duration ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    createdAt: row.createdAt,
  };
}

export function deserializeFundingIntent(row: FundingIntentRow): FundingIntentRecord {
  return {
    id: row.id,
    gardenId: row.gardenId,
    gardenName: row.gardenName,
    gardenLocation: row.gardenLocation ?? undefined,
    destinationType: row.destinationType,
    destinationAddress: row.destinationAddress,
    fundingIntent: row.fundingIntent,
    paymentMethod: row.paymentMethod,
    availabilityKey: row.availabilityKey,
    clientRequestId: row.clientRequestId,
    idempotencyFingerprint: row.idempotencyFingerprint,
    amountUsd: row.amountUsd,
    chainId: row.chainId,
    token: row.token,
    provider: row.provider,
    providerSessionId: row.providerSessionId ?? undefined,
    providerPaymentId: row.providerPaymentId ?? undefined,
    status: row.status,
    payerEmailHash: row.payerEmailHash ?? undefined,
    receiptTokenHash: row.receiptTokenHash,
    quoteExpiresAt: row.quoteExpiresAt,
    checkoutExpiresAt: row.checkoutExpiresAt ?? undefined,
    receiverAddress: row.receiverAddress ?? undefined,
    sourceRoute: row.sourceRoute ?? undefined,
    managementUrl: row.managementUrl ?? undefined,
    quotedAssetAmount: row.quotedAssetAmount ?? undefined,
    minAssetAmount: row.minAssetAmount ?? undefined,
    fundedAssetAmount: row.fundedAssetAmount ?? undefined,
    fundingTxHash: row.fundingTxHash ?? undefined,
    failureCode: row.failureCode ?? undefined,
    checkoutSession: row.checkoutSession ? JSON.parse(row.checkoutSession) : undefined,
    transactionAttempts: JSON.parse(row.transactionAttempts),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
