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
  type AuthPasskeyReason,
  type AuthPasskeySource,
  trackAuthPasskeyLoginFailed,
  trackAuthPasskeyLoginStarted,
  trackAuthPasskeyLoginSuccess,
  trackAuthPasskeyRegisterFailed,
  trackAuthPasskeyRegisterStarted,
  trackAuthPasskeyRegisterSuccess,
  trackAuthSessionRestored,
} from "../modules/app/analytics-events";
import { logger } from "../modules/app/logger";
import {
  clearSignedOutSentinel,
  getAuthMode,
  getStoredCredential,
  getStoredSmartAccountAddress,
  getStoredUsername,
  hasSignedOutSentinel,
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
type PasskeyServerClient = ReturnType<typeof createPasskeyServerClient>;
type PasskeyServerVerifyAuthenticationInput = Parameters<
  PasskeyServerClient["verifyAuthentication"]
>[0];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Decode a credential ID from base64URL or hex format to Uint8Array.
 * WebAuthn credential IDs can be in either format.
 */
function decodeCredentialId(id: string): Uint8Array {
  const hex = id.replace(/^0x/, "");
  if (hex.length > 0 && hex.length % 2 === 0 && /^[\da-f]+$/i.test(hex)) {
    const byteValues = hex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || [];
    return new Uint8Array(byteValues);
  }

  // Try base64URL decode after hex detection. Hex IDs are also valid base64URL
  // strings, so base64 cannot be the first parser.
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
    throw new Error("Invalid credential ID format");
  }
}

function toStrictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
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

/**
 * Failure in the hosted passkey server lookup phase (getCredentials /
 * startAuthentication), before any WebAuthn ceremony has started. Tagged by
 * call phase so the legacy local fallback decision does not depend on
 * provider-specific error message text (viem transport errors such as
 * HttpRequestError and TimeoutError carry no recognizable keywords).
 */
class PasskeyServerLookupError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    // "network" keeps client-side friendly-message mapping on the
    // server-unavailable copy when no local fallback exists.
    super("Passkey server lookup failed: network or server unavailable");
    this.name = "PasskeyServerLookupError";
    this.cause = cause;
  }
}

/** viem transport-level failures that mean the server, not the user, failed. */
const TRANSPORT_ERROR_NAMES = new Set(["HttpRequestError", "TimeoutError", "RpcRequestError"]);

/** WebAuthn ceremony rejections raised when the user dismisses the prompt. */
const CANCELLED_ERROR_NAMES = new Set(["NotAllowedError", "AbortError"]);

