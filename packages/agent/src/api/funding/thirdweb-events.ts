import type { ThirdwebNormalizedFundingEvent } from "@green-goods/shared/public-contracts";
import { isAddress } from "./validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function normalizeThirdwebEvent(
  payload: unknown
): ThirdwebNormalizedFundingEvent | undefined {
  const data = payload as Record<string, unknown>;
  const bridgeData = isRecord(data.data) ? data.data : undefined;
  if (bridgeData && data.type === "pay.onchain-transaction") {
    const purchaseData = isRecord(bridgeData.purchaseData) ? bridgeData.purchaseData : {};
    const destinationToken = isRecord(bridgeData.destinationToken)
      ? bridgeData.destinationToken
      : {};
    const transactions = Array.isArray(bridgeData.transactions) ? bridgeData.transactions : [];
    const chainId =
      typeof destinationToken.chainId === "number" ? destinationToken.chainId : undefined;
    const transaction = transactions.find(
      (candidate) =>
        isRecord(candidate) &&
        (chainId === undefined || candidate.chainId === chainId) &&
        typeof candidate.transactionHash === "string"
    ) as Record<string, unknown> | undefined;
    const status = typeof bridgeData.status === "string" ? bridgeData.status : undefined;
    const eventType: ThirdwebNormalizedFundingEvent["eventType"] =
      status === "COMPLETED"
        ? "transaction_submitted"
        : status === "FAILED" || status === "CANCELLED"
          ? "failed"
          : "payment_submitted";
    const providerEventId =
      stringValue(data.id) ??
      stringValue(bridgeData.transactionId) ??
      stringValue(bridgeData.paymentId);
    if (!providerEventId) return undefined;
    return {
      provider: "thirdweb",
      providerEventId,
      providerSessionId: stringValue(bridgeData.paymentId),
      providerPaymentId: stringValue(bridgeData.paymentId),
      fundingIntentId: stringValue(purchaseData.fundingIntentId),
      destinationType:
        purchaseData.destinationType === "cookieJar" || purchaseData.destinationType === "vault"
          ? purchaseData.destinationType
          : undefined,
      fundingIntent:
        purchaseData.fundingIntent === "donate" || purchaseData.fundingIntent === "endow"
          ? purchaseData.fundingIntent
          : undefined,
      paymentMethod:
        purchaseData.paymentMethod === "card" || purchaseData.paymentMethod === "wallet"
          ? purchaseData.paymentMethod
          : undefined,
      sourceRoute:
        purchaseData.sourceRoute === "/fund" || purchaseData.sourceRoute === "/vaults"
          ? purchaseData.sourceRoute
          : undefined,
      eventType,
      txRole:
        typeof purchaseData.txRole === "string"
          ? (purchaseData.txRole as ThirdwebNormalizedFundingEvent["txRole"])
          : undefined,
      txHash: stringValue(transaction?.transactionHash),
      chainId,
      destinationAddress:
        typeof purchaseData.destinationAddress === "string" &&
        isAddress(purchaseData.destinationAddress)
          ? purchaseData.destinationAddress
          : typeof bridgeData.receiver === "string" && isAddress(bridgeData.receiver)
            ? bridgeData.receiver
            : undefined,
      receiverAddress:
        typeof purchaseData.receiverAddress === "string" && isAddress(purchaseData.receiverAddress)
          ? purchaseData.receiverAddress
          : undefined,
      token:
        typeof destinationToken.address === "string" && isAddress(destinationToken.address)
          ? destinationToken.address
          : undefined,
      destinationAmount: stringValue(bridgeData.destinationAmount),
      occurredAt: String(bridgeData.updatedAt ?? bridgeData.createdAt ?? new Date().toISOString()),
    };
  }
  const providerEventId = data.id ?? data.eventId ?? data.providerEventId;
  const eventType = data.eventType ?? data.type;
  const occurredAt = data.occurredAt ?? data.createdAt ?? new Date().toISOString();
  if (typeof providerEventId !== "string" || typeof eventType !== "string") return undefined;
  const allowedEvents = new Set<ThirdwebNormalizedFundingEvent["eventType"]>([
    "session_created",
    "payment_submitted",
    "transaction_submitted",
    "failed",
    "refunded",
  ]);
  if (!allowedEvents.has(eventType as ThirdwebNormalizedFundingEvent["eventType"]))
    return undefined;
  return {
    provider: "thirdweb",
    providerEventId,
    providerSessionId:
      typeof data.providerSessionId === "string" ? data.providerSessionId : undefined,
    providerPaymentId:
      typeof data.providerPaymentId === "string" ? data.providerPaymentId : undefined,
    fundingIntentId: typeof data.fundingIntentId === "string" ? data.fundingIntentId : undefined,
    destinationType:
      data.destinationType === "cookieJar" || data.destinationType === "vault"
        ? data.destinationType
        : undefined,
    fundingIntent:
      data.fundingIntent === "donate" || data.fundingIntent === "endow"
        ? data.fundingIntent
        : undefined,
    paymentMethod:
      data.paymentMethod === "card" || data.paymentMethod === "wallet"
        ? data.paymentMethod
        : undefined,
    sourceRoute:
      data.sourceRoute === "/fund" || data.sourceRoute === "/vaults" ? data.sourceRoute : undefined,
    eventType: eventType as ThirdwebNormalizedFundingEvent["eventType"],
    txRole:
      typeof data.txRole === "string"
        ? (data.txRole as ThirdwebNormalizedFundingEvent["txRole"])
        : undefined,
    txHash: typeof data.txHash === "string" ? data.txHash : undefined,
    chainId: typeof data.chainId === "number" ? data.chainId : undefined,
    destinationAddress:
      typeof data.destinationAddress === "string" && isAddress(data.destinationAddress)
        ? data.destinationAddress
        : undefined,
    receiverAddress:
      typeof data.receiverAddress === "string" && isAddress(data.receiverAddress)
        ? data.receiverAddress
        : undefined,
    token: typeof data.token === "string" && isAddress(data.token) ? data.token : undefined,
    destinationAmount:
      typeof data.destinationAmount === "string" ? data.destinationAmount : undefined,
    occurredAt: String(occurredAt),
  };
}
