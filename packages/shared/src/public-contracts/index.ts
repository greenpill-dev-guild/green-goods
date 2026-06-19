// Framework-free public route, state, and validation contracts for the browser read side.
// This subpath must stay dependency-light: no UI frameworks, browser globals, styles,
// providers, hooks, or package-root imports.

export {
  PUBLIC_UPLOAD_SIGN_ALLOWED_CATEGORIES,
  validatePublicUploadSignRequest,
} from "./upload-signing";
export type {
  PublicUploadSignValidationConfig,
  PublicUploadSignValidationResult,
} from "./upload-signing";

export type PublicLocale = "en" | "es" | "pt";
export type Address = `0x${string}`;

export type PublicApiErrorCode =
  | "invalid_request"
  | "invalid_email"
  | "consent_required"
  | "already_expired"
  | "not_found"
  | "receipt_token_required"
  | "receipt_token_invalid"
  | "rate_limited"
  | "origin_not_allowed"
  | "provider_unavailable"
  | "funding_unavailable"
  | "idempotency_conflict"
  | "amount_below_min"
  | "amount_above_max"
  | "unsupported_payment_method"
  | "internal_error";

export type PublicApiError = {
  ok: false;
  errorCode: PublicApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
};

export type PublicSubscribeRequest = {
  email: string;
  consent: true;
  locale?: PublicLocale;
  source?: "homepage_get_in_touch" | "fund_receipt" | "footer" | "unknown";
};

export type PublicSubscribeResponse =
  | { ok: true; status: "subscribed" | "already_subscribed" }
  | PublicApiError;

export type PublicUploadSignCategory = "file_upload" | "json_upload";

export type PublicUploadSignRequest = {
  filename: string;
  mimeType: string;
  size: number;
  source?: string;
  category?: PublicUploadSignCategory;
  gardenAddress?: string;
};

export type PublicUploadSignResponse =
  | {
      ok: true;
      url: string;
      expiresAt: number;
      maxFileSize: number;
      allowedMimeTypes: string[];
    }
  | PublicApiError;

export type FundingIntentStatus =
  | "started"
  | "pending_provider"
  | "pending_onchain"
  | "funded"
  | "failed"
  | "expired"
  | "funded_late"
  | "refunded";

export type FundingDestinationType = "cookieJar" | "vault";
export type PublicFundingIntentKind = "donate" | "endow";
export type PublicPaymentMethod = "card" | "wallet";
export type PublicFundingProvider = "thirdweb";

export type CreateFundingIntentRequest = {
  gardenId: string;
  destinationType: FundingDestinationType;
  destinationAddress: Address;
  fundingIntent: PublicFundingIntentKind;
  paymentMethod: "card";
  amountUsd: string;
  chainId: number;
  token: Address;
  availabilityKey: string;
  clientRequestId: string;
  payerEmail?: string;
  locale?: PublicLocale;
};

export type ClientCheckoutTransaction = {
  to: Address;
  data?: `0x${string}`;
  value?: string;
};

export type ClientCheckoutPayload = {
  provider: "thirdweb";
  clientId: string;
  chainId: number;
  destinationAddress: Address;
  receiverAddress?: Address;
  token: Address;
  amountUsd: string;
  minAssetAmount?: string;
  transaction: ClientCheckoutTransaction;
  metadata: {
    gardenId: string;
    destinationType: FundingDestinationType;
    fundingIntent: PublicFundingIntentKind;
  };
};

export type ClientCheckoutSession = {
  provider: "thirdweb";
  mode: "hosted" | "widget";
  expiresAt: string;
  checkoutUrl?: string;
  clientToken?: string;
  checkoutPayload?: ClientCheckoutPayload;
};

export type PublicFundingReceipt = {
  id: string;
  status: FundingIntentStatus;
  garden: { id: string; name: string; location?: string };
  destination: { type: FundingDestinationType; address: Address };
  fundingIntent: PublicFundingIntentKind;
  amount: {
    amountUsd: string;
    token: Address;
    chainId: number;
    quotedAssetAmount?: string;
    minAssetAmount?: string;
    fundedAssetAmount?: string;
  };
  fundingTxHash?: string;
  receiverAddress?: Address;
  quoteExpiresAt?: string;
  updatedAt: string;
  appManagementCta?: "install_app" | "open_app" | "manage_endowments";
  managementUrl?: "/fund?manage=endowments";
  failureCode?: "expired" | "provider_failed" | "onchain_failed" | "reconciliation_failed";
};

export type CreateFundingIntentResponse =
  | {
      ok: true;
      id: string;
      status: FundingIntentStatus;
      provider: "thirdweb";
      checkoutSession?: ClientCheckoutSession;
      quoteExpiresAt: string;
      receiptToken: string;
      receiptUrl: `/fund?intent=${string}#receiptToken=${string}`;
      publicReceipt: PublicFundingReceipt;
    }
  | PublicApiError;

export type ReadFundingIntentReceiptRequest = {
  id: string;
  headers: { "X-GG-Receipt-Token": string };
};

export type ReadFundingIntentReceiptResponse =
  | { ok: true; publicReceipt: PublicFundingReceipt }
  | PublicApiError;

export type FundingTransactionRole =
  | "allowance_reset"
  | "approval"
  | "funding"
  | "share_verification";
