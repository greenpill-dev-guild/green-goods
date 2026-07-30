import type { Address } from "../../types/domain";
import {
  parseProfileAvatarRecord,
  PROFILE_AVATAR_ROUTE,
  type ProfileAvatarMutation,
  type ProfileAvatarRecord,
} from "../../public-contracts/profile-avatar";
import { ProfileAvatarTransportError } from "./types";

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

export const profileAvatarTransport = {
  async get(
    chainId: number,
    address: Address | string,
    baseUrl = apiBaseUrl()
  ): Promise<ProfileAvatarRecord> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}${route(chainId, address)}`);
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

  async save(
    chainId: number,
    address: Address | string,
    mutation: ProfileAvatarMutation,
    baseUrl = apiBaseUrl()
  ): Promise<ProfileAvatarRecord> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}${route(chainId, address)}`, {
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
