import type { Address, PublicApiError } from "./core";

export {
  buildGardenJoinProofMessage,
  decodeGardenJoinAuthorization,
  encodeGardenJoinAuthorization,
} from "./join-request-auth";
export { validateGardenJoinProofEnvelope } from "./join-request-proof";

export const GARDEN_JOIN_REQUEST_DEFAULT_PAGE_SIZE = 25;
export const GARDEN_JOIN_REQUEST_MAX_PAGE_SIZE = 100;
export const GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH = 80;
export const GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH = 500;
export const GARDEN_JOIN_REQUEST_REASON_MAX_LENGTH = 500;

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
  rateLimitedRecently: boolean;
};

export type GardenJoinRequestAvailabilityResponse = {
  ok: true;
  enabled: boolean;
};

export type GardenJoinValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GardenJoinRequestApiError };

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
