/**
 * Authentication Services for XState Machine
 *
 * Client-only passkey authentication services using localStorage for credential storage.
 *
 * Services:
 * - restoreSession: Check for existing session on app start
 * - registerPasskey: Create new passkey (new user)
 * - authenticatePasskey: Login with existing passkey (returning user)
 *
 * Note: ENS claiming was decoupled from the auth machine into a standalone
 * useMutation hook (useENSClaim) for better separation of concerns.
 *
 * Reference: https://docs.pimlico.io/docs/how-tos/signers/passkey
 */

import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { type Hex, http } from "viem";
import {
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import { fromPromise } from "xstate";

import { getChain } from "../config/chains";
import { logger } from "../modules/app/logger";
import { createPasskey, getPasskeyRpId } from "../config/passkeyServer";
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
  enablePasskeyAutoRestore,
  getPasskeyRestorePreference,
  getAuthMode,
  getStoredCredential,
  getStoredUsername,
  setStoredUsername,
} from "../modules/auth/session";

import type { PasskeySessionResult, RestoreSessionResult } from "./authMachine";

// ============================================================================
// TYPES
// ============================================================================

/** Input for passkey operations (register/authenticate) */
interface PasskeyInput {
  userName: string | null;
  chainId: number;
}

/** Input for session restore */
interface RestoreInput {
  chainId: number;
}

const DEFAULT_SPONSORSHIP_POLICY_ID = "sp_next_monster_badoon";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Decode a credential ID from base64URL or hex format to Uint8Array.
 * WebAuthn credential IDs can be in either format.
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

/**
 * Build smart account client from P256Credential.
 * This is the core function that creates the Kernel smart account.
 */
async function buildSmartAccountFromCredential(
  credential: P256Credential,
  chainId: number
): Promise<{ client: SmartAccountClient; address: Hex }> {
  const chain = getChain(chainId);
  const publicClient = createPublicClientForChain(chainId);
  const pimlicoClient = createPimlicoClientForChain(chainId);
  const bundlerUrl = getPimlicoBundlerUrl(chainId);

  // Create WebAuthn account from credential
  // CRITICAL: Must pass rpId to match what was used during registration
  // Without this, Android's Credential Manager rejects the credential on sign
  const rpId = getPasskeyRpId();
  const webAuthnAccount = toWebAuthnAccount({ credential, rpId });

  // Create Kernel smart account with WebAuthn owner
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

  // Create smart account client with Pimlico paymaster for gas sponsorship
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

  return { client, address: account.address as Hex };
}

// ============================================================================
// SERVICE: Restore Session
// ============================================================================

/**
 * Restore session from localStorage.
 * Reads stored credential and rebuilds smart account client.
 *
 * IMPORTANT: Only restores passkey session when the user explicitly allows it.
 * - authMode === "wallet" always wins
 * - passkey restore preference === "manual" requires an explicit login
 *
 * This prevents passkey auth from hijacking wallet sessions or silently
 * restoring a user who intentionally signed out.
 */
