// Dependency-light public route contracts: no UI frameworks, browser globals, or package-root imports.

import { derivePublicGardenSlug } from "./garden-slug";

export { derivePublicGardenSlug } from "./garden-slug";
export {
  createPublicImpactSlice,
  PUBLIC_IMPACT_DEFAULT_PAGE_SIZE,
  PUBLIC_IMPACT_GARDEN_FETCH_CAP,
  PUBLIC_IMPACT_RECORD_FETCH_CAP,
  type PublicImpactEvidenceKind,
  type PublicImpactEvidenceRecord,
  type PublicImpactGardenSource,
  type PublicImpactSlice,
} from "./public-impact";
export { PUBLIC_AGENT_ROUTES } from "./routes";

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
  | "luma_import_failed"
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

export * from "./saved-offers";

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
export type PublicFundingSourceRoute = "/fund" | "/vaults";
export type PublicFundingManagementUrl = "/fund?manage=endowments" | "/vaults?manage=positions";

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
  /** Required for Card Endow so vault shares land in the recovered wallet owner. */
  receiverAddress?: Address;
  /** Public route that created the receipt. Defaults to /fund for compatibility. */
  sourceRoute?: PublicFundingSourceRoute;
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
    sourceRoute?: PublicFundingSourceRoute;
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
  managementUrl?: PublicFundingManagementUrl;
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
      receiptUrl: `${PublicFundingSourceRoute}?intent=${string}#receiptToken=${string}`;
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

export type SubmitFundingIntentProofRequest = {
  gardenId: string;
  gardenName?: string;
  destinationType: "vault";
  destinationAddress: Address;
  fundingIntent: "endow";
  paymentMethod: "card";
  provider: "thirdweb";
  sourceRoute: "/vaults";
  chainId: number;
  token: Address;
  availabilityKey: string;
  clientRequestId: string;
  receiverAddress: Address;
  receiverCustody: "user_owned_recovered_wallet";
  amount: string;
  transactionHash: `0x${string}`;
  shareBalance: string;
  payerEmail?: string;
  locale?: PublicLocale;
};

export type SubmitFundingIntentProofResponse =
  | {
      ok: true;
      id: string;
      status: "funded" | "funded_late";
      provider: "thirdweb";
      receiptToken: string;
      receiptUrl: `${PublicFundingSourceRoute}?intent=${string}#receiptToken=${string}`;
      publicReceipt: PublicFundingReceipt;
    }
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
  destinationType?: FundingDestinationType;
  fundingIntent?: PublicFundingIntentKind;
  paymentMethod?: PublicPaymentMethod;
  sourceRoute?: PublicFundingSourceRoute;
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
  sourceRoute?: PublicFundingSourceRoute;
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
  if (input.sourceRoute) {
    return [
      "v2",
      input.sourceRoute,
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
      if (!entry || entry.state === "hidden") {
        return {
          ...input,
          availabilityKey,
          state: "hidden",
          reasonCode: "proof_pending",
          reasonParams: { provider: input.provider, requiredProof: "provider_execution" },
          requiredProof: "provider_execution",
        };
      }
      if (entry.state === "comingSoon") {
        return {
          ...input,
          availabilityKey,
          state: "comingSoon",
          reasonCode: "proof_pending",
          reasonParams: {
            provider: input.provider,
            requiredProof: entry.requiredProof ?? "provider_execution",
          },
          requiredProof: entry.requiredProof ?? "provider_execution",
          proofReference: entry.proofReference,
        };
      }
      return {
        ...input,
        availabilityKey,
        state: "live",
        proofReference: entry.proofReference,
      };
    },
    entries(): ProviderProofEntry[] {
      return [...byKey.values()];
    },
  };
}

const GREENPILL_NYC_OCTANT_VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as const;
const EVMAVERICKS_OCTANT_VAULT = "0x0bCe8c16974FFD3B410A32365c5bCf27a5A630Fc" as const;
const ETHEREUM_WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;

/**
 * Live entries must stay in lockstep with the client Card Endow allowlist
 * (`CARD_ENDOW_PRODUCTION_CAMPAIGN_SLUGS` in the /vaults checkout): every
 * campaign the client exposes for Card Endow needs a matching live entry here,
 * or the agent proof route rejects the receipt AFTER value moved.
 */
export const PUBLIC_PROVIDER_PROOF_ENTRIES: readonly ProviderProofEntry[] = [
  {
    gardenKey: "greenpill-nyc",
    destinationType: "vault",
    destinationAddress: GREENPILL_NYC_OCTANT_VAULT,
    fundingIntent: "endow",
    paymentMethod: "card",
    chainId: 1,
    token: ETHEREUM_WETH,
    provider: "thirdweb",
    sourceRoute: "/vaults",
    state: "live",
    proofReference: "production:greenpill-nyc-card-endow-proof-route-2026-06-03",
  },
  {
    gardenKey: "evmavericks",
    destinationType: "vault",
    destinationAddress: EVMAVERICKS_OCTANT_VAULT,
    fundingIntent: "endow",
    paymentMethod: "card",
    chainId: 1,
    token: ETHEREUM_WETH,
    provider: "thirdweb",
    sourceRoute: "/vaults",
    state: "live",
    proofReference: "production:evmavericks-card-endow-proof-route-2026-06-12",
  },
];
export const publicProviderProofRegistry = createProviderProofRegistry(
  PUBLIC_PROVIDER_PROOF_ENTRIES
);

export type PublicGardenLookupItem = {
  id: string;
  address?: string;
  name?: string;
  location?: string;
};

export type FundGardenResolution =
  | { status: "normal" }
  | {
      status: "matched";
      matchType: "exact" | "slug";
      garden: PublicGardenLookupItem;
      spotlightGardenId: string;
    }
  | {
      status: "fallback";
      reason: "not_found" | "ambiguous_slug";
      messageId: "public.fund.garden.notFound" | "public.fund.garden.ambiguous";
      query: string;
    };

export function resolveFundGardenReference(
  reference: string | undefined,
  gardens: readonly PublicGardenLookupItem[]
): FundGardenResolution {
  const query = reference?.trim().toLowerCase() ?? "";
  if (!query) return { status: "normal" };

  const exact = gardens.find((garden) => {
    const id = garden.id.trim().toLowerCase();
    const address = garden.address?.trim().toLowerCase();
    return id === query || address === query;
  });
  if (exact) {
    return {
      status: "matched",
      matchType: "exact",
      garden: exact,
      spotlightGardenId: exact.id,
    };
  }

  const slugMatches = gardens.filter((garden) => {
    const key = garden.address ?? garden.id;
    return derivePublicGardenSlug(garden.name, key) === query;
  });

  if (slugMatches.length === 1) {
    const garden = slugMatches[0];
    return {
      status: "matched",
      matchType: "slug",
      garden,
      spotlightGardenId: garden.id,
    };
  }

  if (slugMatches.length > 1) {
    return {
      status: "fallback",
      reason: "ambiguous_slug",
      messageId: "public.fund.garden.ambiguous",
      query,
    };
  }

  return {
    status: "fallback",
    reason: "not_found",
    messageId: "public.fund.garden.notFound",
    query,
  };
}
