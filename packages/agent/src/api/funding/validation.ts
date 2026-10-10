import {
  type CreateFundingIntentRequest,
  type PublicApiError,
  type SubmitFundingIntentProofRequest,
} from "@green-goods/shared/public-contracts";
import { normalizeDecimalString } from "../../services/funding-intents";
import { safeError } from "../http/responses";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_RE = /^0x[a-fA-F0-9]+$/;

export function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

export function parseBaseUnitAmount(value: string | undefined): bigint | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return BigInt(value);
}

export function normalizeAddress(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

export function validateFundingIntentRequest(
  body: unknown
): CreateFundingIntentRequest | PublicApiError {
  const candidate = body as Partial<CreateFundingIntentRequest> | undefined;
  if (!candidate || typeof candidate !== "object") {
    return safeError("invalid_request", "Invalid request body.");
  }
  if (
    typeof candidate.gardenId !== "string" ||
    typeof candidate.destinationType !== "string" ||
    typeof candidate.destinationAddress !== "string" ||
    typeof candidate.fundingIntent !== "string" ||
    typeof candidate.paymentMethod !== "string" ||
    typeof candidate.amountUsd !== "string" ||
    typeof candidate.token !== "string" ||
    typeof candidate.availabilityKey !== "string" ||
    typeof candidate.clientRequestId !== "string" ||
    typeof candidate.chainId !== "number"
  ) {
    return safeError("invalid_request", "Required funding fields are missing.", {
      fieldErrors: { request: "Required funding fields are missing" },
    });
  }
  if (candidate.paymentMethod !== "card") {
    return safeError("unsupported_payment_method", "Only card funding intents are supported here.");
  }
  if (candidate.destinationType !== "cookieJar" && candidate.destinationType !== "vault") {
    return safeError("invalid_request", "Invalid destination type.");
  }
  if (candidate.fundingIntent !== "donate" && candidate.fundingIntent !== "endow") {
    return safeError("invalid_request", "Invalid funding intent.");
  }
  if (candidate.fundingIntent === "donate" && candidate.destinationType !== "cookieJar") {
    return safeError("invalid_request", "Donate card intents must target a Cookie Jar.");
  }
  if (candidate.fundingIntent === "endow" && candidate.destinationType !== "vault") {
    return safeError("invalid_request", "Endow card intents must target a Vault.");
  }
  if (!isAddress(candidate.destinationAddress)) {
    return safeError("invalid_request", "Invalid destination address.", {
      fieldErrors: { destinationAddress: "Invalid address" },
    });
  }
  if (!isAddress(candidate.token)) {
    return safeError("invalid_request", "Invalid token address.", {
      fieldErrors: { token: "Invalid address" },
    });
  }
  if (candidate.receiverAddress !== undefined && !isAddress(candidate.receiverAddress)) {
    return safeError("invalid_request", "Invalid receiver address.", {
      fieldErrors: { receiverAddress: "Invalid address" },
    });
  }
  if (candidate.fundingIntent === "endow" && !candidate.receiverAddress) {
    return safeError("invalid_request", "Card Endow requires a recovered receiver wallet.", {
      fieldErrors: { receiverAddress: "Receiver wallet is required for Card Endow" },
    });
  }
  if (
    candidate.sourceRoute !== undefined &&
    candidate.sourceRoute !== "/fund" &&
    candidate.sourceRoute !== "/vaults"
  ) {
    return safeError("invalid_request", "Invalid funding source route.", {
      fieldErrors: { sourceRoute: "Invalid source route" },
    });
  }
  if (candidate.sourceRoute === "/vaults" && candidate.destinationType !== "vault") {
    return safeError("invalid_request", "Vault route funding must target a Vault.", {
      fieldErrors: { sourceRoute: "Vault route funding must target a Vault" },
    });
  }
  const amountUsd = normalizeDecimalString(candidate.amountUsd);
  if (!amountUsd) {
    return safeError("invalid_request", "Invalid amount.", {
      fieldErrors: { amountUsd: "Use a positive decimal amount" },
    });
  }
  if (Number(amountUsd) <= 0) {
    return safeError("amount_below_min", "Amount is below the minimum.", {
      fieldErrors: { amountUsd: "Amount must be greater than zero" },
      params: { minAmount: "0.01" },
    });
  }
  return {
    gardenId: candidate.gardenId,
    destinationType: candidate.destinationType,
    destinationAddress: candidate.destinationAddress,
    fundingIntent: candidate.fundingIntent,
    paymentMethod: "card",
    amountUsd,
    chainId: candidate.chainId,
    token: candidate.token,
    availabilityKey: candidate.availabilityKey,
    clientRequestId: candidate.clientRequestId,
    receiverAddress: candidate.receiverAddress,
    sourceRoute: candidate.sourceRoute,
    payerEmail: candidate.payerEmail,
    locale: candidate.locale,
  };
}

export function validateFundingIntentProofRequest(
  body: unknown
): SubmitFundingIntentProofRequest | PublicApiError {
  const candidate = body as Partial<SubmitFundingIntentProofRequest> | undefined;
  if (!candidate || typeof candidate !== "object") {
    return safeError("invalid_request", "Invalid request body.");
  }
  if (
    typeof candidate.gardenId !== "string" ||
    typeof candidate.destinationType !== "string" ||
    typeof candidate.destinationAddress !== "string" ||
    typeof candidate.fundingIntent !== "string" ||
    typeof candidate.paymentMethod !== "string" ||
    typeof candidate.provider !== "string" ||
    typeof candidate.sourceRoute !== "string" ||
    typeof candidate.chainId !== "number" ||
    typeof candidate.token !== "string" ||
    typeof candidate.availabilityKey !== "string" ||
    typeof candidate.clientRequestId !== "string" ||
    typeof candidate.receiverAddress !== "string" ||
    typeof candidate.receiverCustody !== "string" ||
    typeof candidate.amount !== "string" ||
    typeof candidate.transactionHash !== "string" ||
    typeof candidate.shareBalance !== "string"
  ) {
    return safeError("invalid_request", "Required funding proof fields are missing.", {
      fieldErrors: { request: "Required funding proof fields are missing" },
    });
  }
  if (
    candidate.destinationType !== "vault" ||
    candidate.fundingIntent !== "endow" ||
    candidate.paymentMethod !== "card" ||
    candidate.provider !== "thirdweb" ||
    candidate.sourceRoute !== "/vaults"
  ) {
    return safeError("invalid_request", "Invalid Card Endow proof tuple.", {
      fieldErrors: { request: "Card Endow proof must target /vaults thirdweb card Endow" },
    });
  }
  if (!isAddress(candidate.destinationAddress)) {
    return safeError("invalid_request", "Invalid destination address.", {
      fieldErrors: { destinationAddress: "Invalid address" },
    });
  }
  if (!isAddress(candidate.token)) {
    return safeError("invalid_request", "Invalid token address.", {
      fieldErrors: { token: "Invalid address" },
    });
  }
  if (!isAddress(candidate.receiverAddress)) {
    return safeError("invalid_request", "Invalid receiver address.", {
      fieldErrors: { receiverAddress: "Invalid address" },
    });
  }
  if (candidate.receiverCustody !== "user_owned_recovered_wallet") {
    return safeError("invalid_request", "Invalid receiver custody.", {
      fieldErrors: { receiverCustody: "Card Endow requires a recovered receiver wallet" },
    });
  }
  if (!HEX_RE.test(candidate.transactionHash)) {
    return safeError("invalid_request", "Invalid transaction hash.", {
      fieldErrors: { transactionHash: "Invalid transaction hash" },
    });
  }
  const amount = parseBaseUnitAmount(candidate.amount);
  if (amount === undefined || amount <= 0n) {
    return safeError("invalid_request", "Invalid funded amount.", {
      fieldErrors: { amount: "Card Endow proof requires a positive funded amount" },
    });
  }
  const shareBalance = parseBaseUnitAmount(candidate.shareBalance);
  if (shareBalance === undefined || shareBalance <= 0n) {
    return safeError("invalid_request", "Card Endow proof requires positive vault shares.", {
      fieldErrors: { shareBalance: "Card Endow proof requires positive vault shares" },
    });
  }
  const locale =
    candidate.locale === "en" || candidate.locale === "es" || candidate.locale === "pt"
      ? candidate.locale
      : undefined;
  return {
    gardenId: candidate.gardenId.trim(),
    gardenName: candidate.gardenName?.trim() || undefined,
    destinationType: "vault",
    destinationAddress: candidate.destinationAddress,
    fundingIntent: "endow",
    paymentMethod: "card",
    provider: "thirdweb",
    sourceRoute: "/vaults",
    chainId: candidate.chainId,
    token: candidate.token,
    availabilityKey: candidate.availabilityKey,
    clientRequestId: candidate.clientRequestId.trim(),
    receiverAddress: candidate.receiverAddress,
    receiverCustody: "user_owned_recovered_wallet",
    amount: amount.toString(),
    transactionHash: candidate.transactionHash as `0x${string}`,
    shareBalance: shareBalance.toString(),
    payerEmail: candidate.payerEmail,
    locale,
  };
}