export const restoreSessionService = fromPromise<RestoreSessionResult | null, RestoreInput>(
  async ({ input }) => {
    const { chainId } = input;

    // Check stored auth mode - respect user's last authentication choice
    const storedAuthMode = getAuthMode();
    const passkeyRestorePreference = getPasskeyRestorePreference();

    // If user was last authenticated with wallet, don't auto-restore passkey session
    // This prevents passkey from "stealing" the session when user explicitly chose wallet
    if (storedAuthMode === "wallet") {
      logger.debug("[Auth] Auth mode is wallet, skipping passkey session restore");
      return null;
    }

    const shouldAutoRestore =
      passkeyRestorePreference === "auto" ||
      (passkeyRestorePreference === null && storedAuthMode === "passkey");

    if (!shouldAutoRestore) {
      logger.debug("[Auth] Passkey restore requires explicit login, skipping auto-restore");
      return null;
    }

    // Check for stored credential and username
    const storedCredential = getStoredCredential();
    const storedUsername = getStoredUsername();

    if (!storedCredential) {
      logger.debug("[Auth] No stored credential found");
      return null;
    }

    // At this point, wallet mode is not active and the restore preference allows
    // automatic restoration. Proceed with passkey session restore.
    try {
      // Build smart account from stored credential
      const { client, address } = await buildSmartAccountFromCredential(storedCredential, chainId);

      if (passkeyRestorePreference === null && storedAuthMode === "passkey") {
        enablePasskeyAutoRestore();
      }

      // Track successful session restore
      trackAuthSessionRestored({
        smartAccountAddress: address,
        userName: storedUsername || "unknown",
      });

      logger.debug("[Auth] Session restored for:", { address });

      return {
        credential: storedCredential,
        smartAccountClient: client,
        smartAccountAddress: address,
        userName: storedUsername || "",
      };
    } catch (error) {
      logger.error("[Auth] Failed to restore session", { error });
      // Don't clear credential on network errors - user still has their passkey
      return null;
    }
  }
);

// ============================================================================
// SERVICE: Register Passkey (New User)
// ============================================================================

/**
 * Register a new passkey for a new user.
 *
 * Flow:
 * 1. Create WebAuthn credential (prompts biometric)
 * 2. Store credential in localStorage
 * 3. Build smart account client
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
      // Create passkey (this stores it in localStorage too)
      const credential = await createPasskey(userName);

      // Store username for display
      setStoredUsername(userName);

      // Build smart account
      const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

      // Track successful registration
      trackAuthPasskeyRegisterSuccess({
        smartAccountAddress: address,
        userName,
      });

      logger.debug("[Auth] Registration complete", { address });

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
 * Authenticate with existing passkey from localStorage.
 *
 * Flow:
 * 1. Read credential from localStorage
 * 2. Prompt biometric authentication via WebAuthn
 * 3. Build smart account client
 */
export const authenticatePasskeyService = fromPromise<PasskeySessionResult, PasskeyInput>(
  async ({ input }) => {
    const { userName, chainId } = input;

    // Track login started
    trackAuthPasskeyLoginStarted({ userName: userName || "returning" });

    try {
      // Get stored credential
      const credential = getStoredCredential();

      if (!credential) {
        throw new Error("No passkey found. Please create a new account.");
      }

      // Decode credential ID for WebAuthn authentication
      const credentialIdBytes = decodeCredentialId(credential.id);

      // Get RP ID - MUST match what was used during registration
      const rpId = getPasskeyRpId();

      logger.debug("[Passkey] Authentication", {
        rpId,
        origin: window.location.origin,
        credential: credential.id.substring(0, 16) + "...",
      });

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
              transports: ["internal", "hybrid"],
            },
          ],
          timeout: 60000,
        },
      });

      if (!authResponse) {
        throw new Error("Passkey authentication was cancelled");
      }

      // Update stored username if provided
      if (userName) {
        setStoredUsername(userName);
      }

      // Build smart account with the stored credential
      const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

      const resolvedUsername = userName || getStoredUsername() || "";

      // Track successful login
      trackAuthPasskeyLoginSuccess({
        smartAccountAddress: address,
        userName: resolvedUsername,
      });

      logger.debug("[Auth] Authentication complete", { address });

      return {
        credential,
        smartAccountClient: client,
        smartAccountAddress: address,
        userName: resolvedUsername,
      };
    } catch (error) {
      // Track failed login
      trackAuthPasskeyLoginFailed({
        error: error instanceof Error ? error.message : "Unknown error",
        userName: userName || "unknown",
      });
      throw error;
    }
  }
);

// ============================================================================
// EXPORT ALL SERVICES
// ============================================================================

export const authServices = {
  restoreSession: restoreSessionService,
  registerPasskey: registerPasskeyService,
  authenticatePasskey: authenticatePasskeyService,
};
