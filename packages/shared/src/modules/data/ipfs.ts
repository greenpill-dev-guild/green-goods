import { type Client, create } from "@storacha/client";
import {
  trackUploadError,
  trackUploadSuccess,
  type UploadErrorCategory,
} from "../app/error-tracking";
import { logger } from "../app/logger";

interface IpfsConfig {
  /** Base64-encoded ed25519 private key */
  key: string;
  /** Base64-encoded UCAN delegation proof */
  proof: string;
  /** Optional custom IPFS gateway URL */
  gatewayBaseUrl?: string;
}

let storachaClient: Client | null = null;
let gatewayUrl = "https://storacha.link";

type IpfsInitStatus = "not_started" | "in_progress" | "success" | "failed" | "skipped_no_config";

let ipfsInitializationStatus: IpfsInitStatus = "not_started";
let ipfsInitializationError: string | null = null;
const DEFAULT_IPFS_GATEWAYS = ["https://storacha.link", "https://w3s.link", "https://ipfs.io"];

/**
 * Returns the current IPFS initialization status
 */
export function getIpfsInitStatus() {
  return {
    status: ipfsInitializationStatus,
    error: ipfsInitializationError,
    clientReady: storachaClient !== null,
  };
}

const DEFAULT_AVATAR = "/images/avatar.png";

// ============================================================================
// SHARED UPLOAD UTILITIES
// ============================================================================

/**
 * Gets network context for error tracking
 */
function getNetworkContext() {
  if (typeof navigator === "undefined") return { isOnline: true };
  const conn = navigator as unknown as { connection?: { effectiveType?: string } };
  return {
    is_online: navigator.onLine,
    connection_type: conn.connection?.effectiveType,
  };
}

/**
 * Common upload handler that wraps Storacha upload with error tracking
 */
async function executeUpload<TContext extends { source?: string; gardenAddress?: string }>(
  uploadFn: () => Promise<{ cid: { toString(): string } }>,
  category: UploadErrorCategory,
  context: TContext,
  fileInfo: { size: number; type: string; name?: string; index?: number; total?: number }
): Promise<{ cid: string }> {
  const startTime = Date.now();

  if (!storachaClient) {
    const error = new Error("Storacha not initialized. Call initializeIpfs() first.");
    trackUploadError(error, {
      uploadCategory: category,
      ipfsStatus: ipfsInitializationStatus,
      fileIndex: fileInfo.index,
      totalFiles: fileInfo.total,
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      fileName: fileInfo.name,
      source: context.source ?? "executeUpload",
      gardenAddress: context.gardenAddress,
      severity: "error",
      recoverable: false,
      metadata: { storacha_error: ipfsInitializationError },
    });
    throw error;
  }

  try {
    const result = await uploadFn();
    const cid = result.cid.toString();
    const uploadDuration = Date.now() - startTime;

    trackUploadSuccess({
      uploadCategory: category,
      fileIndex: fileInfo.index,
      totalFiles: fileInfo.total,
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      uploadDurationMs: uploadDuration,
      cid,
      source: context.source ?? "executeUpload",
      gardenAddress: context.gardenAddress,
    });

    return { cid };
  } catch (error) {
    const uploadDuration = Date.now() - startTime;
    logger.error(`Failed to upload to Storacha (${category})`, { error });

    trackUploadError(error, {
      uploadCategory: category,
      ipfsStatus: ipfsInitializationStatus,
      uploadDurationMs: uploadDuration,
      fileIndex: fileInfo.index,
      totalFiles: fileInfo.total,
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      fileName: fileInfo.name,
      source: context.source ?? "executeUpload",
      gardenAddress: context.gardenAddress,
      severity: "error",
      recoverable: true,
      metadata: getNetworkContext(),
    });

    throw error;
  }
}

/**
 * Initializes the Storacha IPFS client with delegation-based authentication.
 *
 * This uses pre-generated credentials (key + proof) for non-interactive
 * initialization, suitable for client apps and CI/CD workflows.
 *
 * To generate credentials:
 * 1. Install CLI: npm i -g @storacha/cli
 * 2. Login: storacha login <your-email>
 * 3. Create space: storacha space create green-goods
 * 4. Create key: storacha key create --json (save the "key" field)
 * 5. Create delegation: storacha delegation create <did:key:...> -c space/blob/add -c space/index/add -c upload/add -c filecoin/offer --base64
 */
