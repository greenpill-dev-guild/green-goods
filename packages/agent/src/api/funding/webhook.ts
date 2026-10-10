import type { Context } from "hono";
import { type FundingIntentRecord, transitionFundingStatus } from "../../services/funding-intents";
import { readLimitedTextBody } from "../http/body";
import { checkRateLimit } from "../http/public";
import { safeError } from "../http/responses";
import type { FundingRouteContext } from "./context";
import {
  confirmFundingTupleSafe,
  confirmSubmittedTransaction,
  normalizeThirdwebEvent,
  verifyWebhookSignature,
} from "./thirdweb";
import { normalizeAddress, parseBaseUnitAmount } from "./validation";

const WEBHOOK_BODY_LIMIT_BYTES = 256 * 1024;

export async function handleThirdwebWebhook(c: Context, ctx: FundingRouteContext) {
  const { deps, fundingIntents, now } = ctx;
  const preRateError = checkRateLimit(c, deps, "webhook_pre", "thirdweb");
  if (preRateError) return c.json(preRateError, 429);
  const rawBodyResult = await readLimitedTextBody(c.req.raw, WEBHOOK_BODY_LIMIT_BYTES);
  if (!rawBodyResult.ok) return c.json(rawBodyResult.error, rawBodyResult.status);
  const rawBody = rawBodyResult.text;
  const secret = deps.thirdwebWebhookSecret ?? process.env.THIRDWEB_WEBHOOK_SECRET;
  if (!verifyWebhookSignature(rawBody, c.req.raw.headers, secret, now())) {
    return c.json(safeError("provider_unavailable", "Webhook verification failed."), 401);
  }
  const signature = c.req.header("x-payload-signature") ?? c.req.header("x-pay-signature");
  const postRateError = checkRateLimit(
    c,
    deps,
    "webhook_post",
    c.req.header("x-thirdweb-account") ?? signature ?? "thirdweb"
  );
  if (postRateError) return c.json(postRateError, 429);
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return c.json(safeError("invalid_request", "Invalid webhook event."), 400);
  }
  const event = normalizeThirdwebEvent(payload);
  if (!event) return c.json(safeError("invalid_request", "Invalid webhook event."), 400);
  if (event.fundingIntentId) {
    const intent = await fundingIntents.getById(event.fundingIntentId);
    if (intent) {
      const isFundingTransaction =
        event.eventType === "transaction_submitted" && event.txRole === "funding";
      const strictEventMismatch = isFundingTransaction
        ? getStrictFundingEventMismatch(event, intent)
        : undefined;
      const confirmation =
        event.eventType === "transaction_submitted"
          ? isFundingTransaction
            ? strictEventMismatch
              ? undefined
              : await confirmFundingTupleSafe(ctx, event.txHash, {
                  token: intent.token,
                  destinationAddress: intent.destinationAddress,
                  minAssetAmount: intent.minAssetAmount,
                  chainId: intent.chainId,
                })
            : await confirmSubmittedTransaction(ctx, event.txHash)
          : undefined;
      const isStrictConfirmed =
        !strictEventMismatch && confirmation?.status === "confirmed" && isFundingTransaction;
      const nextStatus = isStrictConfirmed
        ? "funded"
        : strictEventMismatch ||
            confirmation?.status === "failed" ||
            confirmation?.status === "tuple_mismatch"
          ? "failed"
          : event.eventType === "transaction_submitted"
            ? "pending_onchain"
            : event.eventType === "failed"
              ? "failed"
              : event.eventType === "refunded"
                ? "refunded"
                : "pending_provider";
      const failureCode: FundingIntentRecord["failureCode"] = strictEventMismatch
        ? "reconciliation_failed"
        : confirmation?.status === "tuple_mismatch"
          ? "reconciliation_failed"
          : confirmation?.status === "failed"
            ? "onchain_failed"
            : event.eventType === "failed"
              ? "provider_failed"
              : intent.failureCode;
      const matchedAssetAmount =
        confirmation?.status === "confirmed" && "matchedAssetAmount" in confirmation
          ? confirmation.matchedAssetAmount
          : undefined;
      const updated: FundingIntentRecord = {
        ...intent,
        providerSessionId: strictEventMismatch
          ? intent.providerSessionId
          : (event.providerSessionId ?? intent.providerSessionId),
        providerPaymentId: strictEventMismatch
          ? intent.providerPaymentId
          : (event.providerPaymentId ?? intent.providerPaymentId),
        status: transitionFundingStatus(intent.status, nextStatus),
        failureCode,
        fundedAssetAmount: isStrictConfirmed
          ? (matchedAssetAmount ?? event.destinationAmount ?? intent.fundedAssetAmount)
          : intent.fundedAssetAmount,
        fundingTxHash: isStrictConfirmed && event.txHash ? event.txHash : intent.fundingTxHash,
        transactionAttempts:
          event.txHash && event.eventType === "transaction_submitted"
            ? [
                ...intent.transactionAttempts,
                {
                  role: event.txRole ?? "funding",
                  status:
                    confirmation?.status === "confirmed" && !strictEventMismatch
                      ? "confirmed"
                      : strictEventMismatch ||
                          confirmation?.status === "failed" ||
                          confirmation?.status === "tuple_mismatch"
                        ? "failed"
                        : "submitted",
                  txHash: event.txHash,
                  chainId: event.chainId ?? intent.chainId,
                  token: event.token ?? intent.token,
                  destinationAddress: event.destinationAddress ?? intent.destinationAddress,
                  receiverAddress: event.receiverAddress ?? intent.receiverAddress,
                  amount: matchedAssetAmount ?? event.destinationAmount,
                  providerEventId: event.providerEventId,
                  submittedAt: event.occurredAt,
                  confirmedAt:
                    confirmation?.status === "confirmed" ? confirmation.confirmedAt : undefined,
                  failureCode:
                    strictEventMismatch ??
                    (confirmation?.status === "tuple_mismatch"
                      ? confirmation.mismatchReason
                      : confirmation?.status === "failed"
                        ? "onchain_failed"
                        : undefined),
                },
              ]
            : intent.transactionAttempts,
        updatedAt: confirmation?.confirmedAt ?? event.occurredAt,
      };
      await fundingIntents.update(updated);
      await fundingIntents.appendEvent(
        updated.id,
        updated.status,
        event.providerEventId,
        event.providerEventId
      );
    }
  }
  return c.json({ ok: true });
}

