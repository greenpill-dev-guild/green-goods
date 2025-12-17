/**
 * Pimlico Passkey Server Client
 *
 * Creates a client for interacting with Pimlico's passkey server infrastructure.
 * This replaces local localStorage credential management with server-side storage.
 *
 * Note: This is a placeholder implementation. The actual Pimlico passkey server
 * API methods will need to be updated once the official API is available.
 * For now, this provides the interface and falls back to local storage.
 *
 * Reference: https://docs.pimlico.io/guides/how-to/signers/passkey-server
 */

import { type Chain } from "viem";
import { type P256Credential, createWebAuthnCredential } from "viem/account-abstraction";
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
   * Returns WebAuthn creation options
   */
  startRegistration: (params: {
    context: { userName: string };
  }) => Promise<PublicKeyCredentialCreationOptions>;

  /**
   * Verify registration and store credential on server
   */
  verifyRegistration: (params: {
    credential: P256Credential;
    context: { userName: string };
  }) => Promise<P256Credential>;

  /**
   * Retrieve stored credentials for a user
   */
  getCredentials: (params: { context: { userName: string } }) => Promise<P256Credential[]>;
}

export interface RegistrationContext {
  userName: string;
}

// ============================================================================
// JSON-RPC HELPER
// ============================================================================

async function jsonRpcRequest(
  baseUrl: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "RPC request failed");
  }

  return data.result;
}

// ============================================================================
// CLIENT CREATION
// ============================================================================

/**
 * Create a Pimlico passkey server client for credential management
 *
 * Note: This implementation provides the interface for future Pimlico server
 * integration. The actual RPC methods may need adjustment based on Pimlico's API.
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

    // Start registration - request WebAuthn options from server
    // NOTE: This is a placeholder - actual Pimlico API TBD
    startRegistration: async (params) => {
      try {
        const response = await jsonRpcRequest(baseUrl, "pimlico_startPasskeyRegistration", [
          { userName: params.context.userName },
        ]);
        return response as PublicKeyCredentialCreationOptions;
      } catch (error) {
        // Fallback: return minimal options for local credential creation
        console.warn("[PasskeyServer] Server registration not available, using local fallback");
        return {
          challenge: new Uint8Array(32),
          rp: { name: "Green Goods", id: window.location.hostname },
          user: {
            id: new Uint8Array(16),
            name: params.context.userName,
            displayName: params.context.userName,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
        } as PublicKeyCredentialCreationOptions;
      }
    },

    // Verify registration - send credential to server for storage
    // NOTE: This is a placeholder - actual Pimlico API TBD
    verifyRegistration: async (params) => {
      try {
        const response = await jsonRpcRequest(baseUrl, "pimlico_verifyPasskeyRegistration", [
          {
            userName: params.context.userName,
            credential: {
              id: params.credential.id,
              publicKey: params.credential.publicKey,
            },
          },
        ]);
        return response as P256Credential;
      } catch (error) {
        // Fallback: return the credential as-is (stored locally)
        console.warn("[PasskeyServer] Server verification not available, using local fallback");
        return params.credential;
      }
    },

    // Get credentials - retrieve stored credentials from server
    // NOTE: This is a placeholder - actual Pimlico API TBD
    getCredentials: async (params) => {
      try {
        const response = await jsonRpcRequest(baseUrl, "pimlico_getPasskeyCredentials", [
          { userName: params.context.userName },
        ]);
        return (response as P256Credential[]) || [];
      } catch (error) {
        // Fallback: return empty array (credentials stored locally)
        console.warn("[PasskeyServer] Server credentials not available, using local fallback");
        return [];
      }
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create WebAuthn credential with custom options
 * Wrapper around viem's createWebAuthnCredential with our defaults
 */
export async function createPasskeyCredential(
  options?: PublicKeyCredentialCreationOptions
): Promise<P256Credential> {
  return createWebAuthnCredential({
    name: "Green Goods Wallet",
    createFn: async (createOptions) => {
      const credentialOptions = createOptions as CredentialCreationOptions | undefined;
      const publicKeyOptions = credentialOptions?.publicKey;

      // Merge with provided options
      if (publicKeyOptions && options) {
        Object.assign(publicKeyOptions, options);
      }

      // Ensure algorithm support
      if (publicKeyOptions) {
        const existing = publicKeyOptions.pubKeyCredParams ?? [];
        const defaults: PublicKeyCredentialParameters[] = [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ];
        const merged = defaults.concat(existing);
        const deduped: PublicKeyCredentialParameters[] = [];
        const seen = new Set<number>();

        for (const param of merged) {
          if (seen.has(param.alg)) continue;
          seen.add(param.alg);
          deduped.push(param);
        }

        publicKeyOptions.pubKeyCredParams = deduped;
      }

      return window.navigator.credentials.create(credentialOptions);
    },
  });
}

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
