import {
  SAVED_OFFERS_ROUTES,
  type SavedOfferPayloadV1,
  type SavedOfferRecord,
  type SavedOffersChallengeRequest,
  type SavedOffersChallengeResponse,
  type SavedOffersSessionRequest,
  type SavedOffersSessionResponse,
} from "./types";
import {
  normalizeSavedOfferAddress,
  parseSavedOfferApiError,
  savedOfferApiError,
  validateSavedOfferPayload,
  validateSavedOffersSessionRequest,
} from "./validation";

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}

export function createSavedOffersApi(options: {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
}) {
  const baseUrl = stripTrailingSlashes(options.baseUrl);
  const fetcher = options.fetch ?? fetch;
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${options.token}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw savedOfferApiError("provider_unavailable", "Saved Offers are unavailable right now.");
    }
    const body = (await response.json().catch(() => undefined)) as unknown;
    if (!response.ok) throw parseSavedOfferApiError(body, response.status);
    return body as T;
  };
  return {
    async list(): Promise<SavedOfferRecord[]> {
      const result = await request<{ ok: true; records: SavedOfferRecord[] }>(
        SAVED_OFFERS_ROUTES.collection
      );
      return result.records;
    },
    async get(savedOfferId: string): Promise<SavedOfferRecord> {
      const result = await request<{ ok: true; record: SavedOfferRecord }>(
        `${SAVED_OFFERS_ROUTES.collection}/${encodeURIComponent(savedOfferId)}`
      );
      return result.record;
    },
    async put(
      savedOfferId: string,
      payload: SavedOfferPayloadV1,
      expectedVersion: number
    ): Promise<SavedOfferRecord> {
      const validation = validateSavedOfferPayload(payload);
      if (!validation.ok) throw validation.error;
      const result = await request<{ ok: true; record: SavedOfferRecord }>(
        `${SAVED_OFFERS_ROUTES.collection}/${encodeURIComponent(savedOfferId)}`,
        {
          method: "PUT",
          body: JSON.stringify({ payload: validation.value, expectedVersion }),
        }
      );
      return result.record;
    },
    async delete(savedOfferId: string, expectedVersion: number): Promise<number> {
      const result = await request<{ ok: true; version: number }>(
        `${SAVED_OFFERS_ROUTES.collection}/${encodeURIComponent(savedOfferId)}`,
        { method: "DELETE", body: JSON.stringify({ expectedVersion }) }
      );
      return result.version;
    },
  };
}

export function createSavedOffersSessionApi(options: { baseUrl: string; fetch?: typeof fetch }) {
  const baseUrl = stripTrailingSlashes(options.baseUrl);
  const fetcher = options.fetch ?? fetch;
  const post = async <T>(path: string, body: unknown): Promise<T> => {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw savedOfferApiError("provider_unavailable", "Saved Offers are unavailable right now.");
    }
    const value = (await response.json().catch(() => undefined)) as unknown;
    if (!response.ok) throw parseSavedOfferApiError(value, response.status);
    return value as T;
  };
  return {
    challenge(input: SavedOffersChallengeRequest) {
      const owner = normalizeSavedOfferAddress(input.owner);
      if (!owner || !Number.isSafeInteger(input.chainId) || input.chainId <= 0) {
        return Promise.reject(savedOfferApiError("invalid_request", "Invalid challenge request."));
      }
      return post<SavedOffersChallengeResponse>(SAVED_OFFERS_ROUTES.challenge, {
        chainId: input.chainId,
        owner,
      });
    },
    createSession(input: SavedOffersSessionRequest) {
      const parsed = validateSavedOffersSessionRequest(input);
      if (!parsed.ok) return Promise.reject(parsed.error);
      return post<SavedOffersSessionResponse>(SAVED_OFFERS_ROUTES.session, parsed.value);
    },
  };
}
