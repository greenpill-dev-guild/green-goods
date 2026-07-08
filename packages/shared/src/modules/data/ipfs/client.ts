import { logger } from "../../app/logger";
import { PUBLIC_AGENT_ROUTES } from "../../../public-contracts";

// ============================================================================
// TYPES
// ============================================================================

export interface IpfsConfig {
  /** Optional custom IPFS gateway URL */
  gatewayBaseUrl?: string;
  /** Pinata JWT used for server-side authenticated uploads */
  pinataJwt?: string;
  /** Optional Pinata gateway URL (dedicated gateway preferred) */
  pinataGatewayBaseUrl?: string;
  /** Optional Pinata API base URL */
  pinataApiBaseUrl?: string;
  /** Agent API base URL used for browser signed-upload requests */
  apiBaseUrl?: string;
  /** Override the upload signer URL for tests or same-origin deployments */
  uploadSignUrl?: string;
}

export type IpfsInitStatus =
  | "not_started"
  | "in_progress"
  | "success"
  | "failed"
  | "skipped_no_config";

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_PINATA_GATEWAY = "https://greengoods.mypinata.cloud";
export const DEFAULT_PINATA_UPLOADS_API_BASE_URL = "https://uploads.pinata.cloud/v3";
export const IPFS_FALLBACK_GATEWAYS = ["https://gateway.pinata.cloud", "https://ipfs.io"];
export const PROVIDER_VERIFICATION_ATTEMPTS = 3;
export const PROVIDER_VERIFICATION_TIMEOUT_MS = 5_000;
// Uploads send file bodies, so they get a longer ceiling than the gateway HEAD
// checks above — generous enough not to abort a legitimately slow mobile upload,
// but bounded so a stalled connection fails retryably instead of hanging forever.
export const PINATA_UPLOAD_TIMEOUT_MS = 60_000;
export const PINATA_UPLOAD_SIGN_TIMEOUT_MS = 15_000;
export const DEFAULT_AVATAR = "/images/avatar.png";

// ============================================================================
// MODULE-LEVEL STATE
// ============================================================================

let gatewayUrl = DEFAULT_PINATA_GATEWAY;
let pinataJwt: string | null = null;
let pinataGatewayUrl: string | null = null;
let pinataUploadsApiBaseUrl = DEFAULT_PINATA_UPLOADS_API_BASE_URL;
let pinataUploadSignUrl: string | null = null;

let ipfsInitializationStatus: IpfsInitStatus = "not_started";
let ipfsInitializationError: string | null = null;

const SLASH_CODE = 47;

export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === SLASH_CODE) end--;
  return end === value.length ? value : value.slice(0, end);
}

function trimLeadingSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) === SLASH_CODE) start++;
  return start === 0 ? value : value.slice(start);
}

// ============================================================================
// STATE ACCESSORS
// ============================================================================

export function getGatewayUrl(): string {
  return gatewayUrl;
}

export function getPinataJwt(): string | null {
  return pinataJwt;
}

export function getPinataGatewayUrl(): string | null {
  return pinataGatewayUrl;
}

export function getPinataUploadsApiBaseUrl(): string {
  return pinataUploadsApiBaseUrl;
}

export function getPinataUploadSignUrl(): string | null {
  return pinataUploadSignUrl;
}

export function getIpfsInitializationStatus(): IpfsInitStatus {
  return ipfsInitializationStatus;
}

export function getIpfsInitializationError(): string | null {
  return ipfsInitializationError;
}

// ============================================================================
// STATE MUTATORS (for use by sibling modules)
// ============================================================================

export function setIpfsInitializationStatus(status: IpfsInitStatus): void {
  ipfsInitializationStatus = status;
}

export function setIpfsInitializationError(error: string | null): void {
  ipfsInitializationError = error;
}

// ============================================================================
// PINATA CONFIGURATION
// ============================================================================

function normalizeOptionalUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimTrailingSlashes(trimmed) : null;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${trimTrailingSlashes(baseUrl)}/${trimLeadingSlashes(path)}`;
}

function normalizePinataUploadsApiUrl(value?: string | null): string {
  const normalized = normalizeOptionalUrl(value);
  if (!normalized) return DEFAULT_PINATA_UPLOADS_API_BASE_URL;
  if (/^https:\/\/api\.pinata\.cloud\/?$/i.test(normalized)) {
    return DEFAULT_PINATA_UPLOADS_API_BASE_URL;
  }
  return normalized;
}

export function configurePinata(
  config: Pick<
    IpfsConfig,
    | "gatewayBaseUrl"
    | "pinataJwt"
    | "pinataGatewayBaseUrl"
    | "pinataApiBaseUrl"
    | "apiBaseUrl"
    | "uploadSignUrl"
  >
): void {
  const normalizedGateway =
    normalizeOptionalUrl(config.pinataGatewayBaseUrl) ??
    normalizeOptionalUrl(config.gatewayBaseUrl);
  const normalizedApiBaseUrl = normalizeOptionalUrl(config.apiBaseUrl);

  pinataJwt = config.pinataJwt?.trim() || null;
  pinataGatewayUrl = normalizedGateway ?? (pinataJwt ? DEFAULT_PINATA_GATEWAY : null);
  gatewayUrl = normalizedGateway ?? DEFAULT_PINATA_GATEWAY;
  pinataUploadsApiBaseUrl = normalizePinataUploadsApiUrl(config.pinataApiBaseUrl);
  pinataUploadSignUrl =
    normalizeOptionalUrl(config.uploadSignUrl) ??
    (normalizedApiBaseUrl ? joinUrl(normalizedApiBaseUrl, PUBLIC_AGENT_ROUTES.uploadSign) : null);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Returns the current IPFS initialization status
 */
export function getIpfsInitStatus() {
  return {
    status: ipfsInitializationStatus,
    error: ipfsInitializationError,
    clientReady: Boolean(pinataUploadSignUrl || pinataJwt),
    pinataConfigured: Boolean(pinataGatewayUrl),
    pinataWriteReady: Boolean(pinataUploadSignUrl || pinataJwt),
  };
}

/**
 * Initializes the Pinata-backed IPFS upload path.
 */
export async function initializeIpfs(config: IpfsConfig): Promise<{ gatewayUrl: string }> {
  const startTime = Date.now();
  ipfsInitializationStatus = "in_progress";
  ipfsInitializationError = null;
  configurePinata(config);

  if (!pinataUploadSignUrl && !pinataJwt) {
    const error = new Error("IPFS upload signer endpoint is not configured");
    ipfsInitializationStatus = "failed";
    ipfsInitializationError = error.message;
    logger.error("Failed to initialize IPFS upload path", { error });
    throw error;
  }

  ipfsInitializationStatus = "success";
  logger.info(`IPFS upload path initialized with Pinata (${Date.now() - startTime}ms)`);

  return { gatewayUrl: getGatewayUrl() };
}

/**
 * Check if a value is a placeholder/dummy secret (used in CI builds)
 */
function isPlaceholderSecret(value: string | undefined): boolean {
  if (!value) return true;
  const lowerValue = value.toLowerCase();
  return (
    lowerValue.includes("dummy") ||
    lowerValue.includes("placeholder") ||
    lowerValue.includes("example")
  );
}

/**
 * Convenience initializer that reads Vite-style env vars.
 * Returns true on successful initialization, false if missing configuration.
 *
 * Browser upload env vars:
 * - VITE_API_BASE_URL: Agent API base URL for signed Pinata upload URLs
 *
 * Optional server upload and read/gateway env vars:
 * - PINATA_JWT: Pinata JWT for authenticated server-side uploads
 * - VITE_PINATA_GATEWAY_URL or PINATA_GATEWAY_URL: Pinata gateway URL
 * - PINATA_API_URL: Pinata API base URL for server-side direct uploads
 */
export async function initializeIpfsFromEnv(
  env: Record<string, string | undefined> = typeof import.meta !== "undefined"
    ? (import.meta.env as Record<string, string | undefined>)
    : {}
): Promise<boolean> {
  const pinataJwtValue = env?.PINATA_JWT;
  const pinataGatewayBaseUrl = env?.VITE_PINATA_GATEWAY_URL ?? env?.PINATA_GATEWAY_URL;
  const pinataApiBaseUrl = env?.PINATA_API_URL;
  const apiBaseUrl = env?.VITE_API_BASE_URL;
  const uploadSignerReady = Boolean(apiBaseUrl && !isPlaceholderSecret(apiBaseUrl));
  const directPinataReady = Boolean(pinataJwtValue && !isPlaceholderSecret(pinataJwtValue));
  const isTestEnvironment =
    env?.MODE === "test" ||
    env?.NODE_ENV === "test" ||
    (typeof process !== "undefined" && process.env.NODE_ENV === "test") ||
    (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test");

  configurePinata({
    gatewayBaseUrl: pinataGatewayBaseUrl,
    pinataJwt: pinataJwtValue,
    pinataGatewayBaseUrl,
    pinataApiBaseUrl,
    apiBaseUrl,
  });

  if (!uploadSignerReady && !directPinataReady) {
    ipfsInitializationStatus = "skipped_no_config";
    ipfsInitializationError = "IPFS upload signer endpoint is not configured";

    // Only warn in development, not in CI/production builds with placeholders
    if (import.meta.env.DEV && !isTestEnvironment) {
      if (pinataGatewayBaseUrl) {
        logger.info("IPFS read gateway configured without upload credentials");
      } else {
        logger.warn("VITE_API_BASE_URL is not configured. Upload features will be unavailable.");
      }
    }
    return false;
  }

  try {
    await initializeIpfs({
      gatewayBaseUrl: pinataGatewayBaseUrl,
      pinataJwt: pinataJwtValue,
      pinataGatewayBaseUrl,
      pinataApiBaseUrl,
      apiBaseUrl,
    });
    return true;
  } catch (err) {
    logger.error("Failed to initialize IPFS upload path", { error: err });
    return false;
  }
}
