// Framework-free public route and state contracts for the browser read side.
// This subpath must stay type/data only: no UI frameworks, browser globals, styles,
// providers, hooks, or package-root imports.

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

export type PublicSubscribeRequest = {
  email: string;
  consent: true;
  locale?: PublicLocale;
  source?: "homepage_get_in_touch" | "fund_receipt" | "footer" | "unknown";
};

export type PublicSubscribeResponse =
  | { ok: true; status: "subscribed" | "already_subscribed" }
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
  appManagementCta?: "install_app" | "open_app";
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

export const PUBLIC_PROVIDER_PROOF_ENTRIES: readonly ProviderProofEntry[] = [];
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

export function derivePublicGardenSlug(name: string | undefined, addressOrId: string): string {
  const fallback = addressOrId.trim().toLowerCase();
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;
  return (
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

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

export const PUBLIC_IMPACT_DEFAULT_PAGE_SIZE = 12;
export const PUBLIC_IMPACT_GARDEN_FETCH_CAP = 50;
export const PUBLIC_IMPACT_RECORD_FETCH_CAP = 100;

export type PublicImpactGardenSource = {
  id: string;
  address?: string;
  name: string;
  location?: string;
  latestActivityAt?: number;
};

export type PublicImpactEvidenceRecord = {
  id: string;
  gardenId: string;
  gardenName: string;
  title: string;
  domain?: string | number;
  summary?: string;
  timeWindow?: { start?: number | null; end?: number | null };
  easUid?: string;
  sourceAvailable: boolean;
  createdAt: number;
};

export type PublicImpactSlice = {
  records: PublicImpactEvidenceRecord[];
  page: number;
  pageSize: number;
  totalFetchedRecords: number;
  partialData: boolean;
  sourceLimitReached: boolean;
  status: "loading" | "empty" | "ready" | "partial" | "error";
  errorCode?: "eas_unavailable";
};

export function createPublicImpactSlice(input: {
  gardens: readonly PublicImpactGardenSource[];
  records: readonly PublicImpactEvidenceRecord[];
  page?: number;
  pageSize?: number;
  easFailed?: boolean;
  partialData?: boolean;
}): PublicImpactSlice {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.max(1, input.pageSize ?? PUBLIC_IMPACT_DEFAULT_PAGE_SIZE);
  const sortedGardens = [...input.gardens].sort((left, right) => {
    const activityDelta = (right.latestActivityAt ?? 0) - (left.latestActivityAt ?? 0);
    if (activityDelta !== 0) return activityDelta;
    return (left.address ?? left.id).localeCompare(right.address ?? right.id);
  });
  const cappedGardenIds = new Set(
    sortedGardens.slice(0, PUBLIC_IMPACT_GARDEN_FETCH_CAP).map((garden) => garden.id)
  );
  const scopedRecords = input.records
    .filter((record) => cappedGardenIds.has(record.gardenId))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, PUBLIC_IMPACT_RECORD_FETCH_CAP);

  const start = (page - 1) * pageSize;
  const pageRecords = scopedRecords.slice(start, start + pageSize);
  const sourceLimitReached =
    input.gardens.length > PUBLIC_IMPACT_GARDEN_FETCH_CAP ||
    input.records.filter((record) => cappedGardenIds.has(record.gardenId)).length >
      PUBLIC_IMPACT_RECORD_FETCH_CAP;
  const partialData = Boolean(input.partialData || sourceLimitReached);

  if (input.easFailed) {
    return {
      records: pageRecords,
      page,
      pageSize,
      totalFetchedRecords: scopedRecords.length,
      partialData: true,
      sourceLimitReached,
      status: "error",
      errorCode: "eas_unavailable",
    };
  }

  return {
    records: pageRecords,
    page,
    pageSize,
    totalFetchedRecords: scopedRecords.length,
    partialData,
    sourceLimitReached,
    status: scopedRecords.length === 0 ? "empty" : partialData ? "partial" : "ready",
  };
}
