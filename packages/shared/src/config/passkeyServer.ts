/**
 * Pimlico Passkey Server Client
 *
 * Creates a client for interacting with Pimlico's passkey server infrastructure.
 * Server-side credential storage eliminates localStorage serialization issues.
 *
 * Reference: https://docs.pimlico.io/guides/how-to/signers/passkey-server
 */

import type { Chain } from "viem";
import { createWebAuthnCredential, type P256Credential } from "viem/account-abstraction";
import { setStoredRpId } from "../modules/auth/session";
import { getChain } from "./chains";
import { getPimlicoApiKey } from "./pimlico";

// ============================================================================
// TYPES
// ============================================================================

export interface PasskeyServerClient {
  chain: Chain;
  baseUrl: string;

  /**
   * Start passkey registration flow
   * Returns WebAuthn creation options from Pimlico server
   */
  startRegistration: (params: {
    context: { userName: string };
  }) => Promise<CredentialCreationOptions>;

  /**
   * Verify registration and store credential on Pimlico server
   */
  verifyRegistration: (params: {
    credential: P256Credential;
    context: { userName: string };
  }) => Promise<P256Credential>;

  /**
   * Retrieve stored credentials for a user from Pimlico server
   */
  getCredentials: (params: { context: { userName: string } }) => Promise<P256Credential[]>;
}

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

/**
 * Default timeout for Pimlico server RPC calls (in milliseconds)
 * Passkey operations can take time due to user interaction, so we set a reasonable limit
 */
const PIMLICO_RPC_TIMEOUT = 15_000; // 15 seconds

/**
 * Custom error class for Pimlico server timeouts
 */
export class PimlicoTimeoutError extends Error {
  constructor(method: string, timeoutMs: number) {
    super(
      `Pimlico server request timed out after ${timeoutMs / 1000}s (method: ${method}). ` +
        "This may indicate an invalid API key or network issues."
    );
    this.name = "PimlicoTimeoutError";
  }
}

/**
 * Custom error class for Pimlico server errors
 */
export class PimlicoServerError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = "PimlicoServerError";
    this.code = code;
  }
}

// ============================================================================
// JSON-RPC CLIENT
// ============================================================================

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Make a JSON-RPC call to Pimlico server with timeout handling
 *
 * @param baseUrl - Pimlico API endpoint URL
 * @param method - RPC method name (e.g., pks_startRegistration)
 * @param params - Method parameters
 * @param timeoutMs - Request timeout in milliseconds (default: 15s)
 */
