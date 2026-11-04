import { useCallback, useEffect, useRef, useState } from "react";

import { getAppKit } from "../../config/appkit";
import {
  type AuthWalletConnectFailureReason,
  type AuthWalletConnectPlatform,
  type AuthWalletConnectWallet,
  trackAuthWalletConnectFailed,
  trackAuthWalletConnectStarted,
  trackAuthWalletConnectSuccess,
} from "../../modules/app/authWalletConnectAnalytics";
import { logger } from "../../modules/app/logger";
import type { WalletConnectFailure } from "../../types/auth";
import type { AuthActor } from "../../workflows/authActor";

/**
 * Time on screen a phone wallet gets to answer once it is chosen. A wallet app
 * that opens sends this page to the background, and time there does not count.
 */
const WALLET_ANSWER_TIMEOUT_MS = 20_000;

const NAMED_WALLETS = ["metamask", "rabby", "rainbow", "coinbase"] as const;

type AuthSnapshot = ReturnType<AuthActor["getSnapshot"]>;

interface WalletChoice {
  wallet: AuthWalletConnectWallet;
  platform: AuthWalletConnectPlatform;
  foregroundMs: number;
  foregroundSince: number | null;
  /** The page went to the background after the choice, so the wallet app opened. */
  backgrounded: boolean;
  /** This choice already ended in a failure record. */
  reported: boolean;
}

interface WalletConnectAttempt {
  startedAt: number;
  choice: WalletChoice | null;
  /** A wallet in this attempt timed out; a later answer is still recorded. */
  timedOut: boolean;
}

/** The modal names wallets as their makers do ("Rabby Wallet"); telemetry keeps a fixed set. */
function toWallet(name: string): AuthWalletConnectWallet {
  const lower = name.toLowerCase();
  return NAMED_WALLETS.find((wallet) => lower.includes(wallet)) ?? "other";
}

function choiceRecord(attempt: WalletConnectAttempt) {
  return {
    wallet: attempt.choice?.wallet,
    platform: attempt.choice?.platform,
    durationMs: Date.now() - attempt.startedAt,
  };
}

function successRecord(attempt: WalletConnectAttempt) {
  return { ...choiceRecord(attempt), timedOut: attempt.timedOut };
}

function failureRecord(attempt: WalletConnectAttempt, reason: AuthWalletConnectFailureReason) {
  return { ...choiceRecord(attempt), reason, backgrounded: attempt.choice?.backgrounded };
}

/**
 * Follows the wallet modal while a signed-out member uses it to sign in, from the
 * moment it opens until a wallet connects or the modal closes. A chosen phone wallet
 * whose app never comes to the front is recorded as a timeout, and the modal stays
 * open with its own ways forward. Returns why the last attempt failed, so the sign-in
 * screen can offer a passkey, until sign-in moves on.
 */