export type FundingTransactionStatus =
  | "expected"
  | "submitted"
  | "confirmed"
  | "failed"
  | "skipped";
export type FundingTransactionAttempt = {
  role: FundingTransactionRole;
  status: FundingTransactionStatus;
  txHash?: string;
  chainId: number;
  token?: Address;
  destinationAddress?: Address;
  receiverAddress?: Address;
  amount?: string;
  providerEventId?: string;
  submittedAt?: string;
  confirmedAt?: string;
  failureCode?: string;
};

export type ThirdwebNormalizedFundingEvent = {
  provider: "thirdweb";
  providerEventId: string;
  providerSessionId?: string;
  providerPaymentId?: string;
  fundingIntentId?: string;
  eventType:
    | "session_created"
    | "payment_submitted"
    | "transaction_submitted"
    | "failed"
    | "refunded";
  txRole?: FundingTransactionRole;
  txHash?: string;
  chainId?: number;
  destinationAddress?: Address;
  receiverAddress?: Address;
  token?: Address;
  destinationAmount?: string;
  occurredAt: string;
};

export const PUBLIC_AGENT_ROUTES = {
  subscribe: "/public/subscribe",
  fundingIntents: "/public/funding-intents",
  fundingIntentReceipt: "/public/funding-intents/:id",
  uploadSign: "/api/uploads/sign",
  thirdwebWebhook: "/webhooks/thirdweb",
} as const;

export type PublicFundingAvailabilityState = "live" | "comingSoon" | "hidden" | "disabled";
export type PublicFundingAvailabilityReasonCode =
  | "no_destination"
  | "proof_pending"
  | "provider_unavailable"
  | "chain_unsupported"
  | "token_unsupported"
  | "config_missing"
  | "disabled";

export type PublicFundingAvailabilityKeyInput = {
  gardenKey: string;
  destinationType: FundingDestinationType;
  destinationAddress: Address | string;
  fundingIntent: PublicFundingIntentKind;
  paymentMethod: PublicPaymentMethod;
  chainId: number | string;
  token: Address | string;
  provider: PublicFundingProvider;
};

export type PublicFundingAvailability = PublicFundingAvailabilityKeyInput & {
  availabilityKey: string;
  state: PublicFundingAvailabilityState;
  reasonCode?: PublicFundingAvailabilityReasonCode;
  reasonParams?: Record<string, string | number | boolean>;
  minAmount?: string;
  maxAmount?: string;
  requiredProof?: string;
  proofReference?: string;
};

export const PUBLIC_FUNDING_AVAILABILITY_REASON_SEMANTICS = {
  no_destination: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["destinationType"],
  },
  proof_pending: {
    allowedStates: ["hidden", "comingSoon"],
    requiredParams: ["provider", "requiredProof"],
  },
  provider_unavailable: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["provider"],
  },
  chain_unsupported: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["chainId"],
  },
  token_unsupported: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["token", "chainId"],
  },
  config_missing: {
    allowedStates: ["hidden", "disabled"],
    requiredParams: ["missingConfig"],
  },
  disabled: {
    allowedStates: ["disabled"],
    requiredParams: [],
  },
} as const satisfies Record<
  PublicFundingAvailabilityReasonCode,
  { allowedStates: readonly PublicFundingAvailabilityState[]; requiredParams: readonly string[] }
>;

export type ProviderProofState = "hidden" | "comingSoon" | "live";
export type ProviderProofEntry = PublicFundingAvailabilityKeyInput & {
  state: ProviderProofState;
  proofReference?: string;
  requiredProof?: string;
  note?: string;
};

export const normalizeAddressLike = (value: string): string => value.trim().toLowerCase();

export function buildPublicFundingAvailabilityKey(
  input: PublicFundingAvailabilityKeyInput
): string {
  const gardenKey = input.gardenKey.trim().toLowerCase();
  const destinationAddress = normalizeAddressLike(input.destinationAddress);
  const chainId = String(input.chainId).trim();
  const token = normalizeAddressLike(input.token);
  return [
    "v1",
    gardenKey,
    input.destinationType,
    destinationAddress,
    input.fundingIntent,
    input.paymentMethod,
    chainId,
    token,
    input.provider,
  ].join(":");
}

export function validateProviderProofEntry(entry: ProviderProofEntry): string[] {
  const errors: string[] = [];
  if (entry.state === "live" && !entry.proofReference?.trim()) {
    errors.push("live provider proof entries require proofReference");
  }
  return errors;
}

export function createProviderProofRegistry(entries: readonly ProviderProofEntry[] = []) {
  const byKey = new Map<string, ProviderProofEntry>();

  for (const entry of entries) {
    const errors = validateProviderProofEntry(entry);
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
    byKey.set(buildPublicFundingAvailabilityKey(entry), entry);
  }

  return {
    get(input: PublicFundingAvailabilityKeyInput): ProviderProofEntry | undefined {
      return byKey.get(buildPublicFundingAvailabilityKey(input));
    },
    resolve(input: PublicFundingAvailabilityKeyInput): PublicFundingAvailability {
      const availabilityKey = buildPublicFundingAvailabilityKey(input);
      const entry = byKey.get(availabilityKey);
      return {
        ...input,
        availabilityKey,
        state: entry?.state ?? "hidden",
        requiredProof: entry?.requiredProof,
        proofReference: entry?.proofReference,
      };
    },
  };
}