function classifyAuthErrorReason(error: unknown): AuthPasskeyReason {
  if (error instanceof PasskeyServerLookupError) {
    return "server_unavailable";
  }

  const name = error instanceof Error ? error.name : "";
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (
    CANCELLED_ERROR_NAMES.has(name) ||
    message.includes("cancel") ||
    message.includes("abort") ||
    message.includes("notallowed")
  ) {
    return "cancelled";
  }

  if (
    message.includes("expected account") ||
    message.includes("address mismatch") ||
    message.includes("did not match the expected account")
  ) {
    return "address_mismatch";
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
    TRANSPORT_ERROR_NAMES.has(name) ||
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
  raw: P256Credential["raw"],
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
  // A successful passkey session creation is the only opt-back-in from the
  // signed-out sentinel — sign-in intent alone (a dismissed ceremony) must
  // leave automatic restore suppressed.
  clearSignedOutSentinel();
}

type BuildPasskeySessionOptions = {
  /**
   * Registration mints a new credential and therefore a new smart-account
   * address by design (the UI guards it behind explicit separate-account
   * confirmation). Enforcing address continuity there would permanently
   * dead-end registration whenever stale expected-address state survives a
   * partial cache clear, so register paths opt out.
   */
  enforceExpectedAddress?: boolean;
};

async function buildAndCachePasskeySession(
  credential: P256Credential,
  userName: string,
  chainId: number,
  options: BuildPasskeySessionOptions = {}
): Promise<PasskeySessionResult> {
  const { enforceExpectedAddress = true } = options;
  const { client, address } = await buildSmartAccountFromCredential(credential, chainId);

  if (enforceExpectedAddress) {
    assertExpectedSmartAccountAddress(address);
  }
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
  const resolvedUsername = getVerifiedUsername(verification, context.userName);

  return buildAndCachePasskeySession(credential, resolvedUsername, chainId, {
    enforceExpectedAddress: false,
  });
}

async function authenticatePasskeyWithServer(
  userName: string,
  chainId: number
): Promise<PasskeySessionResult | null> {
  const context = buildPasskeyRecoveryContext(userName);
  const passkeyServerClient = createPasskeyServerClient(chainId);
  const credentials = (await passkeyServerClient
    .getCredentials({
      context,
    })
    .catch((error: unknown) => {
      throw new PasskeyServerLookupError(error);
    })) as PasskeyServerCredential[];

  if (credentials.length === 0) {
    return null;
  }

  const authenticationOptions = (await passkeyServerClient
    .startAuthentication()
    .catch((error: unknown) => {
      throw new PasskeyServerLookupError(error);
    })) as PasskeyServerAuthenticationOptions;
  const rpId = authenticationOptions.rpId || getPasskeyRpId();
  const authResponse = await window.navigator.credentials.get({
    publicKey: {
      challenge: toStrictArrayBuffer(decodeChallenge(authenticationOptions.challenge)),
      rpId,
      userVerification: authenticationOptions.userVerification || "required",
      allowCredentials: credentials.map((credential) => ({
        id: toStrictArrayBuffer(decodeCredentialId(credential.id)),
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
  } as unknown as PasskeyServerVerifyAuthenticationInput)) as PasskeyServerVerificationResult;
  const credential = toVerifiedCredential(
    verification,
    authResponse as P256Credential["raw"],
    "Passkey server authentication failed"
  );
  const resolvedUsername = getVerifiedUsername(verification, context.userName);

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

    // Explicit sign-out suppresses automatic restore until the user signs
    // back in. The recovery metadata stays cached for one-tap re-login, but
    // a refresh must not silently re-authenticate on a shared device.
    if (hasSignedOutSentinel()) {
      logger.debug("[Auth] Signed-out sentinel present, skipping passkey session restore");
      return null;
    }

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

      // Fail closed on address drift, mirroring the login/recovery guard.
      // Adopting whatever the stored credential rebuilds would silently
      // re-point the expected account after partial cache corruption.
      const expectedAddress = getStoredSmartAccountAddress();
      if (expectedAddress && expectedAddress.toLowerCase() !== address.toLowerCase()) {
        logger.warn(
          "[Auth] Stored credential rebuilt a different smart-account address; skipping restore"
        );
        trackAuthSessionRestored({
          source: "restore",
          outcome: "failed",
          reason: "address_mismatch",
          passkeyServerEnabled: isPasskeyServerEnabled(),
          hasLocalCredential: true,
        });
        return null;
      }
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
      trackAuthSessionRestored({
        source: "restore",
        outcome: "failed",
        reason: classifyAuthErrorReason(error),
        passkeyServerEnabled: isPasskeyServerEnabled(),
        hasLocalCredential: true,
      });
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
        : await buildAndCachePasskeySession(await createPasskey(userName), userName, chainId, {
            enforceExpectedAddress: false,
          });

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
    // Where the most recent authentication attempt actually ran. The server
    // path can degrade to the local fallback, and a failure there must be
    // attributed to local_cache, not to the server lookup that preceded it.
    let attemptSource: AuthPasskeySource = source;

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
            attemptSource = "local_cache";
            result = {
              ...(await authenticatePasskeyFromLocalCache(userName, chainId)),
              source: "local_cache",
            };
          } else {
            throw new Error("No passkey credential found for that username.");
          }
        } catch (serverError) {
          if (
            // Fall back at most once: after the server-empty branch above has
            // degraded to local (attemptSource === "local_cache"), a failure
            // from that local ceremony must surface, not trigger a second
            // fallback ceremony.
            attemptSource === "server" &&
            hasLocalCredential &&
            canUseLegacyFallback(serverError)
          ) {
            logger.warn("[Auth] Passkey server unavailable; using local fallback", {
              error: serverError,
            });
            attemptSource = "local_cache";
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
      // Track failed login against the path that actually failed (the local
      // fallback ceremony reports local_cache even when the flow began with a
      // hosted-server lookup).
      trackAuthPasskeyLoginFailed({
        source: attemptSource,
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