export function useWalletConnectLifecycle(
  actor: AuthActor,
  snapshot: AuthSnapshot,
  { isConnected, walletModalOpen }: { isConnected: boolean; walletModalOpen: boolean }
): WalletConnectFailure | null {
  const attemptRef = useRef<WalletConnectAttempt | null>(null);
  // Keys the modal's event subscription to the attempt; the ref holds its progress.
  const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null);
  const [failure, setFailure] = useState<WalletConnectFailure | null>(null);
  // The only state from which a connected wallet signs the member in (AuthProvider).
  const unauthenticated = snapshot.matches("unauthenticated");

  const end = useCallback(() => {
    attemptRef.current = null;
    setAttemptStartedAt(null);
  }, []);

  useEffect(() => {
    if (attemptStartedAt === null) return;
    const current = () => {
      const attempt = attemptRef.current;
      return attempt?.startedAt === attemptStartedAt ? attempt : null;
    };

    let timer: number | null = null;
    const stopClock = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      const choice = current()?.choice;
      if (!choice || choice.foregroundSince === null) return;
      choice.foregroundMs += Date.now() - choice.foregroundSince;
      choice.foregroundSince = null;
    };
    const timeOut = () => {
      timer = null;
      const attempt = current();
      if (!attempt?.choice) return;
      attempt.choice.reported = true;
      attempt.timedOut = true;
      trackAuthWalletConnectFailed(failureRecord(attempt, "timeout"));
      setFailure("timeout");
      logger.warn("[AuthProvider] The chosen wallet app did not open");
    };
    // Only a phone wallet takes the member away from this page, so only its silence
    // on screen, before the page ever leaves the front, means its app never opened.
    const startClock = () => {
      const choice = current()?.choice;
      if (
        !choice ||
        choice.platform !== "mobile" ||
        choice.reported ||
        choice.backgrounded ||
        choice.foregroundSince !== null ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      choice.foregroundSince = Date.now();
      timer = window.setTimeout(
        timeOut,
        Math.max(0, WALLET_ANSWER_TIMEOUT_MS - choice.foregroundMs)
      );
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startClock();
        return;
      }
      const choice = current()?.choice;
      if (choice) choice.backgrounded = true;
      stopClock();
    };
    const fail = (attempt: WalletConnectAttempt, reason: AuthWalletConnectFailureReason) => {
      stopClock();
      if (attempt.choice) attempt.choice.reported = true;
      trackAuthWalletConnectFailed(failureRecord(attempt, reason));
    };

    let lastEvent: unknown = null;
    const unsubscribe = getAppKit()?.subscribeEvents(({ timestamp, data }) => {
      const attempt = current();
      // The events store also notifies for its own bookkeeping, still holding the
      // last event, which can date from before this attempt.
      if (!attempt || data === lastEvent || timestamp < attempt.startedAt) return;
      lastEvent = data;
      if (data.event === "SELECT_WALLET") {
        stopClock();
        attempt.choice = {
          wallet: toWallet(data.properties.name),
          platform: data.properties.platform,
          foregroundMs: 0,
          foregroundSince: null,
          backgrounded: false,
          reported: false,
        };
        setFailure(null);
        startClock();
      } else if (data.event === "CONNECT_ERROR") {
        // The modal goes back to its wallets, so trying again is a new choice.
        fail(attempt, "connect_error");
        setFailure("connect_error");
      } else if (data.event === "USER_REJECTED") {
        fail(attempt, "rejected");
      }
    });
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopClock();
      unsubscribe?.();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [attemptStartedAt]);

  // A wallet that connects ends the attempt, whether or not the modal closes after it.
  const wasConnectedRef = useRef(isConnected);
  useEffect(() => {
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = isConnected;
    const attempt = attemptRef.current;
    if (!attempt || !isConnected || wasConnected) return;
    trackAuthWalletConnectSuccess(successRecord(attempt));
    end();
  }, [isConnected, end]);

  const modalWasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = modalWasOpenRef.current;
    modalWasOpenRef.current = walletModalOpen;
    if (!wasOpen && walletModalOpen) {
      if (!unauthenticated || isConnected) return;
      const startedAt = Date.now();
      attemptRef.current = { startedAt, choice: null, timedOut: false };
      setAttemptStartedAt(startedAt);
      setFailure(null);
      trackAuthWalletConnectStarted();
      return;
    }
    if (!wasOpen || walletModalOpen) return;
    // The wagmi flags can miss a dismissal (WalletConnect QR, mobile app-switch). The live
    // snapshot keeps a connect that already signed the member in from being clobbered.
    if (actor.getSnapshot().matches("wallet_connecting")) {
      logger.debug("[AuthProvider] Wallet modal closed while connecting, sending MODAL_CLOSED");
      actor.send({ type: "MODAL_CLOSED" });
    }
    const attempt = attemptRef.current;
    if (!attempt) return;
    if (isConnected) trackAuthWalletConnectSuccess(successRecord(attempt));
    else if (!attempt.choice?.reported)
      trackAuthWalletConnectFailed(failureRecord(attempt, "cancelled"));
    end();
  }, [actor, walletModalOpen, isConnected, unauthenticated, end]);

  // Any other way in, or a sign-in already held, makes the last wallet failure moot.
  useEffect(() => {
    if (failure && !unauthenticated) setFailure(null);
  }, [failure, unauthenticated]);

  return failure;
}
