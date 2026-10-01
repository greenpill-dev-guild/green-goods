import { disconnect } from "@wagmi/core";
import { useCallback, useEffect, useRef } from "react";

import { logger } from "../../modules/app/logger";
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
export function useWalletDisconnect(wagmiConfig: WagmiConfig) {
  const releaseRef = useRef<Promise<void> | null>(null);
  const latestLoginRef = useRef(0);
  const isMountedRef = useRef(true);
  const { set: setTimer, clear: clearTimer } = useTimeout();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect(wagmiConfig);
    } catch (error) {
      logger.debug("[AuthProvider] disconnect failed", { error });
    }
  }, [wagmiConfig]);

  /** Starts letting go of the wallet a session was signed in with. */
  const releaseWallet = useCallback(() => {
    const release: Promise<void> = disconnectWallet().finally(() => {
      if (releaseRef.current === release) releaseRef.current = null;
    });
    releaseRef.current = release;
  }, [disconnectWallet]);

  /**
   * Runs `next` once a pending release settles; false when nothing is pending.
   * Only the latest login chosen while waiting goes ahead.
   */
  const afterWalletRelease = useCallback(
    (next: () => void): boolean => {
      const release = releaseRef.current;
      if (!release) return false;
      const login = ++latestLoginRef.current;
      let done = false;
      const proceed = () => {
        if (done || login !== latestLoginRef.current || !isMountedRef.current) return;
        done = true;
        clearTimer();
        next();
      };
      setTimer(proceed, RELEASE_WAIT_MS);
      void release.then(proceed, proceed);
      return true;
    },
    [setTimer, clearTimer]
  );

  return { disconnectWallet, releaseWallet, afterWalletRelease };
}
