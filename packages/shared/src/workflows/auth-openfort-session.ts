/**
 * Email sessions for the auth machine.
 *
 * Sign-in verifies the person's code with Openfort, sets up or recovers their wallet through
 * the agent's single-use recovery session, and opens the Kernel account that wallet owns.
 * A reload reopens the same account from the local record without asking Openfort, so an
 * offline app still knows whose account it is; signing reconnects the wallet when needed.
 */

import type { SmartAccountClient } from "permissionless";
import type { Hex } from "viem";
import { fromPromise } from "xstate";
import { createPublicClientForChain } from "../config/pimlico";
import { logger } from "../modules/app/logger";
import {
  clearStoredOpenfortAccount,
  createOpenfortKernelAccount,
  createOpenfortOwner,
  getStoredOpenfortAccount,
  setStoredOpenfortAccount,
} from "../modules/auth/openfort-account";
import { defaultOpenfortWallet, type OpenfortWallet } from "../modules/auth/openfort-wallet";
import {
  clearAuthMode,
  getAuthMode,
  type SessionStorage,
  setSignedOutSentinel,
} from "../modules/auth/session";
import { guardSessionCommit } from "../modules/auth/sessionSignOut";
import { createSmartAccountClientResolver } from "../modules/auth/smartAccountClientResolver";
import { createSponsoredSmartAccountClient } from "../modules/auth/sponsored-smart-account-client";
import type { OpenfortSignInMethod, SmartAccountClientResolver } from "../types/auth";

export interface OpenfortSessionResult {
  smartAccountClient: SmartAccountClient;
  resolveSmartAccountClient: SmartAccountClientResolver;
  smartAccountAddress: Hex;
  /** The email, shown as whose account is open. */
  userName: string;
  method: OpenfortSignInMethod;
}

export interface OpenfortOperationInput {
  email: string;
  code: string;
  chainId: number;
}

export interface OpenfortSessionDeps {
  wallet?: OpenfortWallet;
  storage?: SessionStorage;
  /** Web Locks shared by this device's tabs; null where the browser has none. */
  locks?: Pick<LockManager, "request"> | null;
  /** Builds the sponsored client for one chain; the default uses Pimlico like passkeys. */
  buildSmartAccount?: (
    owner: Hex,
    chainId: number,
    knownAddress?: Hex
  ) => Promise<{ client: SmartAccountClient; address: Hex }>;
}

/** Held by the tab that is signing in, from the code until the account record is saved. */
const SIGN_IN_LOCK = "greengoods-openfort-sign-in";

