import { createHmac, timingSafeEqual } from "node:crypto";
import {
  type ClientCheckoutSession,
  type CreateFundingIntentRequest,
} from "@green-goods/shared/public-contracts";
import {
  confirmFundingTransaction,
  getTransactionConfirmation,
  type FundingConfirmationResult,
  type FundingTupleExpectation,
  type TransactionConfirmation,
} from "../../services/blockchain";
import { loggers } from "../../services/logger";
import { getFundingSourceRoute } from "./records";
import type { FundingRouteContext } from "./routes";
import { parseBaseUnitAmount } from "./validation";

export { normalizeThirdwebEvent } from "./thirdweb-events";

const log = loggers.api;
const HEX_RE = /^0x[a-fA-F0-9]+$/;
const THIRDWEB_WEBHOOK_TOLERANCE_SECONDS = 300;
const DEFAULT_THIRDWEB_API_BASE_URL = "https://api.thirdweb.com";

export interface ThirdwebCheckoutResult {
  providerSessionId: string;
  providerPaymentId?: string;
  checkoutSession: ClientCheckoutSession;
  checkoutExpiresAt?: string;
  receiverAddress?: CreateFundingIntentRequest["destinationAddress"];
  quotedAssetAmount: string;
  minAssetAmount: string;
}

export interface ThirdwebCheckoutClient {
  createSession(input: {
    fundingIntentId: string;
    request: CreateFundingIntentRequest;
    availabilityProofReference?: string;
    quoteExpiresAt: string;
  }): Promise<ThirdwebCheckoutResult>;
}

export interface ThirdwebCheckoutClientConfig {
  clientId?: string;
  secretKey?: string;
  apiBaseUrl?: string;
  fetch?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function getNestedString(record: Record<string, unknown>, key: string): string | undefined {
  return stringValue(record[key]);
}

function getThirdwebDestinationAmount(payload: Record<string, unknown>): string | undefined {
  const direct = stringValue(payload.destinationAmount);
  if (direct) return direct;
  return stringValue((isRecord(payload.token) ? payload.token : undefined)?.amount);
}

export function createThirdwebCheckoutClient(
  config: ThirdwebCheckoutClientConfig
): ThirdwebCheckoutClient | undefined {
  const clientId = config.clientId?.trim();
  const secretKey = config.secretKey?.trim();
  if (!clientId || !secretKey) return undefined;
  const apiBaseUrl = (config.apiBaseUrl ?? DEFAULT_THIRDWEB_API_BASE_URL).replace(/\/+$/, "");
  const doFetch = config.fetch ?? fetch;
  return {
    async createSession({ fundingIntentId, request, availabilityProofReference, quoteExpiresAt }) {
      const sourceRoute = getFundingSourceRoute(request);
      if (request.fundingIntent === "endow") {
        throw new Error("Thirdweb Card Endow requires a contract-call checkout integration");
      }
      const response = await doFetch(`${apiBaseUrl}/v1/bridge/payments`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-secret-key": secretKey },
        body: JSON.stringify({
          name: "Green Goods Card Donate",
          description: "Green Goods public funding checkout",
          recipient: request.destinationAddress,
          token: { address: request.token, chainId: request.chainId, amount: request.amountUsd },
          purchaseData: {
            fundingIntentId,
            availabilityProofReference,
            gardenId: request.gardenId,
            destinationType: request.destinationType,
            destinationAddress: request.destinationAddress,
            fundingIntent: request.fundingIntent,
            paymentMethod: request.paymentMethod,
            chainId: request.chainId,
            token: request.token,
            receiverAddress: request.receiverAddress,
            sourceRoute,
            txRole: "funding",
          },
        }),
      });
      if (!response.ok) throw new Error("Thirdweb checkout session creation failed");
      const payload = (await response.json()) as unknown;
      if (!isRecord(payload)) throw new Error("Thirdweb checkout response was invalid");
      const providerSessionId =
        getNestedString(payload, "id") ?? getNestedString(payload, "paymentId");
      const providerPaymentId = getNestedString(payload, "paymentId") ?? providerSessionId;
      const checkoutUrl =
        getNestedString(payload, "checkoutUrl") ?? getNestedString(payload, "url");
      const quotedAssetAmount = getThirdwebDestinationAmount(payload);
      if (
        !providerSessionId ||
        !quotedAssetAmount ||
        parseBaseUnitAmount(quotedAssetAmount) === undefined
      ) {
        throw new Error("Thirdweb checkout response did not include a strict token amount");
      }
      return {
        providerSessionId,
        providerPaymentId,
        checkoutExpiresAt: quoteExpiresAt,
        receiverAddress: request.receiverAddress,
        quotedAssetAmount,
        minAssetAmount: quotedAssetAmount,
        checkoutSession: {
          provider: "thirdweb",
          mode: checkoutUrl ? "hosted" : "widget",
          expiresAt: quoteExpiresAt,
          checkoutUrl,
          checkoutPayload: {
            provider: "thirdweb",
            clientId,
            chainId: request.chainId,
            destinationAddress: request.destinationAddress,
            receiverAddress: request.receiverAddress,
            token: request.token,
            amountUsd: request.amountUsd,
            minAssetAmount: quotedAssetAmount,
            transaction: { to: request.destinationAddress, data: "0x", value: "0" },
            metadata: {
              gardenId: request.gardenId,
              destinationType: request.destinationType,
              fundingIntent: request.fundingIntent,
              sourceRoute,
            },
          },
        },
      };
    },
  };
}

