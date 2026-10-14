// Dependency-light public funding API types.

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
