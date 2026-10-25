import type { Hex } from "viem";
import { fromPromise } from "xstate";
import { logger } from "../modules/app/logger";
import {
  LEGACY_PASSKEY_PROFILE,
  PILOT_PASSKEY_PROFILE,
  type PasskeyAccountProfileId,
} from "../modules/auth/account-profile";
import type { PasskeyCredential } from "../modules/auth/session";
import { guardSessionCommit } from "../modules/auth/sessionSignOut";
import { createSmartAccountClientResolver } from "../modules/auth/smartAccountClientResolver";
import type { PasskeyAdapters } from "./auth-passkey-adapters";
import { classifyAuthErrorReason } from "./auth-passkey-errors";
import type { PasskeySessionResult, RestoreSessionResult } from "./authMachine.types";

interface RestoreInput {
  chainId: number;
}

/** Owns continuity, saved-profile commits and proof-checked session restoration. */
export function createPasskeySessionServices(adapters: PasskeyAdapters) {
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

  return { buildSession, cachedPasskeyRpId, restoreSession };
}
