import type { Address } from "../../types/domain";
import {
  parseProfileAvatarRecord,
  PROFILE_AVATAR_BATCH_LIMIT,
  PROFILE_AVATAR_BATCH_ROUTE,
  PROFILE_AVATAR_ROUTE,
  type ProfileAvatarMutation,
  type ProfileAvatarRecord,
} from "../../public-contracts/profile-avatar";
import { ProfileAvatarTransportError } from "./types";

const PROFILE_AVATAR_REQUEST_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROFILE_AVATAR_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function apiBaseUrl(): string {
  return (
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : "https://agent.greengoods.app")
  );
}

function route(chainId: number, address: string): string {
  return PROFILE_AVATAR_ROUTE.replace(":chainId", encodeURIComponent(String(chainId))).replace(
    ":address",
    encodeURIComponent(address.toLowerCase())
  );
}

async function responsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function recordFromPayload(payload: unknown): ProfileAvatarRecord | null {
  if (payload && typeof payload === "object" && "record" in payload) {
    return parseProfileAvatarRecord((payload as { record: unknown }).record);
  }
  return parseProfileAvatarRecord(payload);
}

function batchRoute(chainId: number, addresses: readonly string[]): string {
  const route = PROFILE_AVATAR_BATCH_ROUTE.replace(":chainId", encodeURIComponent(String(chainId)));
  const list = addresses.map((address) => encodeURIComponent(address.toLowerCase())).join(",");
  return `${route}?addresses=${list}`;
}

function recordsFromPayload(payload: unknown): ProfileAvatarRecord[] | null {
  if (!payload || typeof payload !== "object" || !("records" in payload)) return null;
  const records = (payload as { records: unknown }).records;
  if (!Array.isArray(records)) return null;
  const parsed = records.map(parseProfileAvatarRecord);
  return parsed.every((record): record is ProfileAvatarRecord => record !== null) ? parsed : null;
}

interface ListedRead {
  address: string;
  resolve: (record: ProfileAvatarRecord) => void;
  reject: (error: unknown) => void;
}

/** Reads a list's rows asked for in the current task, by agent and chain. */
const pendingListedReads = new Map<
  string,
  { chainId: number; baseUrl: string; reads: ListedRead[] }
>();

async function flushListedReads(key: string): Promise<void> {
  const batch = pendingListedReads.get(key);
  pendingListedReads.delete(key);
  if (!batch) return;
  const addresses = [...new Set(batch.reads.map((read) => read.address))];
  const chunks: string[][] = [];
  for (let start = 0; start < addresses.length; start += PROFILE_AVATAR_BATCH_LIMIT) {
    chunks.push(addresses.slice(start, start + PROFILE_AVATAR_BATCH_LIMIT));
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      const reads = batch.reads.filter((read) => chunk.includes(read.address));
      try {
        const records = await profileAvatarTransport.getMany(batch.chainId, chunk, batch.baseUrl);
        const byAddress = new Map(records.map((record) => [record.address.toLowerCase(), record]));
        for (const read of reads) {
          const record = byAddress.get(read.address);
          if (record) read.resolve(record);
          else read.reject(new ProfileAvatarTransportError("Profile avatar could not be loaded."));
        }
      } catch (error) {
        for (const read of reads) read.reject(error);
      }
    })
  );
}

export const profileAvatarTransport = {
  async get(
    chainId: number,
    address: Address | string,
    baseUrl = apiBaseUrl()
  ): Promise<ProfileAvatarRecord> {
    let response: Response;
    try {
      response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}${route(chainId, address)}`);
    } catch {
      throw new ProfileAvatarTransportError(
        "Profile avatar could not be loaded.",
        undefined,
        undefined,
        true
      );
    }
    const payload = await responsePayload(response);
    const record = recordFromPayload(payload);
    if (!response.ok || !record)
      throw new ProfileAvatarTransportError("Profile avatar could not be loaded.", response.status);
    return record;
  },

  /**
   * Up to 50 accounts' records in one request, in request order, on the batch route's own read
   * budget, so a list of people never spends the single-read budget the photo editor needs.
   */
  async getMany(
    chainId: number,
    addresses: readonly (Address | string)[],
    baseUrl = apiBaseUrl()
  ): Promise<ProfileAvatarRecord[]> {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${baseUrl.replace(/\/$/, "")}${batchRoute(chainId, addresses)}`
      );
    } catch {
      throw new ProfileAvatarTransportError(
        "Profile avatars could not be loaded.",
        undefined,
        undefined,
        true
      );
    }
    const records = recordsFromPayload(await responsePayload(response));
    if (!response.ok || !records)
      throw new ProfileAvatarTransportError(
        "Profile avatars could not be loaded.",
        response.status
      );
    return records;
  },

  /**
   * One row's record in a list of people. Every row of a list asks in the same render, so the
   * reads made in one task go out together, 50 addresses to a request (`getMany`).
   */
  getListed(
    chainId: number,
    address: Address | string,
    baseUrl = apiBaseUrl()
  ): Promise<ProfileAvatarRecord> {
    const key = `${baseUrl}|${chainId}`;
    return new Promise((resolve, reject) => {
      const read = { address: address.toLowerCase(), resolve, reject };
      const batch = pendingListedReads.get(key);
      if (batch) {
        batch.reads.push(read);
        return;
      }
      pendingListedReads.set(key, { chainId, baseUrl, reads: [read] });
      setTimeout(() => void flushListedReads(key), 0);
    });
  },

  async save(
    chainId: number,
    address: Address | string,
    mutation: ProfileAvatarMutation,
    baseUrl = apiBaseUrl()
  ): Promise<ProfileAvatarRecord> {
    let response: Response;
    try {
      response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}${route(chainId, address)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation),
      });
    } catch {
      throw new ProfileAvatarTransportError(
        "Profile avatar save outcome is unknown.",
        undefined,
        undefined,
        true
      );
    }
    const payload = await responsePayload(response);
    const record = recordFromPayload(payload);
    if (!response.ok || !record) {
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message: unknown }).message)
          : "Profile avatar could not be saved.";
      const errorCode =
        payload && typeof payload === "object" && "errorCode" in payload
          ? String((payload as { errorCode: unknown }).errorCode)
          : undefined;
      throw new ProfileAvatarTransportError(
        message,
        response.status,
        errorCode,
        response.status >= 500 || response.ok
      );
    }
    return record;
  },
};
