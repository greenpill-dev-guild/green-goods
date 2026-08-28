import {
  encodeGardenJoinAuthorization,
  type CreateGardenJoinRequestInput,
  type GardenJoinRequestAvailabilityResponse,
  type GardenJoinProofEnvelope,
  type GardenJoinRequestApiError,
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
    readonly errorCode?: string,
    readonly outcomeUnknown = false
  ) {
    super(message);
    this.name = "GardenJoinRequestTransportError";
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