export async function initializeIpfs(config: IpfsConfig): Promise<{
  client: Client;
  gatewayUrl: string;
}> {
  const startTime = Date.now();
  ipfsInitializationStatus = "in_progress";
  ipfsInitializationError = null;

  try {
    // Dynamic imports for subpath exports (workaround for TypeScript/bundler resolution)
    const [{ Signer }, { parse: parseProof }] = await Promise.all([
      import("@storacha/client/principal/ed25519"),
      import("@storacha/client/proof"),
    ]);

    // Parse the principal (signing key) from base64
    const principal = Signer.parse(config.key);

    // Create client with the principal
    storachaClient = await create({ principal });

    // Parse and add the space delegation proof
    const proof = await parseProof(config.proof);
    const space = await storachaClient.addSpace(proof);

    // Set as current space for uploads
    await storachaClient.setCurrentSpace(space.did());

    // Set custom gateway if provided
    if (config.gatewayBaseUrl) {
      gatewayUrl = config.gatewayBaseUrl;
    }

    ipfsInitializationStatus = "success";
    logger.info(`Storacha initialized (${Date.now() - startTime}ms) - Space: ${space.did()}`);

    return { client: storachaClient, gatewayUrl };
  } catch (error) {
    ipfsInitializationStatus = "failed";
    ipfsInitializationError = error instanceof Error ? error.message : String(error);
    logger.error("Failed to initialize Storacha client", { error });

    // Track initialization failure
    trackUploadError(error, {
      uploadCategory: "ipfs_init",
      ipfsStatus: "failed",
      source: "initializeIpfs",
      severity: "fatal",
      recoverable: false,
      metadata: {
        init_duration_ms: Date.now() - startTime,
      },
    });

    throw error;
  }
}

/**
 * Context for tracking individual file uploads within a batch.
 * Pass this to get detailed tracking for each file in a multi-file upload.
 */
export interface FileUploadContext {
  /** Index of this file in the batch (0-based) */
  fileIndex?: number;
  /** Total number of files in the batch */
  totalFiles?: number;
  /** Source function/component initiating the upload */
  source?: string;
  /** Garden address if relevant */
  gardenAddress?: string;
  /** Auth mode if relevant */
  authMode?: "passkey" | "wallet" | null;
  /** Optional callback fired when this file upload completes or fails */
  onFileProgress?: (event: {
    fileIndex?: number;
    totalFiles?: number;
    status: "uploaded" | "failed";
  }) => void;
}

/**
 * Uploads a file to IPFS using Storacha with comprehensive error tracking.
 *
 * @param file - The file to upload
 * @param context - Optional context for batch tracking
 * @returns Object containing the IPFS CID
 * @throws Error if Storacha not initialized or upload fails
 */
export async function uploadFileToIPFS(
  file: File,
  context: FileUploadContext = {}
): Promise<{ cid: string }> {
  try {
    const result = await executeUpload(
      async () => ({ cid: await storachaClient!.uploadFile(file) }),
      "file_upload",
      { source: context.source ?? "uploadFileToIPFS", gardenAddress: context.gardenAddress },
      {
        size: file.size,
        type: file.type,
        name: file.name,
        index: context.fileIndex,
        total: context.totalFiles,
      }
    );

    context.onFileProgress?.({
      fileIndex: context.fileIndex,
      totalFiles: context.totalFiles,
      status: "uploaded",
    });

    return result;
  } catch (error) {
    context.onFileProgress?.({
      fileIndex: context.fileIndex,
      totalFiles: context.totalFiles,
      status: "failed",
    });
    throw error;
  }
}

/**
 * Context for tracking JSON metadata uploads.
 */
export interface JsonUploadContext {
  /** Source function/component initiating the upload */
  source?: string;
  /** Garden address if relevant */
  gardenAddress?: string;
  /** Auth mode if relevant */
  authMode?: "passkey" | "wallet" | null;
  /** Type of metadata being uploaded */
  metadataType?: string;
}

/**
 * Uploads JSON metadata to IPFS using Storacha with comprehensive error tracking.
 *
 * @param json - The JSON object to upload
 * @param context - Optional context for tracking
 * @returns Object containing the IPFS CID
 * @throws Error if Storacha not initialized or upload fails
 */