async function jsonRpcCall<T>(
  baseUrl: string,
  method: string,
  params: unknown[],
  timeoutMs: number = PIMLICO_RPC_TIMEOUT
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Handle common HTTP errors with helpful messages
      if (response.status === 401 || response.status === 403) {
        throw new PimlicoServerError(
          "Invalid or missing Pimlico API key. Please check your VITE_PIMLICO_API_KEY configuration.",
          response.status
        );
      }
      throw new PimlicoServerError(
        `HTTP error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as JsonRpcResponse<T>;

    if (data.error) {
      throw new PimlicoServerError(
        data.error.message || `RPC error: ${data.error.code}`,
        data.error.code
      );
    }

    return data.result as T;
  } catch (error) {
    // Handle abort (timeout)
    if (error instanceof Error && error.name === "AbortError") {
      throw new PimlicoTimeoutError(method, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// PIMLICO PASSKEY SERVER CLIENT
// ============================================================================

/**
 * Create a Pimlico passkey server client
 *
 * This client handles credential storage on Pimlico's server, eliminating
 * the need for localStorage credential management.
 *
 * @param chainId - Chain ID for operations
 * @returns PasskeyServerClient instance
 */
export function createPasskeyServerClient(chainId: number): PasskeyServerClient {
  const pimlicoApiKey = getPimlicoApiKey();
  const chain = getChain(chainId);
  const baseUrl = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoApiKey}`;

  return {
    chain,
    baseUrl,

    /**
     * Start registration - request WebAuthn options from Pimlico server
     * Uses pks_startRegistration RPC method
     */
    startRegistration: async (params) => {
      const result = await jsonRpcCall<PublicKeyCredentialCreationOptions>(
        baseUrl,
        "pks_startRegistration",
        [{ userName: params.context.userName }]
      );

      // Convert challenge from base64url to ArrayBuffer if needed
      if (result.challenge && typeof result.challenge === "string") {
        result.challenge = base64UrlToBuffer(result.challenge);
      }

      // Convert user.id from base64url to ArrayBuffer if needed
      if (result.user?.id && typeof result.user.id === "string") {
        result.user.id = base64UrlToBuffer(result.user.id);
      }

      // Convert excludeCredentials ids if present
      if (result.excludeCredentials) {
        result.excludeCredentials = result.excludeCredentials.map((cred) => ({
          ...cred,
          id: typeof cred.id === "string" ? base64UrlToBuffer(cred.id) : cred.id,
        }));
      }

      return { publicKey: result };
    },

    /**
     * Verify registration - send credential to Pimlico server for storage
     * Uses pks_verifyRegistration RPC method
     */
    verifyRegistration: async (params) => {
      // Prepare credential for RPC (ensure proper serialization)
      const credentialPayload = {
        id: params.credential.id,
        rawId: params.credential.id,
        response: params.credential.raw?.response
          ? {
              clientDataJSON: bufferToBase64Url(
                (params.credential.raw as PublicKeyCredential).response.clientDataJSON
              ),
              attestationObject: bufferToBase64Url(
                (
                  (params.credential.raw as PublicKeyCredential)
                    .response as AuthenticatorAttestationResponse
                ).attestationObject
              ),
            }
          : undefined,
        type: "public-key",
        authenticatorAttachment: "platform",
        clientExtensionResults: {},
      };

      const result = await jsonRpcCall<{
        success: boolean;
        id: string;
        publicKey: string;
      }>(baseUrl, "pks_verifyRegistration", [
        credentialPayload,
        { userName: params.context.userName },
      ]);

      if (!result.success) {
        throw new Error("Passkey verification failed");
      }

      // Return credential with server-verified data
      return {
        id: result.id,
        publicKey: result.publicKey as `0x${string}`,
        raw: params.credential.raw,
      } as P256Credential;
    },

    /**
     * Get credentials - retrieve stored credentials from Pimlico server
     * Uses pks_getCredentials RPC method
     */
    getCredentials: async (params) => {
      const result = await jsonRpcCall<Array<{ id: string; publicKey: string }>>(
        baseUrl,
        "pks_getCredentials",
        [{ userName: params.context.userName }]
      );

      // Convert to P256Credential format
      // Note: raw is not available from server-stored credentials
      return result.map((cred) => ({
        id: cred.id,
        publicKey: cred.publicKey as `0x${string}`,
        raw: undefined as unknown as PublicKeyCredential,
      })) as P256Credential[];
    },
  };
}

// ============================================================================
// BUFFER CONVERSION HELPERS
// ============================================================================

/**
 * Convert base64url string to ArrayBuffer
 */
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  // Replace URL-safe chars and add padding
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  if (padding === 2) base64 += "==";
  else if (padding === 3) base64 += "=";

  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Convert ArrayBuffer to base64url string
 */
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ============================================================================
// CREDENTIAL CREATION HELPER
// ============================================================================

/**
 * Create WebAuthn credential using Pimlico server options
 *
 * This is the main entry point for credential creation when using
 * the Pimlico passkey server flow.
 *
 * IMPORTANT: Explicitly sets RP ID to current hostname for Android compatibility.
 * Android is strict about RP ID matching between registration and authentication.
 */
export async function createPasskeyWithServer(
  serverClient: PasskeyServerClient,
  userName: string
): Promise<P256Credential> {
  // 1. Get registration options from Pimlico server
  const options = await serverClient.startRegistration({
    context: { userName },
  });

  // 2. Capture current hostname as RP ID for Android compatibility
  const rpId = window.location.hostname;

  // 3. Create credential using WebAuthn
  const credential = await createWebAuthnCredential({
    name: "Green Goods Wallet",
    createFn: async (viemOptions) => {
      // Merge server options with viem defaults
      const mergedOptions = viemOptions as CredentialCreationOptions | undefined;
      if (mergedOptions?.publicKey && options.publicKey) {
        // Use server-provided options
        Object.assign(mergedOptions.publicKey, options.publicKey);
        // Override RP ID to ensure consistency with authentication
        mergedOptions.publicKey.rp = {
          ...mergedOptions.publicKey.rp,
          id: rpId,
          name: mergedOptions.publicKey.rp?.name ?? "Green Goods",
        };
      }
      return window.navigator.credentials.create(mergedOptions);
    },
  });

  // 4. Store RP ID for authentication (Android requires exact match)
  setStoredRpId(rpId);

  // 5. Verify and store on Pimlico server
  const verifiedCredential = await serverClient.verifyRegistration({
    credential,
    context: { userName },
  });

  return verifiedCredential;
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

/**
 * Check if Pimlico passkey server is available
 * Returns true if API key is configured
 */
export function isPasskeyServerAvailable(): boolean {
  try {
    getPimlicoApiKey();
    return true;
  } catch {
    return false;
  }
}
