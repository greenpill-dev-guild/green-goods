import {
  buildPublicFundingAvailabilityKey,
  type CreateFundingIntentRequest,
  type PublicFundingManagementUrl,
  type PublicFundingSourceRoute,
  type SubmitFundingIntentProofRequest,
} from "@green-goods/shared/public-contracts";
import type { Context } from "hono";
import {
  createFundingIntentId,
  createReceiptToken,
  hashSecret,
  type FundingIntentRecord,
  normalizeEmailHash,
  redactFundingReceipt,
} from "../../services/funding-intents";
import { loggers } from "../../services/logger";
import { readLimitedJsonBody } from "../http/body";
import { checkOrigin, checkRateLimit, publicBrowserCorsResponse } from "../http/public";
import { isPublicApiError, safeError } from "../http/responses";
import type { FundingRouteContext } from "./routes";
import { validateFundingIntentProofRequest } from "./validation";

const log = loggers.api;

type FundingReceiptUrl = `${PublicFundingSourceRoute}?intent=${string}#receiptToken=${string}`;

export function getFundingSourceRoute(
  request: Pick<CreateFundingIntentRequest, "sourceRoute">
): PublicFundingSourceRoute {
  return request.sourceRoute ?? "/fund";
}

function getEndowManagementUrl(sourceRoute: PublicFundingSourceRoute): PublicFundingManagementUrl {
  return sourceRoute === "/vaults" ? "/vaults?manage=positions" : "/fund?manage=endowments";
}

export function buildFundingReceiptUrl(
  sourceRoute: PublicFundingSourceRoute,
  intentId: string,
  receiptToken: string
): FundingReceiptUrl {
  return `${sourceRoute}?intent=${intentId}#receiptToken=${receiptToken}` as FundingReceiptUrl;
}

