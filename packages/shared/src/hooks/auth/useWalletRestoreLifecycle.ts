import { reconnect } from "@wagmi/core";
import { useCallback, useEffect, useRef } from "react";

import { getAuthMode } from "../../modules/auth/session";
import { trackAuthWalletRestore } from "../../modules/app/authWalletRestoreAnalytics";
import { logger } from "../../modules/app/logger";
import { connectivityStore } from "../../stores/connectivity";
import type { AuthActor } from "../../workflows/authActor";
import type { WalletConnectionType } from "../../workflows/authMachine";

const RESTORE_DELAYED_MS = 2_000;
const RESTORE_TIMEOUT_MS = 15_000;

type AuthSnapshot = ReturnType<AuthActor["getSnapshot"]>;
type WagmiConfig = Parameters<typeof reconnect>[0];

interface RestoreAttempt {
  mode: WalletConnectionType;
  startedAt: number;
  activeElapsedMs: number;
  activeStartedAt: number | null;
  delayedReported: boolean;
  failed: boolean;
}

/**
 * The restore deadline only counts while the connector could actually answer:
 * a visible page with a usable connection. Offline, the remembered wallet
 * identity keeps the session readable and the clock waits for reconnection.
 */
function canAdvanceRestoreClock(): boolean {
  return (
    document.visibilityState === "visible" &&
    connectivityStore.getStatusSnapshot().state !== "offline"
  );
}

function canRetryConnector(): boolean {
  return canAdvanceRestoreClock();
}

