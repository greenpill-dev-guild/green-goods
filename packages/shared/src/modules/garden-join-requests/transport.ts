import {
  encodeGardenJoinAuthorization,
  type CreateGardenJoinRequestInput,
  type GardenJoinRequestAvailabilityResponse,
  type GardenJoinProofEnvelope,
  type GardenJoinRequestApiError,
  type GardenJoinRequestApiErrorCode,
  type GardenJoinRequestQueueResponse,
  type GardenJoinRequestSelfResponse,
  type ResolveGardenJoinRequestInput,
} from "../../public-contracts/join-requests";
import type { Address } from "../../types/domain";

const REQUEST_TIMEOUT_MS = 10_000;
const AVAILABILITY_ROUTE = "/public/features/garden-join-requests";

export class GardenJoinRequestTransportError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly errorCode?: GardenJoinRequestApiErrorCode,
    readonly outcomeUnknown = false
  ) {
    super(message);
    this.name = "GardenJoinRequestTransportError";
  }
}

export function gardenJoinRequestErrorMessage(error: unknown): {
  id: string;
  defaultMessage: string;
} {
  const errorCode = error instanceof GardenJoinRequestTransportError ? error.errorCode : undefined;

  switch (errorCode) {
    case "already_member":
      return {
        id: "app.garden.joinRequest.error.alreadyMember",
        defaultMessage: "You are already a member of this garden.",
      };
    case "signature_invalid":
    case "signature_expired":
      return {
        id: "app.garden.joinRequest.error.authorization",
        defaultMessage: "We could not verify your authorization. Please sign again.",
      };
    case "idempotency_conflict":
    case "resolution_conflict":
      return {
        id: "app.garden.joinRequest.error.conflict",
        defaultMessage: "This request changed or was already used. Check its status and try again.",
      };
    case "request_expired":
      return {
        id: "app.garden.joinRequest.error.expired",
        defaultMessage: "This request expired. You can send a new one.",
      };
    case "request_not_found":
      return {
        id: "app.garden.joinRequest.error.notFound",
        defaultMessage: "We could not find this join request.",
      };
    case "open_joining_enabled":
      return {
        id: "app.garden.joinRequest.error.openJoining",
        defaultMessage: "This garden is open. Join it directly instead.",
      };
    case "garden_role_required":
      return {
        id: "app.garden.joinRequest.error.permission",
        defaultMessage: "You do not have permission to manage this request.",
      };
    case "queue_full":
      return {
        id: "app.garden.joinRequest.error.queueFull",
        defaultMessage: "This garden's request queue is full right now. Please try again later.",
      };
    case "rate_limited":
      return {
        id: "app.garden.joinRequest.error.rateLimited",
        defaultMessage: "Too many attempts. Please try again later.",
      };
    case "chain_unsupported":
      return {
        id: "app.garden.joinRequest.error.unsupportedChain",
        defaultMessage: "Garden join requests are not available on this network.",
      };
    case "request_withdrawn":
      return {
        id: "app.garden.joinRequest.error.withdrawn",
        defaultMessage: "This request was already withdrawn.",
      };
    case "provider_unavailable":
    case "internal_error":
    case "origin_not_allowed":
      return {
        id: "app.garden.joinRequest.error.unavailable",
        defaultMessage: "Garden join requests are unavailable right now. Please try again later.",
      };
    default:
      if (
        error instanceof GardenJoinRequestTransportError &&
        (error.status === undefined || error.status >= 500)
      ) {
        return {
          id: "app.garden.joinRequest.error.unavailable",
          defaultMessage: "Garden join requests are unavailable right now. Please try again later.",
        };
      }
      return {
        id: "app.garden.joinRequest.error.generic",
        defaultMessage: "We could not complete the request. Please try again.",
      };
  }
}

function apiBaseUrl(): string {
  return (
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : "https://agent.greengoods.app")
  );
}

function collectionRoute(gardenAddress: Address): string {
  return `/public/gardens/${encodeURIComponent(gardenAddress.toLowerCase())}/join-requests`;
}

function assertSecureApiBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new GardenJoinRequestTransportError("The garden request service URL is invalid.");
  }
  const isLoopback =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new GardenJoinRequestTransportError(
      "The garden request service requires a secure HTTPS connection."
    );
  }
}

async function request<T>(
  path: string,
  proof: GardenJoinProofEnvelope | null,
  init: RequestInit = {},
  baseUrl = apiBaseUrl()
): Promise<T> {
  assertSecureApiBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(proof ? { Authorization: encodeGardenJoinAuthorization(proof) } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      payload = null;
    }
    if (!response.ok) {
      const failure = payload as Partial<GardenJoinRequestApiError> | null;
      throw new GardenJoinRequestTransportError(
        failure?.message ?? "The garden request could not be completed.",
        response.status,
        failure?.errorCode,
        response.status >= 500
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof GardenJoinRequestTransportError) throw error;
    throw new GardenJoinRequestTransportError(
      "The garden request service could not be reached.",
      undefined,
      undefined,
      init.method !== undefined && init.method !== "GET"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const gardenJoinRequestTransport = {
  availability(baseUrl = apiBaseUrl()) {
    return request<GardenJoinRequestAvailabilityResponse>(
      AVAILABILITY_ROUTE,
      null,
      { method: "GET" },
      baseUrl
    );
  },

  create(
    gardenAddress: Address,
    input: CreateGardenJoinRequestInput,
    proof: GardenJoinProofEnvelope,
    baseUrl?: string
  ) {
    return request<GardenJoinRequestSelfResponse>(
      collectionRoute(gardenAddress),
      proof,
      { method: "POST", body: JSON.stringify(input) },
      baseUrl
    );
  },

  mine(gardenAddress: Address, proof: GardenJoinProofEnvelope, baseUrl?: string) {
    return request<GardenJoinRequestSelfResponse>(
      `${collectionRoute(gardenAddress)}/me`,
      proof,
      { method: "GET" },
      baseUrl
    );
  },

  withdraw(gardenAddress: Address, proof: GardenJoinProofEnvelope, baseUrl?: string) {
    return request<{ ok: true }>(
      `${collectionRoute(gardenAddress)}/me`,
      proof,
      { method: "DELETE" },
      baseUrl
    );
  },

  list(
    gardenAddress: Address,
    options: { limit: number; cursor?: string },
    proof: GardenJoinProofEnvelope,
    baseUrl?: string
  ) {
    const params = new URLSearchParams({ state: "pending", limit: String(options.limit) });
    if (options.cursor) params.set("cursor", options.cursor);
    return request<GardenJoinRequestQueueResponse>(
      `${collectionRoute(gardenAddress)}?${params}`,
      proof,
      { method: "GET" },
      baseUrl
    );
  },

  resolve(
    gardenAddress: Address,
    requestId: string,
    input: ResolveGardenJoinRequestInput,
    proof: GardenJoinProofEnvelope,
    baseUrl?: string
  ) {
    return request<{
      ok: true;
      request: GardenJoinRequestQueueResponse["items"][number];
      pendingOnchainMembership?: boolean;
    }>(
      `${collectionRoute(gardenAddress)}/${encodeURIComponent(requestId)}/resolve`,
      proof,
      { method: "POST", body: JSON.stringify(input) },
      baseUrl
    );
  },
};
