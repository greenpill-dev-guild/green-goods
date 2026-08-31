import { type Hex, hexToBytes } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import { fromPromise } from "xstate";
import type { AuthPasskeyReason, AuthPasskeySource } from "../modules/app/analytics-events";
import { logger } from "../modules/app/logger";
import {
  defaultPasskeyAdapters,
  type PasskeyAdapters,
  type PasskeyServerClientAdapter,
} from "./auth-passkey-adapters";
import type { PasskeySessionResult, RestoreSessionResult } from "./authMachine";

interface PasskeyInput {
  userName: string | null;
  chainId: number;
}

interface RestoreInput {
  chainId: number;
}

type PasskeyServerCredential = { id: string; publicKey: Hex };
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
type VerifyAuthenticationInput = Parameters<PasskeyServerClientAdapter["verifyAuthentication"]>[0];

class PasskeyServerLookupError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Passkey server lookup failed: network or server unavailable");
    this.name = "PasskeyServerLookupError";
    this.cause = cause;
  }
}

const TRANSPORT_ERROR_NAMES = new Set(["HttpRequestError", "TimeoutError", "RpcRequestError"]);
const CANCELLED_ERROR_NAMES = new Set(["NotAllowedError", "AbortError"]);

function classifyAuthErrorReason(error: unknown): AuthPasskeyReason {
  if (error instanceof PasskeyServerLookupError) return "server_unavailable";
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

function decodeCredentialId(id: string): Uint8Array {
  const hex = id.replace(/^0x/, "");
  if (hex.length > 0 && hex.length % 2 === 0 && /^[\da-f]+$/i.test(hex)) {
    return new Uint8Array(hex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
  }
  try {
    let base64 = id.replace(/-/g, "+").replace(/_/g, "/");
    const padding = base64.length % 4;
    if (padding === 2) base64 += "==";
    else if (padding === 3) base64 += "=";
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Invalid credential ID format");
  }
}

function strictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function decodeChallenge(challenge: Hex | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof challenge === "string") return hexToBytes(challenge);
  return challenge instanceof Uint8Array ? challenge : new Uint8Array(challenge);
}

function verifiedCredential(
  verification: PasskeyServerVerificationResult,
  raw: P256Credential["raw"],
  failureMessage: string
): P256Credential {
  if (!verification.success || !verification.id || !verification.publicKey) {
    throw new Error(failureMessage);
  }
  return { id: verification.id, publicKey: verification.publicKey, raw };
}

export function createAuthServices(adapters: PasskeyAdapters = defaultPasskeyAdapters) {
  const { session, telemetry } = adapters;

  const cacheSession = (credential: P256Credential, userName: string, address: Hex) => {
    session.setStoredCredential(credential);
    session.setStoredUsername(userName);
    session.setStoredSmartAccountAddress(address);
    session.clearSignedOutSentinel();
  };

  const buildSession = async (
    credential: P256Credential,
    userName: string,
    chainId: number,
    enforceExpectedAddress = true
  ): Promise<PasskeySessionResult> => {
    const { client, address } = await adapters.buildSmartAccount(credential, chainId);
    const expected = session.getStoredSmartAccountAddress();
    if (enforceExpectedAddress && expected && expected.toLowerCase() !== address.toLowerCase()) {
      throw new Error("Recovered passkey did not match the expected account address");
    }
    cacheSession(credential, userName, address);
    return {
      credential,
      smartAccountClient: client,
      smartAccountAddress: address,
      userName,
    };
  };

  const registerWithServer = async (userName: string, chainId: number) => {
    const context = adapters.buildRecoveryContext(userName);
    const client = adapters.createServerClient(chainId);
    const existing = (await client.getCredentials({ context })) as PasskeyServerCredential[];
    if (existing.length > 0) {
      throw new Error(
        "That recovery name is already registered. Try recovery or choose another name."
      );
    }
    const options = await client.startRegistration({ context });
    const created = await adapters.createWebAuthnCredential(options);
    const verification = (await client.verifyRegistration({
      credential: created,
      context,
    })) as PasskeyServerVerificationResult;
    const credential = verifiedCredential(
      verification,
      created.raw,
      "Passkey server registration failed"
    );
    return buildSession(
      credential,
      verification.userName || verification.username || context.userName,
      chainId,
      false
    );
  };

  const authenticateWithServer = async (
    userName: string,
    chainId: number
  ): Promise<PasskeySessionResult | null> => {
    const context = adapters.buildRecoveryContext(userName);
    const client = adapters.createServerClient(chainId);
    const credentials = (await client.getCredentials({ context }).catch((error: unknown) => {
      throw new PasskeyServerLookupError(error);
    })) as PasskeyServerCredential[];
    if (credentials.length === 0) return null;
    const options = (await client.startAuthentication().catch((error: unknown) => {
      throw new PasskeyServerLookupError(error);
    })) as PasskeyServerAuthenticationOptions;
    const response = await adapters.getWebAuthnCredential({
      publicKey: {
        challenge: strictArrayBuffer(decodeChallenge(options.challenge)),
        rpId: options.rpId || adapters.getRpId(),
        userVerification: options.userVerification || "required",
        allowCredentials: credentials.map((credential) => ({
          id: strictArrayBuffer(decodeCredentialId(credential.id)),
          type: "public-key",
          transports: ["internal", "hybrid"],
        })),
        timeout: 60_000,
      },
    });
    if (!response) throw new Error("Passkey authentication was cancelled");
    const verification = (await client.verifyAuthentication({
      raw: response as PublicKeyCredential,
      uuid: options.uuid,
    } as unknown as VerifyAuthenticationInput)) as PasskeyServerVerificationResult;
    const credential = verifiedCredential(
      verification,
      response as P256Credential["raw"],
      "Passkey server authentication failed"
    );
    return buildSession(
      credential,
      verification.userName || verification.username || context.userName,
      chainId
    );
  };

  const authenticateFromCache = async (
    userName: string | null,
    chainId: number,
    requireStoredUsername = false
  ) => {
    const credential = session.getStoredCredential();
    if (!credential) throw new Error("No passkey found. Please create a new account.");
    const storedUsername = session.getStoredUsername();
    if (requireStoredUsername && userName && !storedUsername) {
      throw new Error("No passkey credential found for that username.");
    }
    const response = await adapters.getWebAuthnCredential({
      publicKey: {
        challenge: strictArrayBuffer(adapters.randomChallenge()),
        rpId: adapters.getRpId(),
        userVerification: "required",
        allowCredentials: [
          {
            id: strictArrayBuffer(decodeCredentialId(credential.id)),
            type: "public-key",
            transports: ["internal", "hybrid"],
          },
        ],
        timeout: 60_000,
      },
    });
    if (!response) throw new Error("Passkey authentication was cancelled");
    return buildSession(credential, storedUsername || userName || "", chainId);
  };

  const restoreSession = fromPromise<RestoreSessionResult | null, RestoreInput>(
    async ({ input }) => {
      const authMode = session.getAuthMode();
      if (session.hasSignedOutSentinel() || authMode === "wallet" || authMode === "embedded") {
        return null;
      }
      const credential = session.getStoredCredential();
      if (!credential) return null;
      try {
        const { client, address } = await adapters.buildSmartAccount(credential, input.chainId);
        const expected = session.getStoredSmartAccountAddress();
        if (expected && expected.toLowerCase() !== address.toLowerCase()) {
          telemetry.restore({
            source: "restore",
            outcome: "failed",
            reason: "address_mismatch",
            passkeyServerEnabled: adapters.isServerEnabled(),
            hasLocalCredential: true,
          });
          return null;
        }
        session.setStoredSmartAccountAddress(address);
        telemetry.restore({
          source: "restore",
          outcome: "success",
          passkeyServerEnabled: adapters.isServerEnabled(),
          hasLocalCredential: true,
        });
        return {
          credential,
          smartAccountClient: client,
          smartAccountAddress: address,
          userName: session.getStoredUsername() || "",
        };
      } catch (error) {
        logger.error("[Auth] Failed to restore session", { error });
        telemetry.restore({
          source: "restore",
          outcome: "failed",
          reason: classifyAuthErrorReason(error),
          passkeyServerEnabled: adapters.isServerEnabled(),
          hasLocalCredential: true,
        });
        return null;
      }
    }
  );

  const registerPasskey = fromPromise<PasskeySessionResult, PasskeyInput>(async ({ input }) => {
    if (!input.userName) throw new Error("Username is required for registration");
    const serverEnabled = adapters.isServerEnabled();
    const source: AuthPasskeySource = serverEnabled ? "server" : "local_cache";
    telemetry.registerStarted({
      source,
      outcome: "started",
      passkeyServerEnabled: serverEnabled,
      hasLocalCredential: Boolean(session.getStoredCredential()),
    });
    try {
      const result = serverEnabled
        ? await registerWithServer(input.userName, input.chainId)
        : await buildSession(
            await adapters.createLocalPasskey(input.userName),
            input.userName,
            input.chainId,
            false
          );
      telemetry.registerSucceeded({
        source,
        outcome: "success",
        passkeyServerEnabled: serverEnabled,
        hasLocalCredential: true,
      });
      return result;
    } catch (error) {
      telemetry.registerFailed({
        source,
        outcome: "failed",
        reason: classifyAuthErrorReason(error),
        passkeyServerEnabled: serverEnabled,
        hasLocalCredential: Boolean(session.getStoredCredential()),
      });
      throw error;
    }
  });

  const authenticatePasskey = fromPromise<PasskeySessionResult, PasskeyInput>(async ({ input }) => {
    const serverEnabled = adapters.isServerEnabled();
    const hasLocalCredential = Boolean(session.getStoredCredential());
    let source: AuthPasskeySource = serverEnabled && input.userName ? "server" : "local_cache";
    let attemptSource = source;
    telemetry.loginStarted({
      source,
      outcome: "started",
      passkeyServerEnabled: serverEnabled,
      hasLocalCredential,
    });
    try {
      let result: (PasskeySessionResult & { source: AuthPasskeySource }) | null = null;
      if (serverEnabled && input.userName) {
        try {
          const serverResult = await authenticateWithServer(input.userName, input.chainId);
          if (serverResult) result = { ...serverResult, source: "server" };
          else if (hasLocalCredential) {
            attemptSource = "local_cache";
            result = {
              ...(await authenticateFromCache(input.userName, input.chainId, true)),
              source: "local_cache",
            };
          } else throw new Error("No passkey credential found for that username.");
        } catch (serverError) {
          if (
            attemptSource === "server" &&
            hasLocalCredential &&
            classifyAuthErrorReason(serverError) === "server_unavailable"
          ) {
            attemptSource = "local_cache";
            result = {
              ...(await authenticateFromCache(input.userName, input.chainId, true)),
              source: "local_cache",
            };
          } else throw serverError;
        }
      } else {
        result = {
          ...(await authenticateFromCache(input.userName, input.chainId)),
          source: "local_cache",
        };
      }
      source = result.source;
      telemetry.loginSucceeded({
        source,
        outcome: "success",
        reason: source === "local_cache" && serverEnabled ? "legacy_fallback" : undefined,
        passkeyServerEnabled: serverEnabled,
        hasLocalCredential: Boolean(session.getStoredCredential()),
      });
      return result;
    } catch (error) {
      telemetry.loginFailed({
        source: attemptSource,
        outcome: "failed",
        reason: classifyAuthErrorReason(error),
        passkeyServerEnabled: serverEnabled,
        hasLocalCredential: Boolean(session.getStoredCredential()),
      });
      throw error;
    }
  });

  return { restoreSession, registerPasskey, authenticatePasskey };
}

export const authServices = createAuthServices();
export const restoreSessionService = authServices.restoreSession;
export const registerPasskeyService = authServices.registerPasskey;
export const authenticatePasskeyService = authServices.authenticatePasskey;
