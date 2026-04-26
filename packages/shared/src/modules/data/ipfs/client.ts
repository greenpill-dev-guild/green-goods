import { logger } from "../../app/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface IpfsConfig {
  /** Optional custom IPFS gateway URL */
  gatewayBaseUrl?: string;
  /** Pinata JWT used for authenticated uploads */
  pinataJwt?: string;
  /** Optional Pinata gateway URL (dedicated gateway preferred) */
  pinataGatewayBaseUrl?: string;
  /** Optional Pinata API base URL */
  pinataApiBaseUrl?: string;
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
export const DEFAULT_AVATAR = "/images/avatar.png";

// ============================================================================
// MODULE-LEVEL STATE
// ============================================================================

let gatewayUrl = DEFAULT_PINATA_GATEWAY;
let pinataJwt: string | null = null;
let pinataGatewayUrl: string | null = null;
let pinataUploadsApiBaseUrl = DEFAULT_PINATA_UPLOADS_API_BASE_URL;

let ipfsInitializationStatus: IpfsInitStatus = "not_started";
let ipfsInitializationError: string | null = null;

export function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
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
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
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
    "gatewayBaseUrl" | "pinataJwt" | "pinataGatewayBaseUrl" | "pinataApiBaseUrl"
  >
): void {
  const normalizedGateway =
    normalizeOptionalUrl(config.pinataGatewayBaseUrl) ??
    normalizeOptionalUrl(config.gatewayBaseUrl);

  pinataJwt = config.pinataJwt?.trim() || null;
  pinataGatewayUrl = normalizedGateway ?? (pinataJwt ? DEFAULT_PINATA_GATEWAY : null);
  gatewayUrl = normalizedGateway ?? DEFAULT_PINATA_GATEWAY;
  pinataUploadsApiBaseUrl = normalizePinataUploadsApiUrl(config.pinataApiBaseUrl);
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
    clientReady: Boolean(pinataJwt),
    pinataConfigured: Boolean(pinataGatewayUrl),
    pinataWriteReady: Boolean(pinataJwt),
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

  if (!pinataJwt) {
    const error = new Error("Pinata JWT is not configured");
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
 * Upload env vars:
 * - VITE_PINATA_JWT or PINATA_JWT: Pinata JWT for authenticated uploads
 *
 * Optional read/gateway env vars:
 * - VITE_PINATA_GATEWAY_URL or PINATA_GATEWAY_URL: Pinata gateway URL
 * - VITE_PINATA_API_URL or PINATA_API_URL: Pinata API base URL
 */
export async function initializeIpfsFromEnv(
  env: Record<string, string | undefined> = typeof import.meta !== "undefined"
    ? (import.meta.env as Record<string, string | undefined>)
    : {}
): Promise<boolean> {
  const pinataJwtValue = env?.VITE_PINATA_JWT ?? env?.PINATA_JWT;
  const pinataGatewayBaseUrl = env?.VITE_PINATA_GATEWAY_URL ?? env?.PINATA_GATEWAY_URL;
  const pinataApiBaseUrl = env?.VITE_PINATA_API_URL ?? env?.PINATA_API_URL;
  const pinataReady = Boolean(pinataJwtValue && !isPlaceholderSecret(pinataJwtValue));
  const isTestEnvironment =
    env?.MODE === "test" ||
    env?.NODE_ENV === "test" ||
    (typeof process !== "undefined" && process.env.NODE_ENV === "test") ||
    import.meta.env.MODE === "test";

  configurePinata({
    gatewayBaseUrl: pinataGatewayBaseUrl,
    pinataJwt: pinataJwtValue,
    pinataGatewayBaseUrl,
    pinataApiBaseUrl,
  });

  if (!pinataReady) {
    ipfsInitializationStatus = "skipped_no_config";
    ipfsInitializationError = "Pinata JWT is not configured";

    // Only warn in development, not in CI/production builds with placeholders
    if (import.meta.env.DEV && !isTestEnvironment) {
      if (pinataGatewayBaseUrl) {
        logger.info("IPFS read gateway configured without upload credentials");
      } else {
        logger.warn("VITE_PINATA_JWT is not configured. Upload features will be unavailable.");
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
    });
    return true;
  } catch (err) {
    logger.error("Failed to initialize IPFS upload path", { error: err });
    return false;
  }
}
