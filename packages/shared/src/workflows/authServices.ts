import { type Hex, hexToBytes } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import { fromPromise } from "xstate";
import type { AuthPasskeySource } from "../modules/app/analytics-events";
import { getPasskeyRequestIds, type PasskeyCredential } from "../modules/auth/session";
import {
  LEGACY_PASSKEY_PROFILE,
  PILOT_PASSKEY_PROFILE,
  type PasskeyAccountProfileId,
} from "../modules/auth/account-profile";
import { guardSessionCommit } from "../modules/auth/sessionSignOut";
import { logger } from "../modules/app/logger";
import { createSmartAccountClientResolver } from "../modules/auth/smartAccountClientResolver";
import { normalizePasskeyName } from "../public-contracts/passkey-directory";
import {
  classifyAuthErrorReason,
  PasskeyNotFoundError,
  PasskeyServerLookupError,
} from "./auth-passkey-errors";
import {
  defaultPasskeyAdapters,
  type PasskeyAdapters,
  type PasskeyServerClientAdapter,
} from "./auth-passkey-adapters";
import { signInWithDirectory } from "./auth-passkey-directory";
import { matchesBrowserId, verifiedCredential } from "./auth-passkey-ids";
import type { PasskeySessionResult, RestoreSessionResult } from "./authMachine";

interface PasskeyInput {
  userName: string | null;
  chainId: number;
  originalAccount?: boolean;
}

interface RestoreInput {
  chainId: number;
}

type PasskeyServerCredential = { id: string; publicKey: Hex };
type PasskeyServerRegistrationOptions = {
  rp?: { id?: string };
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
type VerifyAuthenticationInput = Parameters<PasskeyServerClientAdapter["verifyAuthentication"]>[0];

function strictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function decodeChallenge(challenge: Hex | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof challenge === "string") return hexToBytes(challenge);
  return challenge instanceof Uint8Array ? challenge : new Uint8Array(challenge);
}

