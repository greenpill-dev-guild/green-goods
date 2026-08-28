import type { Address, PublicApiError } from "./core";

export {
  buildGardenJoinProofMessage,
  decodeGardenJoinAuthorization,
  encodeGardenJoinAuthorization,
} from "./join-request-auth";

export const GARDEN_JOIN_REQUEST_DEFAULT_PAGE_SIZE = 25;
export const GARDEN_JOIN_REQUEST_MAX_PAGE_SIZE = 100;
export const GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH = 80;
export const GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH = 500;
export const GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH = 500;
const GARDEN_JOIN_PROOF_MAX_AGE_SECONDS = 5 * 60;

export type GardenJoinRequestState = "pending" | "welcomed" | "declined";
export type GardenJoinRequestKind = "garden_membership";
export type GardenJoinRequestedVia = "garden_detail";
export type GardenJoinProofAction =
  | "create"
  | "read_self"
  | "list"
  | "welcome"
  | "decline"
  | "withdraw";

export type GardenJoinRequestApiErrorCode =
  | PublicApiError["errorCode"]
  | "signature_invalid"
  | "signature_expired"
  | "garden_role_required"
  | "request_not_found"
  | "already_member"
  | "open_joining_enabled"
  | "idempotency_conflict"
  | "resolution_conflict"
  | "request_expired"
  | "request_withdrawn"
  | "queue_full"
  | "chain_unsupported";

export type GardenJoinRequestApiError = Omit<PublicApiError, "errorCode"> & {
  errorCode: GardenJoinRequestApiErrorCode;
};

export type GardenJoinProofEnvelope = {
  version: 1;
  chainId: number;
  gardenAddress: Address;
  accountAddress: Address;
  action: GardenJoinProofAction;
  nonce: `0x${string}`;
  issuedAt: number;
  expiresAt: number;
  signature: `0x${string}`;
  requestId?: string;
  cursor?: string;
  expectedRevision?: number;
  factory?: Address;
  factoryData?: `0x${string}`;
};

export type GardenJoinProofContent = {
  displayName?: string;
  note?: string | null;
  reason?: string;
  requestedVia?: GardenJoinRequestedVia;
  state?: GardenJoinRequestState;
  limit?: number;
};

export type CreateGardenJoinRequestInput = {
  displayName: string;
  note?: string | null;
  requestedVia: GardenJoinRequestedVia;
};

export type ResolveGardenJoinRequestInput =
  | { action: "welcome"; expectedRevision: number }
  | { action: "decline"; expectedRevision: number; reason: string };

export type GardenJoinRequestSelfRecord = {
  id: string;
  kind: GardenJoinRequestKind;
  state: GardenJoinRequestState;
  revision: number;
  requestedVia: GardenJoinRequestedVia;
  requestedAt: string;
  expiresAt: string;
  resolvedAt?: string;
  reason?: string;
  canAskAgain: boolean;
};

export type GardenJoinRequestQueueItem = GardenJoinRequestSelfRecord & {
  accountAddress: Address;
  displayName: string;
  note?: string;
};

export type GardenJoinRequestSelfResponse = {
  ok: true;
  request: GardenJoinRequestSelfRecord | null;
};

export type GardenJoinRequestQueueResponse = {
  ok: true;
  items: GardenJoinRequestQueueItem[];
  nextCursor?: string;
};

export type GardenJoinValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GardenJoinRequestApiError };

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const HEX_PATTERN = /^0x[0-9a-fA-F]+$/;
const NONCE_PATTERN = /^0x[a-fA-F0-9]{64}$/;

function error(
  message: string,
  field?: string,
  errorCode: GardenJoinRequestApiErrorCode = "invalid_request"
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

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 && normalized.length <= GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH
    ? normalized
    : null;
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\r\n/g, "\n");
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafePositiveInteger(value: unknown): value is number {
  return isSafeNonNegativeInteger(value) && value > 0;
}

export function validateCreateGardenJoinRequest(
  input: unknown
): GardenJoinValidationResult<CreateGardenJoinRequestInput> {
  const candidate = input as Partial<CreateGardenJoinRequestInput> | null;
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, error: error("Invalid request body.") };
  }
  const displayName = normalizeDisplayName(candidate.displayName);
  if (!displayName) {
    return {
      ok: false,
      error: error(
        `Display name is required and must be ${GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
        "displayName"
      ),
    };
  }
  const note = normalizeOptionalText(candidate.note, GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH);
  if (note === null) {
    return {
      ok: false,
      error: error(
        `Note must be ${GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH} characters or fewer.`,
        "note"
      ),
    };
  }
  if (candidate.requestedVia !== "garden_detail") {
    return { ok: false, error: error("Invalid request source.", "requestedVia") };
  }
  return {
    ok: true,
    value: {
      displayName,
      ...(note ? { note } : {}),
      requestedVia: candidate.requestedVia,
    },
  };
}

export function validateResolveGardenJoinRequest(
  input: unknown
): GardenJoinValidationResult<ResolveGardenJoinRequestInput> {
  const candidate = input as Partial<ResolveGardenJoinRequestInput> | null;
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, error: error("Invalid request body.") };
  }
  if (!isSafeNonNegativeInteger(candidate.expectedRevision)) {
    return { ok: false, error: error("Expected revision is required.", "expectedRevision") };
  }
  if (candidate.action === "welcome") {
    return { ok: true, value: { action: "welcome", expectedRevision: candidate.expectedRevision } };
  }
  if (candidate.action === "decline") {
    const reason = normalizeOptionalText(
      "reason" in candidate ? candidate.reason : undefined,
      GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH
    );
    if (!reason) {
      return {
        ok: false,
        error: error(
          `Reason is required and must be ${GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH} characters or fewer.`,
          "reason"
        ),
      };
    }
    return {
      ok: true,
      value: { action: "decline", expectedRevision: candidate.expectedRevision, reason },
    };
  }
  return { ok: false, error: error("Resolution action must be welcome or decline.", "action") };
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
  if (!isSafePositiveInteger(candidate.chainId)) {
    return { ok: false, error: error("Invalid chain ID.", "chainId") };
  }
  if (options.allowedChainIds && !options.allowedChainIds.includes(candidate.chainId)) {
    return {
      ok: false,
      error: error("Unsupported chain.", "chainId", "chain_unsupported"),
    };
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