function getStrictFundingEventMismatch(
  event: ReturnType<typeof normalizeThirdwebEvent>,
  intent: FundingIntentRecord
): string | undefined {
  if (!event?.txHash) return "missing_tx_hash";
  if (!event.providerSessionId || event.providerSessionId !== intent.providerSessionId)
    return "provider_session_mismatch";
  if (intent.sourceRoute && event.sourceRoute !== intent.sourceRoute)
    return "source_route_mismatch";
  if (event.chainId !== intent.chainId) return "chain_mismatch";
  if (
    (intent.sourceRoute === "/vaults" || intent.fundingIntent === "endow") &&
    event.destinationType !== intent.destinationType
  )
    return "destination_type_mismatch";
  if (
    (intent.sourceRoute === "/vaults" || intent.fundingIntent === "endow") &&
    event.fundingIntent !== intent.fundingIntent
  )
    return "intent_mismatch";
  if (
    (intent.sourceRoute === "/vaults" || intent.fundingIntent === "endow") &&
    event.paymentMethod !== intent.paymentMethod
  )
    return "payment_method_mismatch";
  if (normalizeAddress(event.token) !== normalizeAddress(intent.token)) return "token_mismatch";
  if (normalizeAddress(event.destinationAddress) !== normalizeAddress(intent.destinationAddress))
    return "destination_mismatch";
  if (
    intent.receiverAddress &&
    normalizeAddress(event.receiverAddress) !== normalizeAddress(intent.receiverAddress)
  )
    return "receiver_mismatch";
  const eventAmount = parseBaseUnitAmount(event.destinationAmount);
  const expectedAmount = parseBaseUnitAmount(intent.quotedAssetAmount ?? intent.minAssetAmount);
  if (event.destinationAmount && eventAmount === undefined) return "invalid_destination_amount";
  if (expectedAmount !== undefined && eventAmount === undefined) return "amount_mismatch";
  return eventAmount !== undefined && expectedAmount !== undefined && eventAmount !== expectedAmount
    ? "amount_mismatch"
    : undefined;
}
