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
import { type Hex, hexToBytes, http } from "viem";
import {
  createWebAuthnCredential,
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import { fromPromise } from "xstate";

import { getChain } from "../config/chains";
import {
  buildPasskeyRecoveryContext,
  createPasskey,
  createPasskeyServerClient,
  getPasskeyRpId,
  isPasskeyServerEnabled,
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
  type AuthPasskeyReason,
  type AuthPasskeySource,
} from "../modules/app/analytics-events";
import { logger } from "../modules/app/logger";
import {
  getAuthMode,
  getStoredCredential,
  getStoredSmartAccountAddress,
  getStoredUsername,
  setStoredCredential,
  setStoredSmartAccountAddress,
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

type PasskeyServerCredential = {
  id: string;
  publicKey: Hex;
};

type PasskeyServerAuthenticationOptions = {
  challenge: Hex | Uint8Array | ArrayBuffer;
  rpId?: string;
  userVerification?: UserVerificationRequirement;
  uuid: string;
};

type PasskeyServerVerificationResult = {
  success?: boolean;
  id?: string;
  publicKey?: Hex;
  userName?: string;
  username?: string;
};

type PasskeySessionWithSource = PasskeySessionResult & {
  source: AuthPasskeySource;
};

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

function decodeChallenge(challenge: Hex | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof challenge === "string") {
    return hexToBytes(challenge);
  }
  if (challenge instanceof Uint8Array) {
    return challenge;
  }
  return new Uint8Array(challenge);
}

function classifyAuthErrorReason(error: unknown): AuthPasskeyReason {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error);

  if (message.includes("expected account") || message.includes("address")) {
    return "address_mismatch";
  }

  if (message.includes("cancel") || message.includes("abort") || message.includes("notallowed")) {
    return "cancelled";
  }

  if (
    message.includes("no passkey") ||
    message.includes("no credential") ||
    message.includes("credential not found")
  ) {
    return "credential_not_found";
  }

  if (message.includes("already registered") || message.includes("recovery name")) {
    return "recovery_context_taken";
  }

  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("unavailable")
  ) {
    return "server_unavailable";
  }

  if (
    message.includes("verify") ||
    message.includes("verification") ||
    message.includes("registration failed") ||
    message.includes("authentication failed")
  ) {
    return "verification_failed";
  }

  if (
    message.includes("unsupported") ||
    message.includes("origin") ||
    message.includes("rp id") ||
    message.includes("rp_id")
  ) {
    return "unsupported_context";
  }

  return "unknown";
}

function canUseLegacyFallback(error: unknown): boolean {
  return classifyAuthErrorReason(error) === "server_unavailable";
}

function getVerifiedUsername(
  verification: PasskeyServerVerificationResult,
  fallback: string
): string {
  return verification.userName || verification.username || fallback;
}

function toVerifiedCredential(
  verification: PasskeyServerVerificationResult,
  raw: PublicKeyCredential,
  failureMessage: string
): P256Credential {
  if (!verification.success || !verification.id || !verification.publicKey) {
    throw new Error(failureMessage);
  }

  return {
    id: verification.id,
    publicKey: verification.publicKey,
    raw,
  };
}

function assertExpectedSmartAccountAddress(address: Hex): void {
  const expectedAddress = getStoredSmartAccountAddress();

  if (expectedAddress && expectedAddress.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Recovered passkey did not match the expected account address");
  }
}

function cachePasskeySession(credential: P256Credential, userName: string, address: Hex): void {
  setStoredCredential(credential);
  setStoredUsername(userName);
  setStoredSmartAccountAddress(address);
}

