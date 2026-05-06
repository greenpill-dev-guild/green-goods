import {
  DEFAULT_AVATAR,
  getGatewayUrl,
  getPinataGatewayUrl,
  IPFS_FALLBACK_GATEWAYS,
  trimTrailingSlashes,
} from "./client";

// ============================================================================
// HELPERS
// ============================================================================

function trimLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, "");
}

function isPotentialIpfsCid(value: string): boolean {
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z0-9]{20,})$/i.test(value);
}

// ============================================================================
// IPFS REFERENCE PARSING
// ============================================================================

interface ParsedIpfsReference {
  cid: string;
  path: string;
  canonicalId: string;
  canonicalUri: string;
}

function parseIpfsPath(value: string): ParsedIpfsReference | null {
  const sanitized = trimLeadingSlashes(value.trim()).replace(/^ipfs\//i, "");
  if (!sanitized) return null;

  const [cid, ...pathParts] = sanitized.split("/").filter(Boolean);
  if (!cid || !isPotentialIpfsCid(cid)) return null;

  const path = pathParts.join("/");
  const canonicalId = path ? `${cid}/${path}` : cid;

  return {
    cid,
    path,
    canonicalId,
    canonicalUri: `ipfs://${canonicalId}`,
  };
}

export function parseIPFSReference(value: string): ParsedIpfsReference | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("ipfs://")) {
    return parseIpfsPath(trimmed.slice("ipfs://".length));
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathname = trimLeadingSlashes(url.pathname);
      const subdomainMatch = url.hostname.match(/^([^.]+)\.ipfs\./i);

      if (pathname.startsWith("ipfs/")) {
        return parseIpfsPath(pathname.slice("ipfs/".length));
      }

      if (subdomainMatch?.[1]) {
        const cid = subdomainMatch[1];
        const path = trimLeadingSlashes(pathname);
        return parseIpfsPath(path ? `${cid}/${path}` : cid);
      }
    } catch {
      return null;
    }
  }

  return parseIpfsPath(trimmed);
}

export function canonicalizeIPFSIdentifier(value: string): string {
  const parsed = parseIPFSReference(value);
  return parsed?.canonicalId ?? value.trim();
}

export function toCanonicalIPFSUri(value: string): string {
  const parsed = parseIPFSReference(value);
  return parsed?.canonicalUri ?? value.trim();
}

// ============================================================================
// GATEWAY URL RESOLUTION
// ============================================================================

/**
 * Returns deduplicated list of IPFS gateway base URLs, including
 * configured Pinata gateways and hardcoded fallbacks.
 * Single source of truth for gateway ordering across the app.
 */
export function getIPFSFallbackGateways(customGateway?: string): string[] {
  return Array.from(
    new Set(
      [customGateway, getPinataGatewayUrl(), getGatewayUrl(), ...IPFS_FALLBACK_GATEWAYS]
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => trimTrailingSlashes(entry))
    )
  );
}

function getIPFSGatewayCandidates(value: string, customGateway?: string): string[] {
  const parsed = parseIPFSReference(value);
  if (!parsed) {
    return [value];
  }

  const originalGatewayCandidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : null;

  return Array.from(
    new Set([
      originalGatewayCandidate,
      ...getIPFSFallbackGateways(customGateway).map((base) => `${base}/ipfs/${parsed.canonicalId}`),
    ])
  ).filter((candidate): candidate is string => Boolean(candidate));
}

/**
 * Resolves an IPFS URL to a proper gateway URL for image display
 */
export function resolveIPFSUrl(url: string, customGateway?: string): string {
  if (!url) return "";
  const parsed = parseIPFSReference(url);
  if (!parsed) return url;

  const base = trimTrailingSlashes(customGateway || getPinataGatewayUrl() || getGatewayUrl());
  return `${base}/ipfs/${parsed.canonicalId}`;
}

// ============================================================================
// FILE FETCHING
// ============================================================================

export function tryParseJson<T = unknown>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function readFetchedDataAsText(data: Blob | string): Promise<string> {
  return typeof data === "string" ? data : data.text();
}

export interface GetFileByHashOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Fetches a file from IPFS by its hash/CID using the gateway
 */
export async function getFileByHash(
  hash: string,
  options: GetFileByHashOptions = {}
): Promise<{ data: Blob | string }> {
  const { signal, timeoutMs = 30_000 } = options;
  const abortController = new AbortController();
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          abortController.abort();
        }, timeoutMs)
      : null;

  const abortFromUpstream = () => abortController.abort();
  if (signal) {
    if (signal.aborted) {
      abortController.abort();
    } else {
      signal.addEventListener("abort", abortFromUpstream, { once: true });
    }
  }

  let response: Response | null = null;
  const candidateUrls = getIPFSGatewayCandidates(hash);
  let lastError: Error | null = null;
  try {
    for (const url of candidateUrls) {
      try {
        response = await fetch(url, { signal: abortController.signal });
      } catch (error) {
        if (abortController.signal.aborted) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }

      if (response.ok) {
        break;
      }

      lastError = new Error(
        `Failed to fetch file from IPFS: ${response.status} ${response.statusText}`
      );
      response = null;
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(`IPFS request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener("abort", abortFromUpstream);
  }

  if (!response) {
    throw lastError ?? new Error("Failed to fetch file from IPFS");
  }

  const contentType = response.headers.get("content-type");

  // Return as blob for binary data, text for JSON/text
  if (contentType?.includes("application/json") || contentType?.includes("text/")) {
    const text = await response.text();
    return { data: text };
  }

  const blob = await response.blob();
  return { data: blob };
}

export async function getJsonByHash<T = unknown>(
  hash: string,
  options: GetFileByHashOptions = {}
): Promise<T> {
  const { data } = await getFileByHash(hash, options);
  const text = await readFetchedDataAsText(data);
  const parsed = tryParseJson<T>(text);

  if (parsed === null) {
    throw new Error("Failed to parse JSON from IPFS response");
  }

  return parsed;
}

// ============================================================================
// AVATAR / IMAGE RESOLUTION
// ============================================================================

/**
 * Resolves avatar URL from various formats (ipfs://, ar://, http, etc.)
 */
export function resolveAvatarUrl(
  uri?: string | null,
  defaultAvatar: string = DEFAULT_AVATAR
): string {
  if (!uri) return defaultAvatar;
  const resolved = resolveIPFSUrl(uri);
  return resolved === uri && !uri.startsWith("http") ? defaultAvatar : resolved;
}

/**
 * Resolves image URL from various formats
 */
export function resolveImageUrl(uri: string): string {
  if (!uri) return "";
  return resolveIPFSUrl(uri);
}
