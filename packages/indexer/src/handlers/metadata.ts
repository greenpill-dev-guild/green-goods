import { createEffect, S } from "envio";

import { DEFAULT_IPFS_GATEWAY } from "./constants";
import type { FetchJsonContext } from "./types";

export function resolveIpfsUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `${DEFAULT_IPFS_GATEWAY}${uri.slice("ipfs://".length)}`;
  }
  return uri;
}

export function isCacheableIpfsUri(uri: string): boolean {
  if (!uri.startsWith("ipfs://")) return false;
  const [cid = "", ...path] = uri.slice("ipfs://".length).split("/");
  // Keep gateway options, encoded paths, and traversal on the uncached path.
  if (path.some((part) => !/^[\w.~-]*$/.test(part) || part === "." || part === "..")) {
    return false;
  }

  // Canonical base32 CIDv1: dag-pb/raw, SHA-256, 32-byte digest. Other CID
  // encodings still work through fetchJson, without persistent caching.
  if (/^b(?:afybei|afkrei)[a-h][a-z2-7]{50}[aeimquy4]$/.test(cid)) return true;
  if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) return false;

  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = 0n;
  for (const character of cid) {
    decoded = decoded * 58n + BigInt(alphabet.indexOf(character));
  }
  // CIDv0 is exactly a SHA-256 multihash: 0x12, 0x20, then 32 digest bytes.
  return decoded >> 256n === 0x1220n;
}

export const hypercertMetadataEffect = createEffect(
  {
    name: "HypercertMetadata",
    input: S.string,
    output: S.string,
    rateLimit: false,
    cache: true,
    crossChain: true,
  },
  async ({ input, context }) => {
    const metadata = await fetchJson(input, { log: context.log });
    context.cache = metadata !== null && isCacheableIpfsUri(input);
    return JSON.stringify(metadata);
  }
);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((entry) => typeof entry === "string") as string[];
  return strings.length ? strings : undefined;
}

export async function fetchJson(
  uri: string,
  fetchContext?: FetchJsonContext | Pick<FetchJsonContext, "log">,
  timeoutMs = 10_000,
  maxAttempts = 3,
  retryDelayMs = 250
): Promise<unknown | null> {
  // Effects already carry the calling event's logger context.
  const eventContext =
    fetchContext && "eventType" in fetchContext
      ? {
          eventType: fetchContext.eventType,
          chainId: fetchContext.chainId,
          blockNumber: fetchContext.blockNumber,
          correlationId: fetchContext.txHash,
        }
      : {};
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(resolveIpfsUri(uri), { signal: controller.signal });
      if (response.ok) return await response.json();

      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;
      if (fetchContext) {
        fetchContext.log.warn("Metadata fetch returned non-OK status", {
          ...eventContext,
          uri,
          status: response.status,
          attempt,
          maxAttempts,
        });
      }
      if (!retryable || attempt === maxAttempts) return null;
    } catch (error) {
      if (fetchContext) {
        fetchContext.log.warn("Metadata fetch failed", {
          ...eventContext,
          uri,
          attempt,
          maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (attempt === maxAttempts) return null;
    } finally {
      clearTimeout(timeoutId);
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
  }
  return null;
}

export function parseHypercertMetadata(metadata: unknown): {
  title?: string;
  description?: string;
  imageUri?: string;
  workScopes?: string[];
  gardenId?: string;
  attestationUIDs?: string[];
  bundleKind?: "WORK_LEGACY" | "COMMITMENT";
  commitmentIds?: bigint[];
  needUIDs?: string[];
} {
  if (!isRecord(metadata)) return {};

  const title = getString(metadata.name);
  const description = getString(metadata.description);
  const imageUri = getString(metadata.image);

  let workScopes: string[] | undefined;
  const hypercert = isRecord(metadata.hypercert) ? metadata.hypercert : undefined;
  if (hypercert) {
    const workScope = isRecord(hypercert.work_scope) ? hypercert.work_scope : undefined;
    if (workScope) {
      workScopes = getStringArray(workScope.value);
    }
  }

  let gardenId: string | undefined;
  let attestationUIDs: string[] | undefined;
  const hidden = isRecord(metadata.hidden_properties) ? metadata.hidden_properties : undefined;
  if (hidden) {
    gardenId = getString(hidden.gardenId);
    const refs = Array.isArray(hidden.attestationRefs)
      ? hidden.attestationRefs.filter(isRecord)
      : [];
    const uids = refs.map((ref) => getString(ref.uid)).filter((uid): uid is string => Boolean(uid));
    if (uids.length > 0) attestationUIDs = uids;
  }

  const bundleSource = hidden ?? metadata;
  const rawBundleKind = getString(bundleSource.bundleKind) ?? getString(metadata.bundleKind);
  const bundleKind = rawBundleKind === "COMMITMENT" ? "COMMITMENT" : "WORK_LEGACY";
  const rawCommitmentIds = Array.isArray(bundleSource.commitmentIds)
    ? bundleSource.commitmentIds
    : Array.isArray(metadata.commitmentIds)
      ? metadata.commitmentIds
      : [];
  const commitmentIds = [
    ...new Set(
      rawCommitmentIds
        .map((candidate) => {
          try {
            return typeof candidate === "bigint"
              ? candidate
              : typeof candidate === "number" && Number.isSafeInteger(candidate)
                ? BigInt(candidate)
                : typeof candidate === "string" && /^\d+$/.test(candidate)
                  ? BigInt(candidate)
                  : undefined;
          } catch {
            return undefined;
          }
        })
        .filter((candidate): candidate is bigint => candidate !== undefined && candidate > 0n)
    ),
  ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const rawNeedUIDs = Array.isArray(bundleSource.needUIDs)
    ? bundleSource.needUIDs
    : Array.isArray(metadata.needUIDs)
      ? metadata.needUIDs
      : [];
  const needUIDs = [
    ...new Set(
      rawNeedUIDs
        .filter((candidate): candidate is string => typeof candidate === "string")
        .map((candidate) => candidate.toLowerCase())
        .filter((candidate) => !/^0x0{64}$/i.test(candidate))
    ),
  ].sort();

  return {
    title,
    description,
    imageUri: imageUri ? resolveIpfsUri(imageUri) : undefined,
    workScopes,
    gardenId,
    attestationUIDs,
    bundleKind,
    commitmentIds,
    needUIDs,
  };
}
