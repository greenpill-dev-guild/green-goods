import type { Address } from "./core";
import type {
  GardenJoinProofAction,
  GardenJoinProofEnvelope,
  GardenJoinRequestApiError,
  GardenJoinValidationResult,
} from "./join-requests";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const HEX_PATTERN = /^0x[0-9a-fA-F]+$/;
const NONCE_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const GARDEN_JOIN_PROOF_MAX_AGE_SECONDS = 5 * 60;

function error(
  message: string,
  field?: string,
  errorCode: GardenJoinRequestApiError["errorCode"] = "invalid_request"
): GardenJoinRequestApiError {
  return {
    ok: false,
    errorCode,
    message,
    ...(field ? { fieldErrors: { [field]: message } } : {}),
  };
}

function normalizeAddress(value: unknown): Address | null {
  return typeof value === "string" && ADDRESS_PATTERN.test(value)
    ? (value.toLowerCase() as Address)
    : null;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validateGardenJoinProofEnvelope(
  input: unknown,
  options: {
    nowSeconds?: number;
    expectedAction?: GardenJoinProofAction;
    allowedChainIds?: readonly number[];
    maxAgeSeconds?: number;
    maxFutureSkewSeconds?: number;
  } = {}
): GardenJoinValidationResult<GardenJoinProofEnvelope> {
  const candidate = input as Partial<GardenJoinProofEnvelope> | null;
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, error: error("Join proof is required.") };
  }
  const gardenAddress = normalizeAddress(candidate.gardenAddress);
  const accountAddress = normalizeAddress(candidate.accountAddress);
  if (candidate.version !== 1) return { ok: false, error: error("Unsupported proof version.") };
  if (!isSafeNonNegativeInteger(candidate.chainId) || candidate.chainId === 0) {
    return { ok: false, error: error("Invalid chain ID.", "chainId") };
  }
  if (options.allowedChainIds && !options.allowedChainIds.includes(candidate.chainId)) {
    return { ok: false, error: error("Unsupported chain.", "chainId", "chain_unsupported") };
  }
  if (!gardenAddress)
    return { ok: false, error: error("Invalid garden address.", "gardenAddress") };
  if (!accountAddress)
    return { ok: false, error: error("Invalid account address.", "accountAddress") };
  const actions: GardenJoinProofAction[] = [
    "create",
    "read_self",
    "list",
    "welcome",
    "decline",
    "withdraw",
  ];
  if (!candidate.action || !actions.includes(candidate.action)) {
    return { ok: false, error: error("Invalid proof action.", "action") };
  }
  if (options.expectedAction && candidate.action !== options.expectedAction) {
    return { ok: false, error: error("Proof action does not match this request.", "action") };
  }
  if (typeof candidate.nonce !== "string" || !NONCE_PATTERN.test(candidate.nonce)) {
    return { ok: false, error: error("Invalid proof nonce.", "nonce") };
  }
  if (typeof candidate.signature !== "string" || !HEX_PATTERN.test(candidate.signature)) {
    return { ok: false, error: error("A hexadecimal signature is required.", "signature") };
  }
  if (
    !isSafeNonNegativeInteger(candidate.issuedAt) ||
    !isSafeNonNegativeInteger(candidate.expiresAt)
  ) {
    return { ok: false, error: error("Invalid proof timestamps.") };
  }
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? GARDEN_JOIN_PROOF_MAX_AGE_SECONDS;
  const futureSkew = options.maxFutureSkewSeconds ?? 30;
  if (
    candidate.expiresAt < now ||
    candidate.issuedAt > now + futureSkew ||
    candidate.expiresAt <= candidate.issuedAt ||
    candidate.expiresAt - candidate.issuedAt > maxAge ||
    now - candidate.issuedAt > maxAge
  ) {
    return {
      ok: false,
      error: error("Join proof has expired.", "expiresAt", "signature_expired"),
    };
  }
  const hasFactory = candidate.factory !== undefined;
  const hasFactoryData = candidate.factoryData !== undefined;
  const factory = hasFactory ? normalizeAddress(candidate.factory) : null;
  if (
    hasFactory !== hasFactoryData ||
    (hasFactory && (!factory || !HEX_PATTERN.test(candidate.factoryData!)))
  ) {
    return { ok: false, error: error("Invalid counterfactual account data.", "factory") };
  }
  if (
    candidate.requestId !== undefined &&
    (typeof candidate.requestId !== "string" || !candidate.requestId.trim())
  ) {
    return { ok: false, error: error("Invalid request ID.", "requestId") };
  }
  if (candidate.cursor !== undefined && typeof candidate.cursor !== "string") {
    return { ok: false, error: error("Invalid cursor.", "cursor") };
  }
  if (
    candidate.expectedRevision !== undefined &&
    !isSafeNonNegativeInteger(candidate.expectedRevision)
  ) {
    return { ok: false, error: error("Invalid expected revision.", "expectedRevision") };
  }
  return {
    ok: true,
    value: {
      version: 1,
      chainId: candidate.chainId,
      gardenAddress,
      accountAddress,
      action: candidate.action,
      nonce: candidate.nonce as `0x${string}`,
      issuedAt: candidate.issuedAt,
      expiresAt: candidate.expiresAt,
      signature: candidate.signature as `0x${string}`,
      ...(candidate.requestId ? { requestId: candidate.requestId } : {}),
      ...(candidate.cursor ? { cursor: candidate.cursor } : {}),
      ...(candidate.expectedRevision !== undefined
        ? { expectedRevision: candidate.expectedRevision }
        : {}),
      ...(factory && candidate.factoryData
        ? { factory, factoryData: candidate.factoryData as `0x${string}` }
        : {}),
    },
  };
}
