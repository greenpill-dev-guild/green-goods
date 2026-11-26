import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { getAppKit } from "../../config/appkit";
import {
  type AuthWalletConnectFailureReason,
  type AuthWalletConnectPlatform,
  type AuthWalletConnectWallet,
  type WalletConnectEvent,
  trackAuthWalletConnectFailed,
  trackAuthWalletConnectStarted,
  trackAuthWalletConnectSuccess,
} from "../../modules/app/authWalletConnectAnalytics";
import { logger } from "../../modules/app/logger";
import type { WalletConnectFailure } from "../../types/auth";
import type { AuthActor } from "../../workflows/authActor";
import { WalletModalContext } from "./useWalletModalOpen";

/**
 * Time on screen a phone wallet gets to answer once it is chosen, counted afresh
 * each time the page comes back to the front.
 */
const WALLET_ANSWER_TIMEOUT_MS = 20_000;
/**
 * A wallet app that opens takes the page out of the front this soon after the choice
 * or the tap that opened it. A screen that turns off, or a later switch to another
 * app, comes later than that.
 */
const WALLET_APP_SWITCH_MS = 5_000;

const NAMED_WALLETS = ["metamask", "rabby", "rainbow", "coinbase"] as const;

type AuthSnapshot = ReturnType<AuthActor["getSnapshot"]>;

interface WalletChoice {
  wallet: AuthWalletConnectWallet;
  platform: AuthWalletConnectPlatform;
  chosenAt: number;
  /** The page left the front right after the choice or a tap: the wallet app opened. */
  appOpened: boolean;
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
  return { ...choiceRecord(attempt), reason, appOpened: attempt.choice?.appOpened };
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
  const walletModal = useContext(WalletModalContext);
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
    let lastTapAt = 0;
    const stopClock = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    // One failure record per choice, so a later rejection or cancel adds none.
    const fail = (attempt: WalletConnectAttempt, reason: AuthWalletConnectFailureReason) => {
      stopClock();
      if (attempt.choice?.reported) return;
      if (attempt.choice) attempt.choice.reported = true;
      trackAuthWalletConnectFailed(failureRecord(attempt, reason));
    };
    const timeOut = () => {
      timer = null;
      const attempt = current();
      if (!attempt?.choice) return;
      attempt.timedOut = true;
      fail(attempt, "timeout");
      setFailure("timeout");
      logger.warn("[AuthProvider] The chosen wallet app did not open");
    };
    // Only a phone wallet takes the member away from this page, so only its silence
    // on screen, while its app has not opened, means it never did.
    const startClock = () => {
      const choice = current()?.choice;
      if (
        !choice ||
        choice.platform !== "mobile" ||
        choice.reported ||
        choice.appOpened ||
        timer !== null ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      timer = window.setTimeout(timeOut, WALLET_ANSWER_TIMEOUT_MS);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startClock();
        return;
      }
      stopClock();
      const choice = current()?.choice;
      if (choice && Date.now() - Math.max(choice.chosenAt, lastTapAt) <= WALLET_APP_SWITCH_MS) {
        choice.appOpened = true;
      }
    };
    // A tap that opens the wallet (the modal's Open button) comes just before the page leaves.
    const handleTap = () => {
      lastTapAt = Date.now();
    };

    const handleConnection = (event: WalletConnectEvent, timestamp = Date.now()) => {
      const attempt = current();
      if (!attempt || timestamp < attempt.startedAt) return;
      if (event.type === "selected") {
        stopClock();
        attempt.choice = {
          wallet: event.wallet,
          platform: event.platform,
          chosenAt: timestamp,
          appOpened: false,
          reported: false,
        };
        setFailure(null);
        startClock();
      } else {
        fail(attempt, event.reason);
        if (event.reason === "connect_error") setFailure("connect_error");
      }
    };
    let lastEvent: unknown;
    const unsubscribe = walletModal
      ? walletModal.subscribeConnection?.(handleConnection)
      : getAppKit()?.subscribeEvents(({ timestamp, data }) => {
          // The store can notify again with the same event, including one from an old attempt.
          if (data === lastEvent) return;
          lastEvent = data;
          if (data.event === "SELECT_WALLET") {
            handleConnection(
              {
                type: "selected",
                wallet: toWallet(data.properties.name),
                platform: data.properties.platform,
              },
              timestamp
            );
          } else if (data.event === "CONNECT_ERROR" || data.event === "USER_REJECTED") {
            handleConnection(
              {
                type: "failed",
                reason: data.event === "CONNECT_ERROR" ? "connect_error" : "rejected",
              },
              timestamp
            );
          }
        });
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("pointerdown", handleTap, true);
    return () => {
      stopClock();
      unsubscribe?.();
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("pointerdown", handleTap, true);
    };
  }, [attemptStartedAt, walletModal]);

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
