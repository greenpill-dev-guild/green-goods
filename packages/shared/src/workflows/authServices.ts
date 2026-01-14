/**
 * Authentication Services for XState Machine
 *
 * These services handle the async operations for the auth machine,
 * using Pimlico's passkey server for credential storage.
 *
 * Services:
 * - restoreSession: Check for existing session on app start
 * - registerPasskey: Create new passkey (new user)
 * - authenticatePasskey: Login with existing passkey (returning user)
 * - claimENS: Claim ENS subdomain on mainnet
 *
 * Reference: https://docs.pimlico.io/guides/how-to/signers/passkey-server
 */

import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { encodeFunctionData, type Hex, http } from "viem";
import {
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import { fromPromise } from "xstate";

import { getChain } from "../config/chains";
import {
  createPasskeyServerClient,
  createPasskeyWithServer,
  getPasskeyRpId,
  type PasskeyServerClient,
} from "../config/passkeyServer";
import {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getPimlicoBundlerUrl,
} from "../config/pimlico";
import {
  trackAuthPasskeyLoginFailed,
  trackAuthPasskeyLoginStarted,
  trackAuthPasskeyLoginSuccess,
  trackAuthPasskeyRegisterFailed,
  trackAuthPasskeyRegisterStarted,
  trackAuthPasskeyRegisterSuccess,
  trackAuthSessionRestored,
} from "../modules/app/analytics-events";
import {
  clearStoredUsername,
  getStoredUsername,
  setStoredUsername,
} from "../modules/auth/session";

import type { PasskeySessionResult, RestoreSessionResult } from "./authMachine";

// ============================================================================
// TYPES
// ============================================================================

/** Input for passkey operations (register/authenticate) */
interface PasskeyInput {
  passkeyClient: PasskeyServerClient | null;
  userName: string | null;
  chainId: number;
}

/** Input for session restore (no userName needed - read from storage) */
interface RestoreInput {
  passkeyClient: PasskeyServerClient | null;
  chainId: number;
}

/** Input for ENS claiming */
interface ClaimENSInput {
  smartAccountClient: SmartAccountClient | null;
  name: string;
}

const DEFAULT_SPONSORSHIP_POLICY_ID = "sp_next_monster_badoon";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Decode a credential ID from base64URL or hex format to Uint8Array.
 * WebAuthn credential IDs can be in either format depending on the server.
 */
function decodeCredentialId(id: string): Uint8Array {
  // Try base64URL decode first
  try {
    let base64 = id.replace(/-/g, "+").replace(/_/g, "/");
    const padding = base64.length % 4;
    if (padding === 2) base64 += "==";
    else if (padding === 3) base64 += "=";

    const decoded = atob(base64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch {
    // Try hex decoding as fallback
    const hex = id.replace(/^0x/, "");
    const byteValues = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [];
    if (byteValues.some((b) => isNaN(b))) {
      throw new Error("Invalid credential ID format");
    }
    return new Uint8Array(byteValues);
  }
}

async function buildSmartAccountFromCredential(
  credential: P256Credential,
  chainId: number
): Promise<{ client: SmartAccountClient; address: Hex }> {
  const chain = getChain(chainId);
  const publicClient = createPublicClientForChain(chainId);
  const pimlicoClient = createPimlicoClientForChain(chainId);
  const bundlerUrl = getPimlicoBundlerUrl(chainId);

  const webAuthnAccount = toWebAuthnAccount({ credential });

  const account = await toKernelSmartAccount({
    client: publicClient,
    version: "0.3.1",
    owners: [webAuthnAccount],
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  const sponsorshipPolicyId =
    import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID || DEFAULT_SPONSORSHIP_POLICY_ID;

  const client = createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    paymasterContext: { sponsorshipPolicyId },
    userOperation: {
      estimateFeesPerGas: async () => {
        const { fast } = await pimlicoClient.getUserOperationGasPrice();
        return {
          maxFeePerGas: fast.maxFeePerGas,
          maxPriorityFeePerGas: fast.maxPriorityFeePerGas,
        };
      },
    },
  });

  return { client, address: account.address };
}

// ============================================================================
// SERVICE: Restore Session
// ============================================================================

// Session restore: 15s timeout with 2 retries for poor networks
const SESSION_RESTORE_TIMEOUT = 15000;
const SESSION_RESTORE_MAX_RETRIES = 2;

async function fetchCredentialsWithRetry(
  passkeyClient: PasskeyServerClient,
  storedUsername: string
): Promise<P256Credential[] | null> {
  for (let attempt = 0; attempt <= SESSION_RESTORE_MAX_RETRIES; attempt++) {
    try {
      const { promise: timeoutPromise, reject } = Promise.withResolvers<never>();
      setTimeout(() => reject(new Error("Session restore timeout")), SESSION_RESTORE_TIMEOUT);

      return await Promise.race([
        passkeyClient.getCredentials({ context: { userName: storedUsername } }),
        timeoutPromise,
      ]);
    } catch (error) {
      if (attempt === SESSION_RESTORE_MAX_RETRIES) throw error;
      // Exponential backoff: 1s, 2s
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 1000 * Math.pow(2, attempt));
      await promise;
    }
  }
  return null;
}

export const restoreSessionService = fromPromise<RestoreSessionResult | null, RestoreInput>(
  async ({ input }) => {
    const { chainId } = input;
    const storedUsername = getStoredUsername();

    if (!storedUsername) return null;

    const passkeyClient = createPasskeyServerClient(chainId);

    try {
      const credentials = await fetchCredentialsWithRetry(passkeyClient, storedUsername);

      if (!credentials || credentials.length === 0) {
        clearStoredUsername();
        return null;
      }

      const credential = credentials[0];
      const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

      // Track successful session restore
      trackAuthSessionRestored({
        smartAccountAddress: address,
        userName: storedUsername,
      });

      return {
        credential,
        smartAccountClient: client,
        smartAccountAddress: address,
        userName: storedUsername,
      };
    } catch {
      // Don't clear username on network errors - user still has account
      return null;
    }
  }
);

// ============================================================================
// SERVICE: Register Passkey (New User)
// ============================================================================

/**
 * Register a new passkey for a new user using Pimlico server
 *
 * Flow:
 * 1. Start registration on Pimlico server
 * 2. Create WebAuthn credential (prompts biometric)
 * 3. Verify registration on Pimlico server (stores credential)
 * 4. Build smart account client
 */
export const registerPasskeyService = fromPromise<PasskeySessionResult, PasskeyInput>(
  async ({ input }) => {
    const { userName, chainId } = input;

    if (!userName) {
      throw new Error("Username is required for registration");
    }

    // Track registration started
    trackAuthPasskeyRegisterStarted({ userName });

    try {
      // Create passkey server client
      const passkeyClient = createPasskeyServerClient(chainId);

      // Create and register credential via Pimlico server
      const credential = await createPasskeyWithServer(passkeyClient, userName);

      // Store username locally for session restore
      setStoredUsername(userName);

      // Build smart account
      const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

      // Track successful registration
      trackAuthPasskeyRegisterSuccess({
        smartAccountAddress: address,
        userName,
      });

      return {
        credential,
        smartAccountClient: client,
        smartAccountAddress: address,
        userName,
      };
    } catch (error) {
      // Track failed registration
      trackAuthPasskeyRegisterFailed({
        error: error instanceof Error ? error.message : "Unknown error",
        userName,
      });
      throw error;
    }
  }
);

// ============================================================================
// SERVICE: Authenticate Passkey (Existing User)
// ============================================================================

/**
 * Authenticate with existing passkey using Pimlico server
 *
 * Flow:
 * 1. Fetch credentials from Pimlico server
 * 2. Prompt biometric authentication
 * 3. Build smart account client
 */
export const authenticatePasskeyService = fromPromise<PasskeySessionResult, PasskeyInput>(
  async ({ input }) => {
    const { userName, chainId } = input;

    if (!userName) {
      throw new Error("Username is required for authentication");
    }

    // Track login started
    trackAuthPasskeyLoginStarted({ userName });

    try {
      // Create passkey server client
      const passkeyClient = createPasskeyServerClient(chainId);

      // Fetch credentials from Pimlico server
      const credentials = await passkeyClient.getCredentials({
        context: { userName },
      });

      if (credentials.length === 0) {
        throw new Error("No passkey found for this account. Please create a new account.");
      }

      // Use first credential
      const credential = credentials[0];

      // Decode credential ID for WebAuthn authentication
      const credentialIdBytes = decodeCredentialId(credential.id);

      // Get fixed RP ID - MUST match what was used during registration
      // This is critical for Android which is strict about RP ID matching
      const rpId = getPasskeyRpId();

      console.debug(
        "[Passkey] Authentication - RP ID:",
        rpId,
        "| Origin:",
        window.location.origin,
        "| Credential:",
        credential.id.substring(0, 16) + "..."
      );

      // Prompt WebAuthn authentication (biometric)
      const authResponse = await window.navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId,
          userVerification: "required",
          allowCredentials: [
            {
              id: credentialIdBytes as BufferSource,
              type: "public-key",
              // Transports hint helps Android find the credential
              transports: ["internal", "hybrid"],
            },
          ],
          timeout: 60000,
        },
      });

      if (!authResponse) {
        throw new Error("Passkey authentication was cancelled");
      }

      // Store username for session restore
      setStoredUsername(userName);

      // Build smart account with the credential from server
      const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

      // Track successful login
      trackAuthPasskeyLoginSuccess({
        smartAccountAddress: address,
        userName,
      });

      return {
        credential,
        smartAccountClient: client,
        smartAccountAddress: address,
        userName,
      };
    } catch (error) {
      // Track failed login
      trackAuthPasskeyLoginFailed({
        error: error instanceof Error ? error.message : "Unknown error",
        userName,
      });
      throw error;
    }
  }
);

