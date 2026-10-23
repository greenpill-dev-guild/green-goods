import { disconnect } from "@wagmi/core";
import { useCallback, useEffect, useRef } from "react";

import { logger } from "../../modules/app/logger";
import type { AuthContext } from "../../workflows/authMachine.types";
import { useTimeout } from "../utils/useTimeout";

type WagmiConfig = Parameters<typeof disconnect>[0];

/** How long a login waits for a signed-out wallet to let go before it goes ahead. */
const RELEASE_WAIT_MS = 4_000;

/**
 * Disconnecting the wallet connector, and letting go of it on sign-out.
 *
 * Signing out of a wallet session releases the wallet, so the next wallet login
 * asks which wallet to use instead of silently reusing the one signed out of.
 * Sign-out never waits for the release: ending a WalletConnect session can need
 * the network. A login that adds a connection waits for it, within a bound,
 * because wagmi's disconnect finishes against the connections it saw when it
 * started and would drop a connection made in the meantime.
 */
export function useWalletDisconnect(
  wagmiConfig: WagmiConfig,
  { isConnected, isConnecting }: { isConnected: boolean; isConnecting: boolean }
) {
  const releaseRef = useRef<Promise<void> | null>(null);
  const quarantineRef = useRef<{ resolve: () => void; releasing: boolean } | null>(null);
  const latestLoginRef = useRef(0);
  const isMountedRef = useRef(true);
  const { set: setTimer, clear: clearTimer } = useTimeout();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      quarantineRef.current?.resolve();
      quarantineRef.current = null;
    };
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect(wagmiConfig);
    } catch (error) {
      logger.debug("[AuthProvider] disconnect failed", { error });
    }
  }, [wagmiConfig]);

  // Wagmi cannot abort an in-flight connector request. Disconnecting before it
  // settles does not stop connect() from adding the old connection afterward.
  const releaseQuarantinedConnection = useCallback(() => {
    const quarantine = quarantineRef.current;
    if (!quarantine || isConnecting) return;
    if (!isConnected) {
      quarantineRef.current = null;
      quarantine.resolve();
    } else if (!quarantine.releasing) {
      quarantine.releasing = true;
      void disconnectWallet().finally(() => {
        quarantine.releasing = false;
      });
    }
  }, [isConnected, isConnecting, disconnectWallet]);
  useEffect(releaseQuarantinedConnection, [releaseQuarantinedConnection]);

  const isConnectionQuarantined = useCallback(() => quarantineRef.current !== null, []);

  /**
   * Starts letting go of the wallet a session was signed in with. Only the
   * wallet's own connection is released, never an unrelated embedded one.
   */
  const releaseWallet = useCallback(
    (
      session: Pick<
        AuthContext,
        "walletAddress" | "externalWalletConnected" | "externalWalletConnectionType"
      >
    ) => {
      if (quarantineRef.current) return;
      if (isConnecting) {
        const settled = new Promise<void>((resolve) => {
          quarantineRef.current = { resolve, releasing: false };
        });
        const release = settled.finally(() => {
          if (releaseRef.current === release) releaseRef.current = null;
        });
        releaseRef.current = release;
        return;
      }
      const ownsWalletConnection =
        session.walletAddress !== null &&
        session.externalWalletConnected &&
        session.externalWalletConnectionType === "wallet";
      if (!ownsWalletConnection) return;
      const release: Promise<void> = disconnectWallet().finally(() => {
        if (releaseRef.current === release) releaseRef.current = null;
      });
      releaseRef.current = release;
    },
    [disconnectWallet, isConnecting]
  );

  /**
   * Runs `next` once a pending release settles; false when nothing is pending.
   * Only the latest login chosen while waiting goes ahead.
   */
  const afterWalletRelease = useCallback(
    (next: () => void): boolean => {
      const release = releaseRef.current;
      if (!release) return false;
      releaseQuarantinedConnection();
      const login = ++latestLoginRef.current;
      let done = false;
      const proceed = () => {
        if (done || login !== latestLoginRef.current || !isMountedRef.current) return;
        done = true;
        clearTimer();
        next();
      };
      // Never let a timeout turn an ended request into a fresh login. It must
      // settle and its resulting connection must be gone before intent resumes.
      if (!quarantineRef.current) setTimer(proceed, RELEASE_WAIT_MS);
      void release.then(proceed, proceed);
      return true;
    },
    [setTimer, clearTimer, releaseQuarantinedConnection]
  );

  /** Drops any login still waiting on a release, when another sign-in method wins. */
  const cancelDeferredLogin = useCallback(() => {
    latestLoginRef.current += 1;
  }, []);

  return {
    disconnectWallet,
    releaseWallet,
    afterWalletRelease,
    cancelDeferredLogin,
    isConnectionQuarantined,
  };
}