export function createFundingIntentRecord(input: {
  id: string;
  request: CreateFundingIntentRequest;
  idempotencyFingerprint: string;
  receiptTokenHash: string;
  checkout: {
    providerSessionId: string;
    providerPaymentId?: string;
    checkoutExpiresAt?: string;
    receiverAddress?: CreateFundingIntentRequest["destinationAddress"];
    quotedAssetAmount: string;
    minAssetAmount: string;
    checkoutSession: FundingIntentRecord["checkoutSession"];
  };
  now: number;
}): FundingIntentRecord {
  const nowIso = new Date(input.now).toISOString();
  const quoteExpiresAt = new Date(input.now + 10 * 60 * 1000).toISOString();
  const sourceRoute = getFundingSourceRoute(input.request);
  return {
    id: input.id,
    gardenId: input.request.gardenId.trim(),
    gardenName: input.request.gardenId.trim(),
    destinationType: input.request.destinationType,
    destinationAddress: input.request.destinationAddress,
    fundingIntent: input.request.fundingIntent,
    paymentMethod: input.request.paymentMethod,
    availabilityKey: input.request.availabilityKey,
    clientRequestId: input.request.clientRequestId.trim(),
    idempotencyFingerprint: input.idempotencyFingerprint,
    amountUsd: input.request.amountUsd,
    chainId: input.request.chainId,
    token: input.request.token,
    provider: "thirdweb",
    providerSessionId: input.checkout.providerSessionId,
    providerPaymentId: input.checkout.providerPaymentId,
    status: "pending_provider",
    payerEmailHash: normalizeEmailHash(input.request.payerEmail),
    receiptTokenHash: input.receiptTokenHash,
    quoteExpiresAt,
    checkoutExpiresAt:
      input.checkout.checkoutExpiresAt ?? input.checkout.checkoutSession?.expiresAt,
    receiverAddress: input.request.receiverAddress ?? input.checkout.receiverAddress,
    sourceRoute,
    managementUrl:
      input.request.fundingIntent === "endow" ? getEndowManagementUrl(sourceRoute) : undefined,
    quotedAssetAmount: input.checkout.quotedAssetAmount,
    minAssetAmount: input.checkout.minAssetAmount,
    checkoutSession: input.checkout.checkoutSession,
    transactionAttempts: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function createFundingProofFingerprint(request: SubmitFundingIntentProofRequest): string {
  return hashSecret(
    [
      request.gardenId.trim().toLowerCase(),
      request.destinationType,
      request.destinationAddress.trim().toLowerCase(),
      request.fundingIntent,
      request.paymentMethod,
      request.provider,
      request.sourceRoute,
      String(request.chainId),
      request.token.trim().toLowerCase(),
      request.availabilityKey,
      request.clientRequestId.trim(),
      request.receiverAddress.trim().toLowerCase(),
      request.receiverCustody,
      request.amount,
      request.transactionHash.trim().toLowerCase(),
      request.shareBalance,
      normalizeEmailHash(request.payerEmail) ?? "",
    ].join("|")
  );
}

export function createFundingIntentProofRecord(input: {
  id: string;
  request: SubmitFundingIntentProofRequest;
  idempotencyFingerprint: string;
  receiptTokenHash: string;
  now: number;
  status?: "funded" | "funded_late";
  matchedAssetAmount?: string;
  verifiedShareBalance: string;
}): FundingIntentRecord {
  const nowIso = new Date(input.now).toISOString();
  const quoteExpiresAt = nowIso;
  return {
    id: input.id,
    gardenId: input.request.gardenId.trim(),
    gardenName: input.request.gardenName ?? input.request.gardenId.trim(),
    destinationType: "vault",
    destinationAddress: input.request.destinationAddress,
    fundingIntent: "endow",
    paymentMethod: "card",
    availabilityKey: input.request.availabilityKey,
    clientRequestId: input.request.clientRequestId.trim(),
    idempotencyFingerprint: input.idempotencyFingerprint,
    amountUsd: "0",
    chainId: input.request.chainId,
    token: input.request.token,
    provider: "thirdweb",
    providerSessionId: `client-side-proof:${input.request.transactionHash.toLowerCase()}`,
    status: input.status ?? "funded",
    payerEmailHash: normalizeEmailHash(input.request.payerEmail),
    receiptTokenHash: input.receiptTokenHash,
    quoteExpiresAt,
    checkoutExpiresAt: quoteExpiresAt,
    receiverAddress: input.request.receiverAddress,
    sourceRoute: "/vaults",
    managementUrl: "/vaults?manage=positions",
    quotedAssetAmount: input.request.amount,
    minAssetAmount: input.request.amount,
    fundedAssetAmount: input.matchedAssetAmount ?? input.request.amount,
    fundingTxHash: input.request.transactionHash,
    transactionAttempts: [
      {
        role: "funding",
        status: "confirmed",
        txHash: input.request.transactionHash,
        chainId: input.request.chainId,
        token: input.request.token,
        destinationAddress: input.request.destinationAddress,
        receiverAddress: input.request.receiverAddress,
        amount: input.matchedAssetAmount ?? input.request.amount,
        confirmedAt: nowIso,
      },
      {
        role: "share_verification",
        status: "confirmed",
        chainId: input.request.chainId,
        destinationAddress: input.request.destinationAddress,
        receiverAddress: input.request.receiverAddress,
        amount: input.verifiedShareBalance,
        confirmedAt: nowIso,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function hasReceiptTokenQuery(request: Request): boolean {
  return new URL(request.url).searchParams.has("receiptToken");
}

export async function hasReceiptTokenBody(request: Request): Promise<boolean> {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length");
  if (!contentLength && !contentType.toLowerCase().includes("application/json")) return false;
  try {
    const body = (await request.clone().json()) as unknown;
    return Boolean(body && typeof body === "object" && "receiptToken" in body);
  } catch {
    return false;
  }
}

export async function handleFundingIntentProof(c: Context, ctx: FundingRouteContext) {
  const { confirmationDeps, deps, fundingIntents, now, providerProofRegistry } = ctx;
  const originError = checkOrigin(c, deps);
  if (originError) return publicBrowserCorsResponse(c, deps, originError, 403);
  const bodyResult = await readLimitedJsonBody<unknown>(c.req.raw);
  if (!bodyResult.ok)
    return publicBrowserCorsResponse(c, deps, bodyResult.error, bodyResult.status);
  const request = validateFundingIntentProofRequest(bodyResult.value);
  if (isPublicApiError(request)) return publicBrowserCorsResponse(c, deps, request, 400);
  const rateError = checkRateLimit(
    c,
    deps,
    "funding_proof",
    [request.gardenId, request.receiverAddress, request.transactionHash].join(":")
  );
  if (rateError) return publicBrowserCorsResponse(c, deps, rateError, 429);
  const availabilityInput = {
    gardenKey: request.gardenId,
    destinationType: request.destinationType,
    destinationAddress: request.destinationAddress,
    fundingIntent: request.fundingIntent,
    paymentMethod: request.paymentMethod,
    chainId: request.chainId,
    token: request.token,
    provider: request.provider,
    sourceRoute: request.sourceRoute,
  };
  const expectedAvailabilityKey = buildPublicFundingAvailabilityKey(availabilityInput);
  const availability = providerProofRegistry.resolve(availabilityInput);
  if (request.availabilityKey !== expectedAvailabilityKey || availability.state !== "live") {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("funding_unavailable", "This funding method is not available yet."),
      409
    );
  }
  if (!confirmationDeps.confirmFundingTuple || !confirmationDeps.readVaultShareBalance) {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("funding_unavailable", "This funding proof is not confirmed yet."),
      409
    );
  }
  const confirmation = await confirmationDeps.confirmFundingTuple(request.transactionHash, {
    token: request.token.toLowerCase(),
    destinationAddress: request.destinationAddress.toLowerCase(),
    minAssetAmount: request.amount,
    chainId: request.chainId,
  });
  if (confirmation.status !== "confirmed") {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("funding_unavailable", "This funding proof is not confirmed yet."),
      409
    );
  }
  let verifiedShareBalance: bigint;
  try {
    verifiedShareBalance = await confirmationDeps.readVaultShareBalance({
      chainId: request.chainId,
      vaultAddress: request.destinationAddress,
      ownerAddress: request.receiverAddress,
    });
  } catch (error) {
    log.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Card Endow proof share balance read failed"
    );
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("funding_unavailable", "This funding proof is not confirmed yet."),
      409
    );
  }
  if (verifiedShareBalance <= 0n) {
    return publicBrowserCorsResponse(
      c,
      deps,
      safeError("funding_unavailable", "This funding proof is not confirmed yet."),
      409
    );
  }
  const idempotencyFingerprint = createFundingProofFingerprint(request);
  const existing = await fundingIntents.getByClientRequestId(request.clientRequestId);
  const receiptToken = createReceiptToken();
  const receiptTokenHash = hashSecret(receiptToken);
  const currentTime = now();
  if (existing) {
    if (existing.idempotencyFingerprint !== idempotencyFingerprint) {
      return publicBrowserCorsResponse(
        c,
        deps,
        safeError("idempotency_conflict", "This client request id was already used."),
        409
      );
    }
    const updated = await fundingIntents.update({
      ...existing,
      receiptTokenHash,
      updatedAt: new Date(currentTime).toISOString(),
    });
    return publicBrowserCorsResponse(c, deps, {
      ok: true,
      id: updated.id,
      status: updated.status === "funded_late" ? "funded_late" : "funded",
      provider: "thirdweb",
      receiptToken,
      receiptUrl: buildFundingReceiptUrl("/vaults", updated.id, receiptToken),
      publicReceipt: redactFundingReceipt(updated),
    });
  }
  const record = createFundingIntentProofRecord({
    id: createFundingIntentId(),
    request,
    idempotencyFingerprint,
    receiptTokenHash,
    now: currentTime,
    matchedAssetAmount: confirmation.matchedAssetAmount,
    verifiedShareBalance: verifiedShareBalance.toString(),
  });
  await fundingIntents.create(record);
  await fundingIntents.appendEvent(
    record.id,
    record.status,
    "client-side Card Endow proof recorded"
  );
  return publicBrowserCorsResponse(c, deps, {
    ok: true,
    id: record.id,
    status: record.status,
    provider: "thirdweb",
    receiptToken,
    receiptUrl: buildFundingReceiptUrl("/vaults", record.id, receiptToken),
    publicReceipt: redactFundingReceipt(record),
  });
}
