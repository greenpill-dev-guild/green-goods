import { reconnect } from "@wagmi/core";
import { useCallback, useEffect, useRef } from "react";

import { getAuthMode } from "../../modules/auth/session";
import { trackAuthWalletRestore } from "../../modules/app/authWalletRestoreAnalytics";
import { logger } from "../../modules/app/logger";
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

function canRestoreProgress(): boolean {
  return navigator.onLine !== false && document.visibilityState === "visible";
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
        !canRestoreProgress()
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
          trackAuthWalletRestore({
            authMode: restoringMode,
            outcome: "failed",
            reason: "timeout",
            durationMs: Date.now() - current.startedAt,
          });
          actor.send({ type: "RESTORE_TIMEOUT" });
        },
        Math.max(0, RESTORE_TIMEOUT_MS - attempt.activeElapsedMs)
      );
    };
    const syncClock = () => (canRestoreProgress() ? startClock() : stopClock());
    const retryRestore = () => {
      syncClock();
      if (!canRestoreProgress() || !actor.getSnapshot().matches("restoring")) return;
      void reconnect(wagmiConfig).catch((error) => {
        logger.debug("[AuthProvider] Wallet reconnect retry did not complete", { error });
      });
    };
    const handleVisibility = () =>
      document.visibilityState === "visible" ? retryRestore() : stopClock();

    startClock();
    window.addEventListener("online", retryRestore);
    window.addEventListener("offline", stopClock);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopClock();
      window.removeEventListener("online", retryRestore);
      window.removeEventListener("offline", stopClock);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [actor, beginAttempt, restoringMode, wagmiConfig]);

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
