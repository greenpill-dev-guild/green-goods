import type { UploadErrorCategory } from "../../app/error-tracking";
import {
  getGatewayUrl,
  getPinataGatewayUrl,
  getPinataJwt,
  getPinataUploadSignUrl,
  getPinataUploadsApiBaseUrl,
  PINATA_UPLOAD_SIGN_TIMEOUT_MS,
  PINATA_UPLOAD_TIMEOUT_MS,
  PROVIDER_VERIFICATION_ATTEMPTS,
  PROVIDER_VERIFICATION_TIMEOUT_MS,
  trimTrailingSlashes,
} from "./client";

// ============================================================================
// TYPES
// ============================================================================

export interface PinataUploadResponse {
  data?: { cid?: string };
  message?: string;
  error?: { reason?: string };
}

type UploadSignResponse =
  | { ok?: true; url?: string; message?: string; errorCode?: string }
  | { ok: false; message?: string; errorCode?: string };

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/**
 * Issues a fetch that aborts after `timeoutMs`, converting the abort into a
 * clear, retryable error. Without this, a stalled upload connection (common on
 * weak mobile networks) hangs forever with no surfaced error — the work-media
 * "Uploading…" spinner never resolves. Mirrors the AbortController idiom used by
 * `verifyGatewayAvailability` below.
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildPinataMetadata(
  options: {
    name?: string;
    category?: UploadErrorCategory;
    source?: string;
    gardenAddress?: string;
  } = {}
) {
  const keyvalues = Object.fromEntries(
    Object.entries({
      category: options.category,
      source: options.source,
      gardenAddress: options.gardenAddress,
    }).filter(([, value]) => Boolean(value))
  ) as Record<string, string>;

  return {
    ...(options.name ? { name: options.name } : {}),
    ...(Object.keys(keyvalues).length > 0 ? { keyvalues } : {}),
  };
}

async function parsePinataUploadResponse(response: Response, filename: string): Promise<string> {
  let payload: PinataUploadResponse | null = null;
  try {
    payload = (await response.json()) as PinataUploadResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error?.reason?.trim() ||
      payload?.message?.trim() ||
      `${response.status} ${response.statusText}`;
    throw new Error(`Pinata file upload failed for ${filename}: ${message}`);
  }

  const cid = payload?.data?.cid?.trim();
  if (!cid) {
    throw new Error(`Pinata upload for ${filename} did not return a CID`);
  }

  return cid;
}

async function requestSignedUploadUrl(
  file: File,
  options: {
    name?: string;
    category?: UploadErrorCategory;
    source?: string;
    gardenAddress?: string;
  }
): Promise<string> {
  const signUrl = getPinataUploadSignUrl();
  if (!signUrl) {
    throw new Error("IPFS upload signer endpoint is not configured");
  }

  const response = await fetchWithTimeout(
    signUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: options.name ?? file.name,
        mimeType: file.type,
        size: file.size,
        category: options.category,
        source: options.source,
        gardenAddress: options.gardenAddress,
      }),
    },
    PINATA_UPLOAD_SIGN_TIMEOUT_MS,
    "Upload signing timed out. Check your connection and try again."
  );

  let payload: UploadSignResponse | null = null;
  try {
    payload = (await response.json()) as UploadSignResponse;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message?.trim() || "Upload signing is unavailable right now.");
  }

  const signedUrl = payload?.url?.trim();
  if (!signedUrl) {
    throw new Error("Upload signing response did not include a URL");
  }

  return signedUrl;
}

async function uploadFileWithSignedPinataUrl(
  file: File,
  options: {
    name?: string;
    category?: UploadErrorCategory;
    source?: string;
    gardenAddress?: string;
  }
): Promise<string> {
  const signedUrl = await requestSignedUploadUrl(file, options);
  const formData = new FormData();
  formData.append("network", "public");
  formData.append("file", file);

  const response = await fetchWithTimeout(
    signedUrl,
    {
      method: "POST",
      body: formData,
    },
    PINATA_UPLOAD_TIMEOUT_MS,
    "Media upload timed out. Check your connection and try again."
  );

  return parsePinataUploadResponse(response, file.name);
}

// ============================================================================
// PINATA UPLOAD
// ============================================================================

export async function uploadFileWithPinata(
  file: File,
  options: {
    name?: string;
    category?: UploadErrorCategory;
    source?: string;
    gardenAddress?: string;
  } = {}
): Promise<string> {
  if (getPinataUploadSignUrl()) {
    return uploadFileWithSignedPinataUrl(file, options);
  }

  const jwt = getPinataJwt();
  if (!jwt) {
    throw new Error("Pinata JWT is not configured");
  }

  const formData = new FormData();
  formData.append("network", "public");
  formData.append("file", file);
  if (options.name) {
    formData.append("name", options.name);
  }

  const keyvalues = buildPinataMetadata(options).keyvalues ?? {};
  if (Object.keys(keyvalues).length > 0) {
    formData.append("keyvalues", JSON.stringify(keyvalues));
  }

  const response = await fetchWithTimeout(
    `${getPinataUploadsApiBaseUrl()}/files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: formData,
    },
    PINATA_UPLOAD_TIMEOUT_MS,
    "Media upload timed out. Check your connection and try again."
  );

  return parsePinataUploadResponse(response, file.name);
}

// ============================================================================
// GATEWAY VERIFICATION
// ============================================================================

function buildGatewayUrl(value: string, gatewayBaseUrl: string): string {
  // Inline parse to avoid circular dependency with resolve.ts
  const parsed = parseIpfsPathForGateway(value);
  if (!parsed) return value;
  return `${trimTrailingSlashes(gatewayBaseUrl)}/ipfs/${parsed}`;
}

/**
 * Minimal IPFS path parser for gateway URL construction.
 * Returns the canonical ID (cid or cid/path) or null.
 */
function parseIpfsPathForGateway(value: string): string | null {
  let sanitized = value.trim();
  if (sanitized.startsWith("ipfs://")) {
    sanitized = sanitized.slice("ipfs://".length);
  }
  sanitized = sanitized.replace(/^\/+/, "").replace(/^ipfs\//i, "");
  if (!sanitized) return null;

  const parts = sanitized.split("/").filter(Boolean);
  const cid = parts[0];
  if (!cid || !/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z0-9]{20,})$/i.test(cid)) return null;

  return parts.join("/");
}

async function verifyGatewayAvailability(
  value: string,
  gatewayBaseUrl: string,
  label: string
): Promise<string> {
  const targetUrl = buildGatewayUrl(value, gatewayBaseUrl);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= PROVIDER_VERIFICATION_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_VERIFICATION_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.ok) {
        try {
          await response.arrayBuffer();
        } catch {
          // Ignore response body read issues after a successful status.
        }
        return targetUrl;
      }

      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < PROVIDER_VERIFICATION_ATTEMPTS) {
      await sleep(1_000 * attempt);
    }
  }

  throw new Error(
    `Failed to verify ${label} availability for ${value}: ${lastError?.message ?? "unknown error"}`
  );
}

export async function verifyPinataGatewayAvailability(cid: string): Promise<void> {
  const gatewayBaseUrl = getPinataGatewayUrl() ?? getGatewayUrl();
  await verifyGatewayAvailability(`ipfs://${cid}`, gatewayBaseUrl, "Pinata gateway");
}