export function verifyWebhookSignature(
  body: string,
  headers: Headers,
  secret: string | undefined,
  now: number,
  toleranceSeconds = THIRDWEB_WEBHOOK_TOLERANCE_SECONDS
): boolean {
  if (!secret) return false;
  const signature = headers.get("x-payload-signature") ?? headers.get("x-pay-signature");
  const timestamp = headers.get("x-timestamp") ?? headers.get("x-pay-timestamp");
  if (!signature || !timestamp) return false;
  const parsedTimestamp = Number.parseInt(timestamp, 10);
  if (
    !Number.isFinite(parsedTimestamp) ||
    Math.abs(Math.floor(now / 1000) - parsedTimestamp) > toleranceSeconds
  ) {
    return false;
  }
  const normalized = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature;
  if (!HEX_RE.test(`0x${normalized}`)) return false;
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"),
    "hex"
  );
  const actual = Buffer.from(normalized, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function confirmSubmittedTransaction(
  ctx: FundingRouteContext,
  txHash: string | undefined
): Promise<TransactionConfirmation | undefined> {
  if (!txHash) return undefined;
  if (ctx.confirmationDeps.confirmFundingTransaction) {
    return ctx.confirmationDeps.confirmFundingTransaction(txHash);
  }
  try {
    return await getTransactionConfirmation(txHash as `0x${string}`);
  } catch (error) {
    log.warn(
      { txHash, error: error instanceof Error ? error.message : String(error) },
      "Funding transaction confirmation unavailable"
    );
    return { status: "pending", txHash: txHash as `0x${string}` };
  }
}

export async function confirmFundingTupleSafe(
  ctx: FundingRouteContext,
  txHash: string | undefined,
  expected: FundingTupleExpectation
): Promise<FundingConfirmationResult | undefined> {
  if (!txHash) return undefined;
  if (ctx.confirmationDeps.confirmFundingTuple) {
    return ctx.confirmationDeps.confirmFundingTuple(txHash, expected);
  }
  try {
    return await confirmFundingTransaction(txHash as `0x${string}`, expected);
  } catch (error) {
    log.warn(
      { txHash, error: error instanceof Error ? error.message : String(error) },
      "Funding tuple confirmation unavailable"
    );
    return { status: "pending", txHash: txHash as `0x${string}` };
  }
}