/** Keeps persisted wallet intent protected while its connector hydrates. */
export function useWalletRestoreLifecycle(
  actor: AuthActor,
  snapshot: AuthSnapshot,
  wagmiConfig: WagmiConfig
): () => void {
  const attemptRef = useRef<RestoreAttempt | null>(null);
  const restoringMode: WalletConnectionType | null = snapshot.matches({ restoring: "wallet" })
    ? "wallet"
    : snapshot.matches({ restoring: "embedded" })
      ? "embedded"
      : null;

  const beginAttempt = useCallback((mode: WalletConnectionType) => {
    if (attemptRef.current) return;
    attemptRef.current = {
      mode,
      startedAt: Date.now(),
      activeElapsedMs: 0,
      activeStartedAt: null,
      delayedReported: false,
      failed: false,
    };
    trackAuthWalletRestore({ authMode: mode, outcome: "started" });
  }, []);

  useEffect(() => {
    const storedMode = getAuthMode();
    if (storedMode === "wallet" || storedMode === "embedded") beginAttempt(storedMode);
  }, [beginAttempt]);

  useEffect(() => {
    if (!restoringMode) return;
    if (attemptRef.current?.mode !== restoringMode) {
      attemptRef.current = null;
      beginAttempt(restoringMode);
    }

    let delayedTimer: number | null = null;
    let timeoutTimer: number | null = null;
    const clearTimers = () => {
      if (delayedTimer !== null) window.clearTimeout(delayedTimer);
      if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
      delayedTimer = null;
      timeoutTimer = null;
    };
    const stopClock = () => {
      clearTimers();
      const attempt = attemptRef.current;
      if (!attempt || attempt.mode !== restoringMode || attempt.activeStartedAt === null) return;
      attempt.activeElapsedMs += Date.now() - attempt.activeStartedAt;
      attempt.activeStartedAt = null;
    };
    const startClock = () => {
      const attempt = attemptRef.current;
      if (
        !attempt ||
        attempt.mode !== restoringMode ||
        attempt.failed ||
        attempt.activeStartedAt !== null ||
        !canAdvanceRestoreClock()
      ) {
        return;
      }
      attempt.activeStartedAt = Date.now();
      if (!attempt.delayedReported) {
        delayedTimer = window.setTimeout(
          () => {
            const current = attemptRef.current;
            if (!current || current.mode !== restoringMode || current.failed) return;
            current.delayedReported = true;
            trackAuthWalletRestore({
              authMode: restoringMode,
              outcome: "delayed",
              durationMs: Date.now() - current.startedAt,
            });
          },
          Math.max(0, RESTORE_DELAYED_MS - attempt.activeElapsedMs)
        );
      }
      timeoutTimer = window.setTimeout(
        () => {
          const current = attemptRef.current;
          if (!current || current.mode !== restoringMode || current.failed) return;
          current.failed = true;
          actor.send({ type: "RESTORE_TIMEOUT" });
          trackAuthWalletRestore({
            authMode: restoringMode,
            outcome: "failed",
            reason: "timeout",
            durationMs: Date.now() - current.startedAt,
            sessionKept: actor.getSnapshot().matches("authenticated"),
          });
        },
        Math.max(0, RESTORE_TIMEOUT_MS - attempt.activeElapsedMs)
      );
    };
    const syncClock = () => (canAdvanceRestoreClock() ? startClock() : stopClock());
    let retryArmed = true;
    const retryRestore = () => {
      syncClock();
      if (!retryArmed || !canRetryConnector() || !actor.getSnapshot().matches("restoring")) return;
      retryArmed = false;
      void reconnect(wagmiConfig).catch((error) => {
        logger.debug("[AuthProvider] Wallet reconnect retry did not complete", { error });
      });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") retryRestore();
      else {
        retryArmed = true;
        stopClock();
      }
    };

    // Browsers announce `online` before the reachability probe has necessarily
    // settled. The native event starts that transition; the store transition
    // is the authoritative retry point once the connector can answer.
    const handleConnectivity = () => {
      syncClock();
      if (canRetryConnector()) retryRestore();
      else retryArmed = true;
    };
    const unsubscribeConnectivity = connectivityStore.subscribeStatus(handleConnectivity);

    startClock();
    window.addEventListener("online", retryRestore);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopClock();
      unsubscribeConnectivity();
      window.removeEventListener("online", retryRestore);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [actor, beginAttempt, restoringMode, wagmiConfig]);

  // A wallet session kept after a timeout asks the wallet again each time the
  // app returns or comes back online, until the wallet answers or the member signs out.
  // Only a wallet connector answers for the wallet; an embedded one does not.
  const walletAwaitingReconnect =
    snapshot.matches({ authenticated: "wallet" }) &&
    !(
      snapshot.context.externalWalletConnected &&
      snapshot.context.externalWalletConnectionType === "wallet"
    );
  const awaitedReconnectRef = useRef(false);

  useEffect(() => {
    if (!walletAwaitingReconnect) return;
    awaitedReconnectRef.current = true;
    // One attempt per return or reconnection: an attempt the connector never
    // settles is abandoned by the next one instead of blocking it.
    let attempt = 0;
    let inFlight: number | null = null;
    const retry = () => {
      if (inFlight === attempt || !canRetryConnector()) return;
      const current = attempt;
      inFlight = current;
      void reconnect(wagmiConfig)
        .catch((error) => {
          logger.debug("[AuthProvider] Wallet reconnect retry did not complete", { error });
        })
        .finally(() => {
          if (inFlight === current) inFlight = null;
        });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") retry();
      else attempt += 1;
    };
    // The store publishes every check; only the move back online is a reason to ask again.
    let lastState = connectivityStore.getStatusSnapshot().state;
    const handleConnectivity = () => {
      const { state } = connectivityStore.getStatusSnapshot();
      if (lastState === "offline" && state !== "offline") {
        attempt += 1;
        retry();
      }
      lastState = state;
    };
    const unsubscribeConnectivity = connectivityStore.subscribeStatus(handleConnectivity);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      unsubscribeConnectivity();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [walletAwaitingReconnect, wagmiConfig]);

  useEffect(() => {
    if (walletAwaitingReconnect || !awaitedReconnectRef.current) return;
    awaitedReconnectRef.current = false;
    if (snapshot.matches({ authenticated: "wallet" })) {
      trackAuthWalletRestore({ authMode: "wallet", outcome: "reconnected" });
    }
  }, [walletAwaitingReconnect, snapshot]);

  useEffect(() => {
    if (restoringMode || !attemptRef.current) return;
    const attempt = attemptRef.current;
    if (snapshot.matches({ authenticated: attempt.mode }) && !attempt.failed) {
      trackAuthWalletRestore({
        authMode: attempt.mode,
        outcome: "success",
        durationMs: Date.now() - attempt.startedAt,
      });
      attemptRef.current = null;
    } else if (attempt.failed || getAuthMode() !== attempt.mode) {
      attemptRef.current = null;
    }
  }, [restoringMode, snapshot]);

  return useCallback(() => {
    attemptRef.current = null;
  }, []);
}