// ============================================================================
// SERVICE: Claim ENS
// ============================================================================

/**
 * Claim ENS subdomain on mainnet
 */
export const claimENSService = fromPromise<void, ClaimENSInput>(async ({ input }) => {
  const { smartAccountClient, name } = input;

  if (!smartAccountClient) {
    throw new Error("Smart account client required for ENS claim");
  }

  const ensRegistrarAddress = import.meta.env.VITE_ENS_REGISTRAR_ADDRESS as Hex | undefined;

  if (
    !ensRegistrarAddress ||
    ensRegistrarAddress === "0x0000000000000000000000000000000000000000"
  ) {
    console.debug("[AuthServices] ENS claiming skipped: VITE_ENS_REGISTRAR_ADDRESS not configured");
    return;
  }

  // ENSRegistrar ABI
  const ensRegistrarABI = [
    {
      inputs: [
        { name: "name", type: "string" },
        { name: "owner", type: "address" },
      ],
      name: "register",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ] as const;

  const data = encodeFunctionData({
    abi: ensRegistrarABI,
    functionName: "register",
    args: [name, smartAccountClient.account!.address],
  });

  await smartAccountClient.sendTransaction({
    account: smartAccountClient.account!,
    to: ensRegistrarAddress,
    data,
    chain: undefined,
  });
});

// ============================================================================
// EXPORT ALL SERVICES
// ============================================================================

export const authServices = {
  restoreSession: restoreSessionService,
  registerPasskey: registerPasskeyService,
  authenticatePasskey: authenticatePasskeyService,
  claimENS: claimENSService,
};
