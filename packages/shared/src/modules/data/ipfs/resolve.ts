import {
  DEFAULT_AVATAR,
  getGatewayUrl,
  getPinataGatewayUrl,
  IPFS_FALLBACK_GATEWAYS,
  trimTrailingSlashes,
} from "./client";
import { createGatewayChain, type IpfsGateway, type IpfsReadOptions } from "./gateway";

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

export type GetFileByHashOptions = IpfsReadOptions;

function fetchGateway(targetUrl: string): IpfsGateway {
  const fetchResponse = async (signal?: AbortSignal): Promise<Response> => {
    const response = await fetch(targetUrl, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch file from IPFS: ${response.status} ${response.statusText}`);
    }
    return response;
  };

  return {
    readFile: async (_identifier, options = {}) => {
      const response = await fetchResponse(options.signal);
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json") || contentType?.includes("text/")) {
        return { data: await response.text() };
      }
      return { data: await response.blob() };
    },
    readJson: async <T>(_identifier: string, options: IpfsReadOptions = {}) => {
      const response = await fetchResponse(options.signal);
      const parsed = tryParseJson<T>(await response.text());
      if (parsed === null) throw new Error("Failed to parse JSON from IPFS response");
      return parsed;
    },
  };
}

function gatewayChainFor(identifier: string): IpfsGateway {
  return createGatewayChain(getIPFSGatewayCandidates(identifier).map(fetchGateway));
}

/**
 * Fetches a file from IPFS by its hash/CID using the gateway
 */
export async function getFileByHash(
  hash: string,
  options: GetFileByHashOptions = {}
): Promise<{ data: Blob | string }> {
  return gatewayChainFor(hash).readFile(hash, options);
}

export async function getJsonByHash<T = unknown>(
  hash: string,
  options: GetFileByHashOptions = {}
): Promise<T> {
  return gatewayChainFor(hash).readJson<T>(hash, options);
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
