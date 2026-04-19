import type { UploadErrorCategory } from "../../app/error-tracking";
import {
  getGatewayUrl,
  getPinataGatewayUrl,
  getPinataJwt,
  getPinataUploadsApiBaseUrl,
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

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const response = await fetch(`${getPinataUploadsApiBaseUrl()}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

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
    throw new Error(`Pinata file upload failed for ${file.name}: ${message}`);
  }

  const cid = payload?.data?.cid?.trim();
  if (!cid) {
    throw new Error(`Pinata upload for ${file.name} did not return a CID`);
  }

  return cid;
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