async function buildAndCachePasskeySession(
  credential: P256Credential,
  userName: string,
  chainId: number
): Promise<PasskeySessionResult> {
  const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

  assertExpectedSmartAccountAddress(address);
  cachePasskeySession(credential, userName, address);

  return {
    credential,
    smartAccountClient: client,
    smartAccountAddress: address,
    userName,
  };
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

async function registerPasskeyWithServer(
  userName: string,
  chainId: number
): Promise<PasskeySessionResult> {
  const context = buildPasskeyRecoveryContext(userName);
  const passkeyServerClient = createPasskeyServerClient(chainId);
  const existingCredentials = (await passkeyServerClient.getCredentials({
    context,
  })) as PasskeyServerCredential[];

  if (existingCredentials.length > 0) {
    throw new Error(
      "That recovery name is already registered. Try recovery or choose another name."
    );
  }

  const registrationOptions = await passkeyServerClient.startRegistration({ context });
  const createdCredential = await createWebAuthnCredential(registrationOptions);
  const verification = (await passkeyServerClient.verifyRegistration({
    credential: createdCredential,
    context,
  })) as PasskeyServerVerificationResult;
  const credential = toVerifiedCredential(
    verification,
    createdCredential.raw,
    "Passkey server registration failed"
  );
  const resolvedUsername = getVerifiedUsername(verification, context.username);

  return buildAndCachePasskeySession(credential, resolvedUsername, chainId);
}

async function authenticatePasskeyWithServer(
  userName: string,
  chainId: number
): Promise<PasskeySessionResult | null> {
  const context = buildPasskeyRecoveryContext(userName);
  const passkeyServerClient = createPasskeyServerClient(chainId);
  const credentials = (await passkeyServerClient.getCredentials({
    context,
  })) as PasskeyServerCredential[];

  if (credentials.length === 0) {
    return null;
  }

  const authenticationOptions =
    (await passkeyServerClient.startAuthentication()) as PasskeyServerAuthenticationOptions;
  const rpId = authenticationOptions.rpId || getPasskeyRpId();
  const authResponse = await window.navigator.credentials.get({
    publicKey: {
      challenge: decodeChallenge(authenticationOptions.challenge),
      rpId,
      userVerification: authenticationOptions.userVerification || "required",
      allowCredentials: credentials.map((credential) => ({
        id: decodeCredentialId(credential.id) as BufferSource,
        type: "public-key",
        transports: ["internal", "hybrid"],
      })),
      timeout: 60000,
    },
  });

  if (!authResponse) {
    throw new Error("Passkey authentication was cancelled");
  }

  const verification = (await passkeyServerClient.verifyAuthentication({
    raw: authResponse as PublicKeyCredential,
    uuid: authenticationOptions.uuid,
  })) as PasskeyServerVerificationResult;
  const credential = toVerifiedCredential(
    verification,
    authResponse as PublicKeyCredential,
    "Passkey server authentication failed"
  );
  const resolvedUsername = getVerifiedUsername(verification, context.username);

  return buildAndCachePasskeySession(credential, resolvedUsername, chainId);
}

async function authenticatePasskeyFromLocalCache(
  userName: string | null,
  chainId: number
): Promise<PasskeySessionResult> {
  const credential = getStoredCredential();

  if (!credential) {
    throw new Error("No passkey found. Please create a new account.");
  }

  const credentialIdBytes = decodeCredentialId(credential.id);
  const rpId = getPasskeyRpId();

  logger.debug("[Passkey] Authentication", {
    rpId,
    origin: window.location.origin,
    source: "local_cache",
  });

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

  const resolvedUsername = getStoredUsername() || userName || "";

  return buildAndCachePasskeySession(credential, resolvedUsername, chainId);
}

// ============================================================================
// SERVICE: Restore Session
// ============================================================================

/**
 * Restore session from localStorage.
 * Reads stored credential and rebuilds smart account client.
 *
 * IMPORTANT: Only restores passkey session if the stored authMode is "passkey" or not set.
 * If authMode is "wallet", we skip passkey restoration to let wallet auth take precedence.
 * This prevents passkey auth from hijacking wallet sessions after page refresh.
 */
export const restoreSessionService = fromPromise<RestoreSessionResult | null, RestoreInput>(
  async ({ input }) => {
    const { chainId } = input;

    // Check stored auth mode - respect user's last authentication choice
    const storedAuthMode = getAuthMode();

    // If user was last authenticated with wallet, don't auto-restore passkey session
    // This prevents passkey from "stealing" the session when user explicitly chose wallet
    if (storedAuthMode === "wallet") {
      logger.debug("[Auth] Auth mode is wallet, skipping passkey session restore");
      return null;
    }

    // Check for stored credential and username
    const storedCredential = getStoredCredential();
    const storedUsername = getStoredUsername();

    if (!storedCredential) {
      logger.debug("[Auth] No stored credential found");
      return null;
    }

    // At this point, authMode is either "passkey" or null (legacy sessions)
    // since wallet mode returned early above. Proceed with passkey session restore.
    try {
      // Build smart account from stored credential
      const { client, address } = await buildSmartAccountFromCredential(storedCredential, chainId);
      setStoredSmartAccountAddress(address);

      // Track successful session restore
      trackAuthSessionRestored({
        source: "restore",
        outcome: "success",
        passkeyServerEnabled: isPasskeyServerEnabled(),
        hasLocalCredential: true,
      });

      logger.debug("[Auth] Session restored from local passkey cache");

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

    const passkeyServerEnabled = isPasskeyServerEnabled();
    const source: AuthPasskeySource = passkeyServerEnabled ? "server" : "local_cache";

    // Track registration started
    trackAuthPasskeyRegisterStarted({
      source,
      outcome: "started",
      passkeyServerEnabled,
      hasLocalCredential: Boolean(getStoredCredential()),
    });

    try {
      const result = passkeyServerEnabled
        ? await registerPasskeyWithServer(userName, chainId)
        : await buildAndCachePasskeySession(await createPasskey(userName), userName, chainId);

      // Track successful registration
      trackAuthPasskeyRegisterSuccess({
        source,
        outcome: "success",
        passkeyServerEnabled,
        hasLocalCredential: true,
      });

      logger.debug("[Auth] Registration complete", { source });

      return result;
    } catch (error) {
      // Track failed registration
      trackAuthPasskeyRegisterFailed({
        source,
        outcome: "failed",
        reason: classifyAuthErrorReason(error),
        passkeyServerEnabled,
        hasLocalCredential: Boolean(getStoredCredential()),
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
    const passkeyServerEnabled = isPasskeyServerEnabled();
    const hasLocalCredential = Boolean(getStoredCredential());
    let source: AuthPasskeySource = passkeyServerEnabled && userName ? "server" : "local_cache";

    // Track login started
    trackAuthPasskeyLoginStarted({
      source,
      outcome: "started",
      passkeyServerEnabled,
      hasLocalCredential,
    });

    try {
      let result: PasskeySessionWithSource | null = null;

      if (passkeyServerEnabled && userName) {
        try {
          const serverResult = await authenticatePasskeyWithServer(userName, chainId);
          if (serverResult) {
            result = { ...serverResult, source: "server" };
          } else if (hasLocalCredential) {
            logger.warn("[Auth] Passkey server returned no credentials; using local fallback");
            result = {
              ...(await authenticatePasskeyFromLocalCache(userName, chainId)),
              source: "local_cache",
            };
          } else {
            throw new Error("No passkey credential found for that username.");
          }
        } catch (serverError) {
          if (hasLocalCredential && canUseLegacyFallback(serverError)) {
            logger.warn("[Auth] Passkey server unavailable; using local fallback");
            result = {
              ...(await authenticatePasskeyFromLocalCache(userName, chainId)),
              source: "local_cache",
            };
          } else {
            throw serverError;
          }
        }
      } else {
        result = {
          ...(await authenticatePasskeyFromLocalCache(userName, chainId)),
          source: "local_cache",
        };
      }

      source = result.source;

      // Track successful login
      trackAuthPasskeyLoginSuccess({
        source,
        outcome: "success",
        reason: source === "local_cache" && passkeyServerEnabled ? "legacy_fallback" : undefined,
        passkeyServerEnabled,
        hasLocalCredential: Boolean(getStoredCredential()),
      });

      logger.debug("[Auth] Authentication complete", { source });

      return result;
    } catch (error) {
      // Track failed login
      trackAuthPasskeyLoginFailed({
        source,
        outcome: "failed",
        reason: classifyAuthErrorReason(error),
        passkeyServerEnabled,
        hasLocalCredential: Boolean(getStoredCredential()),
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
