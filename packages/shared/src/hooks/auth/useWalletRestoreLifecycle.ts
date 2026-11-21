import { reconnect } from "@wagmi/core";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getAuthMode } from "../../modules/auth/session";
import { trackAuthWalletRestore } from "../../modules/app/authWalletRestoreAnalytics";
import { logger } from "../../modules/app/logger";
import { connectivityStore } from "../../stores/connectivity";
import type { WalletRestoreState } from "../../types/auth";
import type { AuthActor } from "../../workflows/authActor";
import type { WalletConnectionType } from "../../workflows/authMachine";
import { isWalletModalOpen } from "./useWalletModalOpen";

const RESTORE_DELAYED_MS = 2_000;
const RESTORE_TIMEOUT_MS = 15_000;

type AuthSnapshot = ReturnType<AuthActor["getSnapshot"]>;
type WagmiConfig = Parameters<typeof reconnect>[0];

/**
 * Where a wallet account's wallet stands while it has not answered. Still
 * asked counts only for a remembered account, the one the App opens on; with
 * no address there is no account to open. Kept after the window, it waits for
 * a wallet connector: an embedded one does not answer for the wallet.
 */
function walletRestoreOf(snapshot: AuthSnapshot): WalletRestoreState | null {
  if (snapshot.matches({ restoring: "wallet" }))
    return snapshot.context.walletAddress ? "restoring" : null;
  const walletAnswered =
    snapshot.context.externalWalletConnected &&
    snapshot.context.externalWalletConnectionType === "wallet";
  return snapshot.matches({ authenticated: "wallet" }) && !walletAnswered ? "failed" : null;
}

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

/**
 * The App asks the wallet on its own only when it could answer, and never while
 * the person is connecting a wallet themselves. A phone comes back from approving
 * a Reconnect while the new pairing is still landing, and asking then reported the
 * wallet gone mid-connect and could end the pairing just approved (PRD-1540). Both
 * signs are read when the page comes back, not from the last render: the wallet
 * app can open before the App draws again. The modal shows the connection
 * starting; wagmi stays `connecting` after the modal closes for as long as the
 * wallet can still approve that request, so the App waits for both. While wagmi
 * is `reconnecting`, a restore is running and wagmi would skip another, so the
 * App waits for that too rather than spend its ask on nothing (PRD-1575).
 */
function canRetryConnector(wagmiConfig: WagmiConfig): boolean {
  const { status } = wagmiConfig.state;
  return (
    canAdvanceRestoreClock() &&
    !isWalletModalOpen() &&
    status !== "connecting" &&
    status !== "reconnecting"
  );
}

/**
 * Keeps persisted wallet intent protected while its connector hydrates. Says
 * where the wallet stands (`state`) and forgets the attempt on sign-out (`clear`).
 */
export function useWalletRestoreLifecycle(
  actor: AuthActor,
  snapshot: AuthSnapshot,
  wagmiConfig: WagmiConfig
): { state: WalletRestoreState | null; clear: () => void } {
  const attemptRef = useRef<RestoreAttempt | null>(null);
  // The restoring effect's retry, for the moment a restore settles without a wallet.
  const settleRetryRef = useRef<(() => void) | null>(null);
  const state = walletRestoreOf(snapshot);
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
      if (
        !retryArmed ||
        !canRetryConnector(wagmiConfig) ||
        !actor.getSnapshot().matches("restoring")
      )
        return;
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
      if (canRetryConnector(wagmiConfig)) retryRestore();
      else retryArmed = true;
    };
    const unsubscribeConnectivity = connectivityStore.subscribeStatus(handleConnectivity);
    // A restore that settles with no wallet is a chance of its own, apart from returns to the
    // front. It is worth taking when wallets have registered since the last such ask, as
    // AppKit's WalletConnect connector does a moment after launch; with the same wallets, a
    // second ask would only end the same way.
    let askedWithConnectors = -1;
    const retryAfterSettle = () => {
      const connectors = wagmiConfig.connectors.length;
      if (connectors === askedWithConnectors) return;
      askedWithConnectors = connectors;
      retryArmed = true;
      retryRestore();
    };
    settleRetryRef.current = retryAfterSettle;

    startClock();
    window.addEventListener("online", retryRestore);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopClock();
      unsubscribeConnectivity();
      if (settleRetryRef.current === retryAfterSettle) settleRetryRef.current = null;
      window.removeEventListener("online", retryRestore);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [actor, beginAttempt, restoringMode, wagmiConfig]);

  // wagmi runs one restore at a time and skips any asked for meanwhile, such as
  // AppKit's restore of a WalletConnect session that registers just after launch.
  // When a restore settles with no wallet while the App still waits, it asks again,
  // which reaches the wallets the skipped restore would have (PRD-1575). A
  // wallet that never answers cannot hold that first restore open: each wallet's
  // answer has a time limit (`boundConnectorRestores`).
  const wagmiStatus = wagmiConfig.state.status;
  const previousWagmiStatusRef = useRef(wagmiStatus);
  useEffect(() => {
    const previous = previousWagmiStatusRef.current;
    previousWagmiStatusRef.current = wagmiStatus;
    const settledWithoutWallet =
      (previous === "connecting" || previous === "reconnecting") && wagmiStatus === "disconnected";
    if (settledWithoutWallet && restoringMode === "wallet") settleRetryRef.current?.();
  }, [restoringMode, wagmiStatus]);

  // A wallet session kept after a timeout asks the wallet again each time the
  // app returns or comes back online, until the wallet answers or the member signs out.
  const walletAwaitingReconnect = state === "failed";
  const awaitedReconnectRef = useRef(false);

  useEffect(() => {
    if (!walletAwaitingReconnect) return;
    awaitedReconnectRef.current = true;
    // One attempt per return or reconnection. wagmi skips an attempt while an
    // earlier one runs; a wallet's time limit (`boundConnectorRestores`) ends that
    // earlier one, so the next return asks again.
    let attempt = 0;
    let inFlight: number | null = null;
    const retry = () => {
      if (inFlight === attempt || !canRetryConnector(wagmiConfig)) return;
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

  const clear = useCallback(() => {
    attemptRef.current = null;
  }, []);
  // The same object until the state moves, so a caller can depend on it.
  return useMemo(() => ({ state, clear }), [state, clear]);
}