export function createAuthServices(adapters: PasskeyAdapters = defaultPasskeyAdapters) {
  const { session, telemetry } = adapters;

  const cacheSession = (
    credential: PasskeyCredential,
    userName: string,
    address: Hex,
    rpId: string,
    profile: PasskeyAccountProfileId
  ) => {
    const previousCredential = session.getStoredCredential();
    const previousAddress = session.getStoredSmartAccountAddress();
    if (previousCredential && previousAddress) {
      session.setStoredProfileAddress(
        session.getStoredAccountProfile(),
        previousCredential,
        previousAddress,
        session.getStoredRpId() || rpId,
        session.getStoredUsername() || ""
      );
    }
    session.setStoredProfileAddress(profile, credential, address, rpId, userName);
    session.setStoredCredential(credential);
    session.setStoredRpId(rpId);
    session.setStoredUsername(userName);
    session.setStoredSmartAccountAddress(address);
    session.setStoredAccountProfile(profile);
    session.clearSignedOutSentinel();
  };

  const buildSession = async (
    assertActive: () => void,
    credential: PasskeyCredential,
    userName: string,
    chainId: number,
    rpId: string,
    enforceExpectedAddress = true,
    alternatives: PasskeyCredential[] = [],
    profile: PasskeyAccountProfileId = session.getStoredAccountProfile(),
    expectedAddressOverride?: Hex
  ): Promise<PasskeySessionResult> => {
    assertActive();
    const expected =
      expectedAddressOverride ??
      session.getStoredProfileAddress(profile, credential) ??
      (enforceExpectedAddress && profile === session.getStoredAccountProfile()
        ? session.getStoredSmartAccountAddress()
        : null);
    // Without a saved address, always use the canonical server identity.
    const candidates = expected ? [credential, ...alternatives] : [credential];
    for (const candidate of candidates) {
      const { client, address } =
        profile === LEGACY_PASSKEY_PROFILE
          ? await adapters.buildSmartAccount(candidate, chainId, rpId)
          : await adapters.buildSmartAccount(candidate, chainId, rpId, undefined, profile);
      if (expected && expected.toLowerCase() !== address.toLowerCase()) continue;
      if (
        profile === PILOT_PASSKEY_PROFILE &&
        !(await adapters.hasPilotAccountProof(candidate, address))
      ) {
        throw new Error("Pilot account authorization proof is unavailable");
      }
      assertActive();
      cacheSession(candidate, userName, address, rpId, profile);
      return {
        accountProfile: profile,
        credential: candidate,
        smartAccountClient: client,
        resolveSmartAccountClient: createSmartAccountClientResolver({
          credential: candidate,
          primaryClient: client,
          primaryChainId: chainId,
          expectedAddress: address,
          buildSmartAccount: (credential, targetChainId) =>
            profile === PILOT_PASSKEY_PROFILE
              ? adapters.buildSmartAccount(credential, targetChainId, rpId, undefined, profile)
              : adapters.buildSmartAccount(credential, targetChainId, rpId, address),
        }),
        smartAccountAddress: address,
        userName,
      };
    }
    throw new Error("Recovered passkey did not match the expected account address");
  };

  /**
   * The domain of a cached passkey whose domain was never saved. Only passkeys issued by the
   * hosted server were cached that way, and it issues each site its own hostname.
   */
  const cachedPasskeyRpId = () =>
    session.getStoredRpId() ||
    (adapters.isServerEnabled() ? adapters.getSiteRpId() : adapters.getRpId());

  const matchesCachedUsername = (userName: string): boolean => {
    const storedUsername = session.getStoredUsername();
    return (
      storedUsername !== null &&
      normalizePasskeyName(storedUsername) === normalizePasskeyName(userName)
    );
  };

  const registerWithServer = async (
    assertActive: () => void,
    userName: string,
    chainId: number
  ) => {
    const context = adapters.buildRecoveryContext(userName);
    // New accounts go to the directory once this build is switched to it, so their passkey
    // works on every Green Goods site. The directory itself refuses a name the hosted server
    // already holds.
    const client = adapters.createDirectoryClient() ?? adapters.createServerClient(chainId);
    const existing = (await client.getCredentials({ context })) as PasskeyServerCredential[];
    assertActive();
    if (existing.length > 0) {
      throw new Error(
        "That recovery name is already registered. Try recovery or choose another name."
      );
    }
    const options = (await client.startRegistration({
      context,
    })) as PasskeyServerRegistrationOptions;
    const rpId = options.rp?.id || adapters.getRpId();
    assertActive();
    const created = await adapters.createWebAuthnCredential(options);
    // Verification persists the credential on the server, before local session construction.
    assertActive();
    const verification = (await client.verifyRegistration({
      credential: created,
      context,
    })) as PasskeyServerVerificationResult;
    const credential = verifiedCredential(
      verification,
      created,
      "Passkey server registration failed"
    );
    return buildSession(
      assertActive,
      credential,
      verification.userName || verification.username || context.userName,
      chainId,
      rpId,
      false,
      [],
      LEGACY_PASSKEY_PROFILE
    );
  };

  const authenticateWithServer = async (
    assertActive: () => void,
    userName: string,
    chainId: number,
    originalExpected?: Hex
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
    const rpId = options.rpId || adapters.getRpId();
    const response = await adapters.getWebAuthnCredential({
      publicKey: {
        challenge: strictArrayBuffer(decodeChallenge(options.challenge)),
        rpId,
        userVerification: options.userVerification || "required",
        allowCredentials: credentials.flatMap((credential) =>
          getPasskeyRequestIds(credential).map((id) => ({
            id,
            type: "public-key",
            transports: ["internal", "hybrid"],
          }))
        ),
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
      {
        id: response.id,
        raw: response as P256Credential["raw"],
      },
      "Passkey server authentication failed"
    );
    const alternatives: PasskeyCredential[] = [{ ...credential, id: response.id }];
    const cached = session.getStoredCredential();
    const sameCredential = Boolean(
      cached &&
        cached.publicKey.toLowerCase() === credential.publicKey.toLowerCase() &&
        matchesBrowserId(cached, response.id)
    );
    if (sameCredential && cached) {
      alternatives.push({ ...credential, id: cached.id });
    }
    const switchingFromPilot =
      session.getStoredAccountProfile() === PILOT_PASSKEY_PROFILE && !sameCredential;
    return buildSession(
      assertActive,
      credential,
      verification.userName || verification.username || context.userName,
      chainId,
      rpId,
      !switchingFromPilot,
      alternatives.filter(
        (candidate, index, all) =>
          candidate.id !== credential.id &&
          all.findIndex((other) => other.id === candidate.id) === index
      ),
      originalExpected || switchingFromPilot
        ? LEGACY_PASSKEY_PROFILE
        : session.getStoredAccountProfile(),
      originalExpected
    );
  };

  /**
   * Sign in by name. The directory answers for accounts made through it; every older account
   * stays on the hosted server, whose sign-in is unchanged. A directory that cannot be reached
   * only matters when the hosted server does not hold the name either.
   */
  const authenticateByName = async (
    assertActive: () => void,
    userName: string,
    chainId: number,
    originalExpected?: Hex
  ): Promise<PasskeySessionResult | null> => {
    let directoryFailure: PasskeyServerLookupError | undefined;
    try {
      const signIn = await signInWithDirectory(adapters, userName);
      if (signIn) {
        // A person switching to another passkey's account is not held to the address this
        // device remembers; the same passkey must still reach its own address.
        const { credential, rpId, switchingAccounts } = signIn;
        return await buildSession(
          assertActive,
          credential,
          signIn.userName,
          chainId,
          rpId,
          !switchingAccounts,
          [],
          originalExpected || switchingAccounts
            ? LEGACY_PASSKEY_PROFILE
            : session.getStoredAccountProfile(),
          originalExpected
        );
      }
    } catch (error) {
      if (!(error instanceof PasskeyServerLookupError)) throw error;
      directoryFailure = error;
    }
    const fromHostedServer = await authenticateWithServer(
      assertActive,
      userName,
      chainId,
      originalExpected
    );
    if (!fromHostedServer && directoryFailure) throw directoryFailure;
    return fromHostedServer;
  };

  const authenticateFromCache = async (
    assertActive: () => void,
    userName: string | null,
    chainId: number,
    originalExpected?: Hex
  ) => {
    const credential = session.getStoredCredential();
    if (!credential) throw new PasskeyNotFoundError("device");
    const storedUsername = session.getStoredUsername();
    const rpId = cachedPasskeyRpId();
    if (userName && !matchesCachedUsername(userName)) throw new PasskeyNotFoundError("name");
    const challenge = adapters.randomChallenge();
    const response = await adapters.getWebAuthnCredential({
      publicKey: {
        challenge: strictArrayBuffer(challenge),
        rpId,
        userVerification: "required",
        allowCredentials: getPasskeyRequestIds(credential).map((id) => ({
          id,
          type: "public-key",
          transports: ["internal", "hybrid"],
        })),
        timeout: 60_000,
      },
    });
    if (!response) throw new Error("Passkey authentication was cancelled");
    if (!matchesBrowserId(credential, response.id))
      throw new Error("Passkey authentication verification failed");
    if (
      session.getStoredAccountProfile() === PILOT_PASSKEY_PROFILE &&
      !(await adapters.verifyAssertion({
        response,
        publicKey: credential.publicKey,
        challenge,
        rpId,
      }))
    ) {
      throw new Error("Passkey authentication verification failed");
    }
    return buildSession(
      assertActive,
      { ...credential, signingId: response.id },
      storedUsername || userName || "",
      chainId,
      rpId,
      true,
      [],
      originalExpected ? LEGACY_PASSKEY_PROFILE : session.getStoredAccountProfile(),
      originalExpected
    );
  };

  const restoreSession = fromPromise<RestoreSessionResult | null, RestoreInput>(
    async ({ input, signal }) => {
      const assertActive = guardSessionCommit(signal);
      const authMode = session.getAuthMode();
      if (session.hasSignedOutSentinel() || authMode === "wallet" || authMode === "embedded") {
        return null;
      }
      const credential = session.getStoredCredential();
      if (!credential) return null;
      try {
        const rpId = cachedPasskeyRpId();
        const profile = session.getStoredAccountProfile();
        const expected =
          session.getStoredProfileAddress(profile, credential) ??
          session.getStoredSmartAccountAddress();
        const { client, address } =
          profile === LEGACY_PASSKEY_PROFILE
            ? await adapters.buildSmartAccount(
                credential,
                input.chainId,
                rpId,
                expected ?? undefined
              )
            : await adapters.buildSmartAccount(credential, input.chainId, rpId, undefined, profile);
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
        if (
          profile === PILOT_PASSKEY_PROFILE &&
          !(await adapters.hasPilotAccountProof(credential, address))
        ) {
          throw new Error("Pilot account authorization proof is unavailable");
        }
        assertActive();
        session.setStoredSmartAccountAddress(address);
        telemetry.restore({
          source: "restore",
          outcome: "success",
          passkeyServerEnabled: adapters.isServerEnabled(),
          hasLocalCredential: true,
        });
        return {
          accountProfile: profile,
          credential,
          smartAccountClient: client,
          resolveSmartAccountClient: createSmartAccountClientResolver({
            credential,
            primaryClient: client,
            primaryChainId: input.chainId,
            expectedAddress: address,
            buildSmartAccount: (credential, targetChainId) =>
              profile === PILOT_PASSKEY_PROFILE
                ? adapters.buildSmartAccount(credential, targetChainId, rpId, undefined, profile)
                : adapters.buildSmartAccount(credential, targetChainId, rpId, address),
          }),
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

  const registerPasskey = fromPromise<PasskeySessionResult, PasskeyInput>(
    async ({ input, signal }) => {
      const assertActive = guardSessionCommit(signal);
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
          ? await registerWithServer(assertActive, input.userName, input.chainId)
          : await buildSession(
              assertActive,
              await adapters
                .createLocalPasskey(input.userName)
                .then((credential) => ({ ...credential, signingId: credential.id })),
              input.userName,
              input.chainId,
              adapters.getRpId(),
              false,
              [],
              LEGACY_PASSKEY_PROFILE
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
    }
  );

  const authenticatePasskey = fromPromise<PasskeySessionResult, PasskeyInput>(
    async ({ input, signal }) => {
      const assertActive = guardSessionCommit(signal);
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
        let originalExpected: Hex | undefined;
        if (input.originalAccount) {
          const credential = session.getStoredCredential();
          if (!credential || session.getStoredAccountProfile() !== PILOT_PASSKEY_PROFILE)
            throw new Error("The original passkey account is unavailable");
          originalExpected =
            session.getStoredProfileAddress(LEGACY_PASSKEY_PROFILE, credential) ?? undefined;
          if (!originalExpected) throw new Error("The original passkey account is unavailable");
        }
        let result: (PasskeySessionResult & { source: AuthPasskeySource }) | null = null;
        if (serverEnabled && input.userName) {
          try {
            const serverResult = await authenticateByName(
              assertActive,
              input.userName,
              input.chainId,
              originalExpected
            );
            if (serverResult) result = { ...serverResult, source: "server" };
            else if (hasLocalCredential) {
              attemptSource = "local_cache";
              result = {
                ...(await authenticateFromCache(
                  assertActive,
                  input.userName,
                  input.chainId,
                  originalExpected
                )),
                source: "local_cache",
              };
            } else throw new PasskeyNotFoundError("name");
          } catch (serverError) {
            if (
              attemptSource === "server" &&
              hasLocalCredential &&
              matchesCachedUsername(input.userName) &&
              classifyAuthErrorReason(serverError) === "server_unavailable"
            ) {
              attemptSource = "local_cache";
              result = {
                ...(await authenticateFromCache(
                  assertActive,
                  input.userName,
                  input.chainId,
                  originalExpected
                )),
                source: "local_cache",
              };
            } else throw serverError;
          }
        } else {
          result = {
            ...(await authenticateFromCache(
              assertActive,
              input.userName,
              input.chainId,
              originalExpected
            )),
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
    }
  );

  return { restoreSession, registerPasskey, authenticatePasskey };
}

export const authServices = createAuthServices();
export const restoreSessionService = authServices.restoreSession;
export const registerPasskeyService = authServices.registerPasskey;
export const authenticatePasskeyService = authServices.authenticatePasskey;
