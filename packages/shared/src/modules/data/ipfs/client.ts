import { type Client, create } from "@storacha/client";
import { trackUploadError } from "../../app/error-tracking";
import { logger } from "../../app/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface IpfsConfig {
  /** Base64-encoded ed25519 private key */
  key: string;
  /** Base64-encoded UCAN delegation proof */
  proof: string;
  /** Optional custom IPFS gateway URL */
  gatewayBaseUrl?: string;
  /** Optional Pinata JWT for secondary pinning */
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
// MODULE-LEVEL STATE
// ============================================================================

let storachaClient: Client | null = null;
let gatewayUrl = "https://storacha.link";
let pinataJwt: string | null = null;
let pinataGatewayUrl: string | null = null;
let pinataUploadsApiBaseUrl = "https://uploads.pinata.cloud/v3";

let ipfsInitializationStatus: IpfsInitStatus = "not_started";
let ipfsInitializationError: string | null = null;

// ============================================================================
// CONSTANTS
// ============================================================================

export const IPFS_FALLBACK_GATEWAYS = [
  "https://greengoods.mypinata.cloud",
  "https://storacha.link",
];
export const DEFAULT_PINATA_GATEWAY = "https://greengoods.mypinata.cloud";
export const DEFAULT_PINATA_UPLOADS_API_BASE_URL = "https://uploads.pinata.cloud/v3";
export const PROVIDER_VERIFICATION_ATTEMPTS = 3;
export const PROVIDER_VERIFICATION_TIMEOUT_MS = 5_000;
export const DEFAULT_AVATAR = "/images/avatar.png";

export function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

// ============================================================================
// STATE ACCESSORS
// ============================================================================

export function getStorachaClient(): Client | null {
  return storachaClient;
}

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
  config: Pick<IpfsConfig, "pinataJwt" | "pinataGatewayBaseUrl" | "pinataApiBaseUrl">
): void {
  pinataJwt = config.pinataJwt?.trim() || null;
  pinataGatewayUrl =
    normalizeOptionalUrl(config.pinataGatewayBaseUrl) ??
    (pinataJwt ? DEFAULT_PINATA_GATEWAY : null);
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
    clientReady: storachaClient !== null,
    pinataConfigured: Boolean(pinataGatewayUrl),
    pinataWriteReady: Boolean(pinataJwt),
  };
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
  configurePinata(config);

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
 * - VITE_PINATA_JWT or PINATA_JWT: Pinata JWT for secondary pinning
 * - VITE_PINATA_GATEWAY_URL or PINATA_GATEWAY_URL: Pinata gateway URL
 * - VITE_PINATA_API_URL or PINATA_API_URL: Pinata API base URL
 */
export async function initializeIpfsFromEnv(
  env: Record<string, string | undefined> = typeof import.meta !== "undefined"
    ? (import.meta.env as Record<string, string | undefined>)
    : {}
): Promise<boolean> {
  const key = env?.VITE_STORACHA_KEY;
  const proof = env?.VITE_STORACHA_PROOF;
  const gatewayBaseUrl = env?.VITE_STORACHA_GATEWAY;
  const pinataJwtValue = env?.VITE_PINATA_JWT ?? env?.PINATA_JWT;
  const pinataGatewayBaseUrl = env?.VITE_PINATA_GATEWAY_URL ?? env?.PINATA_GATEWAY_URL;
  const pinataApiBaseUrl = env?.VITE_PINATA_API_URL ?? env?.PINATA_API_URL;
  const pinataReady = Boolean(pinataJwtValue && !isPlaceholderCredential(pinataJwtValue));

  configurePinata({
    pinataJwt: pinataJwtValue,
    pinataGatewayBaseUrl,
    pinataApiBaseUrl,
  });

  // Skip initialization if credentials are missing or are placeholder values (CI builds)
  if (!key || !proof || isPlaceholderCredential(key) || isPlaceholderCredential(proof)) {
    if (pinataReady) {
      ipfsInitializationStatus = "success";
      ipfsInitializationError = null;
      if (import.meta.env.DEV) {
        logger.info("Pinata upload path configured without Storacha credentials");
      }
      return true;
    }

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
    await initializeIpfs({
      key,
      proof,
      gatewayBaseUrl,
      pinataJwt: pinataJwtValue,
      pinataGatewayBaseUrl,
      pinataApiBaseUrl,
    });
    return true;
  } catch (err) {
    logger.error("Failed to initialize Storacha", { error: err });
    return false;
  }
}