/** Emails compare trimmed and in lower case, so the same person reaches the same account. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function createOpenfortSessionServices(deps: OpenfortSessionDeps = {}) {
  const wallet = deps.wallet ?? defaultOpenfortWallet;
  const storage = deps.storage;
  const locks =
    deps.locks !== undefined
      ? deps.locks
      : typeof navigator !== "undefined"
        ? (navigator.locks ?? null)
        : null;
  const holdingSignIn = <T>(signIn: () => Promise<T>): Promise<T> =>
    locks ? locks.request(SIGN_IN_LOCK, signIn) : signIn();
  /** Whether some tab is signing in now. Without Web Locks nothing can tell, so assume one is. */
  const signInInFlight = (): Promise<boolean> =>
    locks
      ? locks.request(SIGN_IN_LOCK, { ifAvailable: true }, async (lock) => lock === null)
      : Promise.resolve(true);

  const buildSmartAccount: NonNullable<OpenfortSessionDeps["buildSmartAccount"]> =
    deps.buildSmartAccount ??
    (async (owner, chainId, knownAddress) => {
      const account = await createOpenfortKernelAccount({
        client: createPublicClientForChain(chainId),
        owner: createOpenfortOwner(wallet, owner, chainId),
        knownAddress,
      });
      return {
        client: createSponsoredSmartAccountClient(account, chainId),
        address: account.address as Hex,
      };
    });

  const openSession = async (
    owner: Hex,
    chainId: number,
    email: string,
    knownAddress?: Hex
  ): Promise<OpenfortSessionResult> => {
    const { client, address } = await buildSmartAccount(owner, chainId, knownAddress);
    return {
      smartAccountClient: client,
      resolveSmartAccountClient: createSmartAccountClientResolver<Hex>({
        credential: owner,
        primaryClient: client,
        primaryChainId: chainId,
        expectedAddress: address,
        buildSmartAccount: (ownerAddress, targetChainId) =>
          buildSmartAccount(ownerAddress, targetChainId, address),
      }),
      smartAccountAddress: address,
      userName: email,
      method: "email",
    };
  };

  /** A code request never leaves the previous person's Openfort session behind (see wallet). */
  const requestCode = (email: string) => wallet.requestCode(normalizeEmail(email));

  const authenticateOpenfort = fromPromise<OpenfortSessionResult, OpenfortOperationInput>(
    ({ input, signal }) =>
      holdingSignIn(async () => {
        const assertActive = guardSessionCommit(signal);
        const email = normalizeEmail(input.email);
        await wallet.verifyCode(email, input.code.trim());
        try {
          assertActive();
          const owner = await wallet.configureWallet(input.chainId);
          assertActive();
          const session = await openSession(owner, input.chainId, email);
          assertActive();
          setStoredOpenfortAccount(
            {
              ownerAddress: owner,
              smartAccountAddress: session.smartAccountAddress,
              method: "email",
              email,
            },
            storage
          );
          return session;
        } catch (error) {
          // A verified code must not leave a half-open Openfort session on a shared phone.
          await wallet.signOut().catch((signOutError: unknown) =>
            logger.warn("[Auth] Openfort sign-out after a failed sign-in failed", {
              signOutError,
            })
          );
          throw error;
        }
      })
  );

  const restoreOpenfort = fromPromise<OpenfortSessionResult | null, { chainId: number }>(
    async ({ input, signal }) => {
      const assertActive = guardSessionCommit(signal);
      if (getAuthMode(storage) !== "openfort") return null;
      const record = getStoredOpenfortAccount(storage);
      if (!record) {
        // A tab signing in has saved the mode but not yet the record: leave it alone.
        if (await signInInFlight()) return null;
        // The page closed after the code was accepted and before the account opened: end the
        // Openfort session that sign-in left, so the next person on this phone starts clean.
        // The device stays signed out, and startup does not wait on Openfort's network.
        clearAuthMode(storage);
        setSignedOutSentinel(storage);
        void wallet
          .signOut()
          .catch((error: unknown) =>
            logger.warn("[Auth] Openfort sign-out after an unfinished sign-in failed", { error })
          );
        return null;
      }
      // Openfort signed out elsewhere (another tab, an expired session): this device is too.
      // If the wallet cannot even load, offline, the record still opens the account to read and
      // queue work; the first signature reconnects or asks to sign in again.
      const stored = await wallet.hasStoredSession().catch((error: unknown) => {
        logger.warn("[Auth] Openfort wallet unavailable while restoring", { error });
        return true;
      });
      if (!stored) {
        clearStoredOpenfortAccount(storage);
        return null;
      }
      try {
        const session = await openSession(
          record.ownerAddress,
          input.chainId,
          record.email,
          record.smartAccountAddress
        );
        assertActive();
        return session;
      } catch (error) {
        logger.error("[Auth] Failed to restore email session", { error });
        return null;
      }
    }
  );

  /** Ends the Openfort session on this device, even offline, and forgets the record. */
  const signOutOpenfort = async () => {
    clearStoredOpenfortAccount(storage);
    await wallet.signOut();
  };

  return { requestCode, authenticateOpenfort, restoreOpenfort, signOutOpenfort };
}

export type OpenfortSessionServices = ReturnType<typeof createOpenfortSessionServices>;

export const openfortSessionServices: OpenfortSessionServices = createOpenfortSessionServices();