export async function uploadJSONToIPFS(
  json: Record<string, unknown>,
  context: JsonUploadContext = {}
): Promise<{ cid: string }> {
  const jsonString = JSON.stringify(json);
  const blob = new Blob([jsonString], { type: "application/json" });
  const file = new File([blob], "metadata.json", { type: "application/json" });

  return executeUpload(
    async () => ({ cid: await storachaClient!.uploadFile(file) }),
    "json_upload",
    { source: context.source ?? "uploadJSONToIPFS", gardenAddress: context.gardenAddress },
    { size: file.size, type: "application/json", name: "metadata.json" }
  );
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, "");
}

function isPotentialIpfsCid(value: string): boolean {
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z0-9]{20,})$/i.test(value);
}

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

function getIPFSGatewayCandidates(value: string, customGateway?: string): string[] {
  const parsed = parseIPFSReference(value);
  if (!parsed) {
    return [value];
  }

  const originalGatewayCandidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : null;

  const bases = Array.from(
    new Set(
      [customGateway, gatewayUrl, ...DEFAULT_IPFS_GATEWAYS]
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => trimTrailingSlashes(entry))
    )
  );

  return Array.from(
    new Set([originalGatewayCandidate, ...bases.map((base) => `${base}/ipfs/${parsed.canonicalId}`)])
  ).filter((candidate): candidate is string => Boolean(candidate));
}

export function tryParseJson<T = unknown>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function readBlobAsText(blob: Blob): Promise<string> {
  return blob.text();
}

async function readFetchedDataAsText(data: Blob | string): Promise<string> {
  return typeof data === "string" ? data : readBlobAsText(data);
}

/**
 * Resolves an IPFS URL to a proper gateway URL for image display
 */
export function resolveIPFSUrl(url: string, customGateway?: string): string {
  if (!url) return "";
  const parsed = parseIPFSReference(url);
  if (!parsed) return url;

  const base = trimTrailingSlashes(customGateway || gatewayUrl);
  return `${base}/ipfs/${parsed.canonicalId}`;
}

/**
 * Fetches a file from IPFS by its hash/CID using the gateway
 */
export interface GetFileByHashOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

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
/**
 * Check if a value is a placeholder/dummy credential (used in CI builds)
 */
function isPlaceholderCredential(value: string | undefined): boolean {
  if (!value) return true;
  const lowerValue = value.toLowerCase();
  return (
    lowerValue.includes("dummy") ||
    lowerValue.includes("placeholder") ||
    lowerValue.includes("example") ||
    value.length < 20 // Valid Storacha keys are much longer
  );
}

/**
 * Convenience initializer that reads Vite-style env vars.
 * Returns true on successful initialization, false if missing configuration.
 *
 * Required env vars:
 * - VITE_STORACHA_KEY: Base64-encoded ed25519 private key
 * - VITE_STORACHA_PROOF: Base64-encoded UCAN delegation proof
 *
 * Optional:
 * - VITE_STORACHA_GATEWAY: Custom IPFS gateway URL (default: https://storacha.link)
 */
export async function initializeIpfsFromEnv(
  env: Record<string, string | undefined> = typeof import.meta !== "undefined"
    ? (import.meta.env as Record<string, string | undefined>)
    : {}
): Promise<boolean> {
  const key = env?.VITE_STORACHA_KEY;
  const proof = env?.VITE_STORACHA_PROOF;
  const gatewayBaseUrl = env?.VITE_STORACHA_GATEWAY;

  // Skip initialization if credentials are missing or are placeholder values (CI builds)
  if (!key || !proof || isPlaceholderCredential(key) || isPlaceholderCredential(proof)) {
    ipfsInitializationStatus = "skipped_no_config";
    // Only warn in development, not in CI/production builds with placeholders
    if (import.meta.env.DEV) {
      logger.warn(
        "VITE_STORACHA_KEY and VITE_STORACHA_PROOF are not configured. " +
          "Media features will be unavailable. " +
          "See: https://docs.storacha.network/how-to/upload-from-ci/"
      );
    }
    return false;
  }

  try {
    await initializeIpfs({ key, proof, gatewayBaseUrl });
    return true;
  } catch (err) {
    logger.error("Failed to initialize Storacha", { error: err });
    return false;
  }
}

// Storacha aliases (preferred naming)
export const initializeStoracha = initializeIpfs;
export const initializeStorachaFromEnv = initializeIpfsFromEnv;

// Backward compatibility aliases (deprecated - will be removed in future version)
/** @deprecated Use initializeIpfs or initializeStoracha instead */
export const initializePinata = initializeIpfs;
/** @deprecated Use initializeIpfsFromEnv or initializeStorachaFromEnv instead */
export const initializePinataFromEnv = initializeIpfsFromEnv;
