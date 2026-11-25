/**
 * Shared auth composition: reports connector and user events to the auth machine,
 * restores saved sessions, and clears active sessions across same-origin tabs.
 * Recovery credentials remain on the device after sign-out.
 */

import { useSelector } from "@xstate/react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { isAddressEqual, type Hex } from "viem";
import { useAccount, useConfig } from "wagmi";

import { queryClient } from "../config/react-query";
import { useCrossTabSignOut } from "../hooks/auth/useCrossTabSignOut";
import { getActorSignOutRevision } from "../modules/auth/sessionSignOut";
import { useAuthActor } from "../hooks/auth/useAuthActor";
import { useHasStoredCredential } from "../hooks/auth/useHasStoredCredential";
import { useWalletConnectLifecycle } from "../hooks/auth/useWalletConnectLifecycle";
import { useWalletDisconnect } from "../hooks/auth/useWalletDisconnect";
import { useWalletRestoreLifecycle } from "../hooks/auth/useWalletRestoreLifecycle";
import { useWalletModal, useWalletModalOpen } from "../hooks/auth/useWalletModalOpen";
import {
  isAppKitEmbeddedConnector,
  useWalletSignInActions,
} from "../hooks/auth/useWalletSignInActions";
import { logger } from "../modules/app/logger";
import type { OpenfortEmailSession } from "../modules/auth/openfort-wallet";
import { useJoinRequestCountGrantStore } from "../stores/useJoinRequestCountGrantStore";
import {
  clearSessionForSignOut,
  clearStoredWalletAddress,
  clearStoredCredential,
  clearStoredSmartAccountAddress,
  clearStoredUsername,
  getAuthMode,
  getStoredUsername,
  getStoredWalletAddress,
  setAuthMode as saveAuthModeToStorage,
  setEmbeddedAddress,
  setStoredWalletAddress,
} from "../modules/auth/session";
import {
  openfortSessionServices,
  type OpenfortSignIn,
  type OpenfortSessionServices,
} from "../workflows/auth-openfort-session";
import { defaultPasskeyAdapters, type PasskeyAdapters } from "../workflows/auth-passkey-adapters";
import type { AuthActor } from "../workflows/authActor";
import type { WalletConnectionType } from "../workflows/authMachine";
import { createPilotAccountEnrollment } from "../modules/auth/pilot-account-enrollment";
import { deriveAuthSnapshotState } from "./authSnapshotState";
import {
  AuthStateContext,
  AuthActionsContext,
  AuthContext,
  type AuthStateValue,
  type AuthActionsValue,
  type AuthContextType,
} from "./authContext";

export {
  AuthStateContext,
  AuthActionsContext,
  AuthContext,
  type AuthStateValue,
  type AuthActionsValue,
  type AuthContextType,
} from "./authContext";
export {
  useAuthState,
  useAuthActions,
  useAuthContext,
  useOptionalAuthContext,
} from "../hooks/auth/useAuthContext";

export interface AuthProviderProps {
  children: React.ReactNode;
  adapters?: PasskeyAdapters;
  /** Email sessions; tests and stories pass their own. */
  openfort?: OpenfortSessionServices;
}

const disconnectedWallet = { isConnected: false, address: undefined, connectionType: null };

export function AuthProvider({ children, adapters, openfort }: AuthProviderProps) {
  const openfortServices = openfort ?? openfortSessionServices;
  const wagmiConfig = useConfig();
  const {
    address: wagmiWalletAddress,
    isConnected,
    isConnecting,
    isReconnecting,
    connector,
  } = useAccount();
  // wagmi restores a connection on a stored stand-in connector until its wallet answers (PRD-1499).
  const walletAnswered =
    isConnected && wagmiConfig.connectors.some((c) => c.uid === connector?.uid);

  const actor = useAuthActor(adapters, openfort);
  const pilotEnrollment = useMemo(
    () =>
      createPilotAccountEnrollment({
        adapters: adapters ?? defaultPasskeyAdapters,
        getSession: () => {
          const active = actor?.getSnapshot();
          if (
            !active?.matches({ authenticated: "passkey" }) ||
            !active.context.credential ||
            !active.context.smartAccountAddress
          )
            return null;
          return {
            credential: active.context.credential,
            address: active.context.smartAccountAddress,
            userName: active.context.userName || "",
            chainId: active.context.chainId,
          };
        },
        selectSession: (output) => {
          actor?.send({ type: "SELECT_PILOT_ACCOUNT", output });
        },
      }),
    [actor, adapters]
  );
  useEffect(() => () => pilotEnrollment.cancel(), [pilotEnrollment]);

  const snapshot = useSelector(actor as AuthActor, (s) => s);
  // A passkey saved or cleared during this session, not only the one found when the page loaded.
  const storedCredential = useHasStoredCredential(actor as AuthActor | null);

  const prevWalletState = useRef<{
    isConnected: boolean;
    address: Hex | undefined;
    connectionType: WalletConnectionType | null;
  }>(disconnectedWallet);

  // Guard to prevent duplicate LOGIN_WALLET events during session restore
  const walletRestoreAttemptedRef = useRef(false);
  const manualWalletLoginPendingRef = useRef(false);
  const loginGenerationRef = useRef(0);
  const walletModal = useWalletModal();
  const walletModalOpen = useWalletModalOpen();
  const walletRestore = useWalletRestoreLifecycle(actor as AuthActor, snapshot, wagmiConfig);
  const {
    disconnectWallet,
    releaseWallet,
    afterWalletRelease,
    cancelDeferredLogin,
    isConnectionQuarantined,
    walletReleaseStalled,
  } = useWalletDisconnect(wagmiConfig, {
    isConnected,
    isConnecting: isConnecting || isReconnecting,
  });

  // WALLET EVENT SYNC
  // React reports usable wallet events; the machine owns session transitions.
  // The release hook runs first to drain connections from an ended login.
  useEffect(() => {
    if (!actor) return;

    if (isConnectionQuarantined()) {
      prevWalletState.current = disconnectedWallet;
      return;
    }

    const prev = prevWalletState.current;
    const currentAddress = wagmiWalletAddress as Hex | undefined;
    const connectionType = isAppKitEmbeddedConnector(connector) ? "embedded" : "wallet";
    const rememberedWallet = walletModal.openProviders
      ? (actor.getSnapshot().context.walletAddress ?? getStoredWalletAddress())
      : null;
    // An Openfort connection may only answer for the wallet this session already trusts.
    // Newly connected wallets are adopted by the verified signature handler.
    if (walletModal.openProviders && walletAnswered) {
      const isRememberedWallet =
        getAuthMode() === "wallet" &&
        connectionType === "wallet" &&
        currentAddress &&
        rememberedWallet &&
        isAddressEqual(rememberedWallet, currentAddress);
      if (!isRememberedWallet) {
        if (prev.isConnected) {
          prevWalletState.current = disconnectedWallet;
          actor.send({
            type: "EXTERNAL_WALLET_DISCONNECTED",
            connectionType: prev.connectionType ?? undefined,
          });
        }
        if (!walletModal.isOpen()) void disconnectWallet();
        return;
      }
      if (walletModal.isOpen()) return;
    }
    // Record this state before any early return below, so the next change compares with it.
    prevWalletState.current = {
      isConnected: walletAnswered,
      address: currentAddress,
      connectionType: walletAnswered ? connectionType : null,
    };

    // Detect the wallet answering (hadn't, now has)
    if (walletAnswered && currentAddress) {
      if (
        !prev.isConnected ||
        prev.address !== currentAddress ||
        prev.connectionType !== connectionType
      ) {
        // Report wallet connection to machine - it decides what to do
        logger.debug("[AuthProvider] Reporting EXTERNAL_WALLET_CONNECTED", {
          address: currentAddress,
        });
        actor.send({ type: "EXTERNAL_WALLET_CONNECTED", address: currentAddress, connectionType });
        if (
          connectionType === "wallet" &&
          (!walletModal.openProviders || actor.getSnapshot().matches({ authenticated: "wallet" }))
        )
          setStoredWalletAddress(currentAddress);

        const currentState = actor.getSnapshot();

        if (manualWalletLoginPendingRef.current) {
          manualWalletLoginPendingRef.current = false;

          if (connectionType === "embedded") {
            logger.warn("[AuthProvider] Ignoring AppKit embedded connector for wallet login", {
              connectorId: connector?.id,
            });
            return;
          }

          if (currentState?.matches("unauthenticated")) {
            walletRestoreAttemptedRef.current = true;
            logger.debug(
              "[AuthProvider] Wallet connected after manual wallet login, triggering LOGIN_WALLET"
            );
            actor.send({ type: "LOGIN_WALLET" });
            return;
          }
        }

        // If machine is unauthenticated and wallet just connected, determine auth type.
        // IMPORTANT: Only auto-login if stored auth mode matches — this prevents
        // wallet auto-reconnect after sign-out from silently re-authenticating.
        if (currentState?.matches("unauthenticated") && !walletRestoreAttemptedRef.current) {
          const storedAuthMode = getAuthMode();
          if (storedAuthMode === "embedded" && connectionType === "embedded") {
            walletRestoreAttemptedRef.current = true;
            logger.debug("[AuthProvider] Embedded wallet reconnected, restoring embedded session", {
              address: currentAddress,
              connectorId: connector?.id,
            });
            actor.send({ type: "LOGIN_EMBEDDED", address: currentAddress });
            setEmbeddedAddress(currentAddress);
          } else if (
            storedAuthMode === "wallet" &&
            connectionType === "wallet" &&
            (!walletModal.openProviders ||
              (rememberedWallet && isAddressEqual(rememberedWallet, currentAddress)))
          ) {
            walletRestoreAttemptedRef.current = true;
            logger.debug(
              "[AuthProvider] Wallet connected in unauthenticated state with wallet intent, triggering LOGIN_WALLET"
            );
            actor.send({ type: "LOGIN_WALLET" });
          }
        }
      }
    }

    // Detect wallet disconnection (had answered, now hasn't)
    if (!walletAnswered && !isConnecting && prev.isConnected) {
      logger.debug("[AuthProvider] Reporting EXTERNAL_WALLET_DISCONNECTED");
      actor.send({
        type: "EXTERNAL_WALLET_DISCONNECTED",
        connectionType: prev.connectionType ?? undefined,
      });
    }
  }, [
    actor,
    walletAnswered,
    isConnecting,
    wagmiWalletAddress,
    connector,
    disconnectWallet,
    isConnectionQuarantined,
    walletModal,
    walletModalOpen,
  ]);

  // WALLET SESSION RESTORE
  // Handle race condition: wallet may connect during 'initializing' state,
  // then machine transitions to 'unauthenticated'. We need to auto-login
  // with wallet if authMode was 'wallet' and wallet is already connected.
  useEffect(() => {
    if (!actor || !snapshot || isConnectionQuarantined()) return;

    const storedAuthMode = getAuthMode();
    if (walletModal.openProviders) {
      const address = getStoredWalletAddress();
      if (
        walletModal.isOpen() ||
        !address ||
        !wagmiWalletAddress ||
        !isAddressEqual(address, wagmiWalletAddress)
      )
        return;
    }

    // Only act when machine just entered unauthenticated state
    // Use snapshot from dependency array instead of actor.getSnapshot()
    if (!snapshot.matches("unauthenticated")) return;

    // Check if we should auto-restore wallet or embedded session:
    // 1. Wallet answered
    // 2. Stored authMode matches ("wallet" or "embedded")
    // 3. Machine context already has external wallet tracked
    if (
      walletAnswered &&
      wagmiWalletAddress &&
      (storedAuthMode === "wallet" || storedAuthMode === "embedded") &&
      snapshot.context.externalWalletConnected
    ) {
      const isEmbeddedConnector = isAppKitEmbeddedConnector(connector);
      if (storedAuthMode === "wallet" && isEmbeddedConnector) {
        logger.warn("[AuthProvider] Ignoring embedded connector during wallet session restore", {
          connectorId: connector?.id,
        });
        return;
      }
      if (storedAuthMode === "embedded" && !isEmbeddedConnector) return;

      // Guard: only attempt restore once per session (shared with WALLET EVENT SYNC)
      if (!walletRestoreAttemptedRef.current) {
        walletRestoreAttemptedRef.current = true;

        if (storedAuthMode === "embedded") {
          logger.debug("[AuthProvider] Auto-restoring embedded session after init", {
            address: wagmiWalletAddress,
          });
          actor.send({
            type: "LOGIN_EMBEDDED",
            address: wagmiWalletAddress as Hex,
          });
        } else {
          logger.debug("[AuthProvider] Auto-restoring wallet session after init", {
            address: wagmiWalletAddress,
          });
          actor.send({ type: "LOGIN_WALLET" });
        }
      }
    }
  }, [
    actor,
    snapshot,
    walletAnswered,
    wagmiWalletAddress,
    connector,
    isConnectionQuarantined,
    walletModal,
  ]);

  // WALLET_CONNECTING SAFETY NET
  // If the machine enters wallet_connecting but the wallet is not connected
  // (e.g. user closed the modal, or wallet disconnected), recover gracefully.
  useEffect(() => {
    if (!actor || !snapshot) return;
    if (!snapshot.matches("wallet_connecting")) return;

    // Wallet isn't connected and isn't in the process of connecting — stuck
    if (!isConnected && !isConnecting) {
      logger.debug("[AuthProvider] wallet_connecting with no wallet, sending MODAL_CLOSED");
      actor.send({ type: "MODAL_CLOSED" });
    }
  }, [actor, snapshot, isConnected, isConnecting]);

  // WALLET MODAL LIFECYCLE
  // The wagmi-flag safety net above can miss a dismissal when isConnecting does
  // not reset promptly (WalletConnect QR, mobile app-switch), so the modal's own
  // open->closed edge sends MODAL_CLOSED while the machine waits in
  // wallet_connecting. The same edges time each wallet sign-in: a chosen phone
  // wallet that never opens ends with a record and a passkey offer.
  const walletConnectFailure = useWalletConnectLifecycle(actor as AuthActor, snapshot, {
    isConnected,
    walletModalOpen,
  });

  const endSession = useCallback(() => {
    if (!actor) return;
    pilotEnrollment.cancel();
    const session = actor.getSnapshot().context;
    loginGenerationRef.current += 1;
    cancelDeferredLogin();

    actor.send({ type: "SIGN_OUT" });
    // Sign out locally at once; a wallet session also lets go of its wallet,
    // without waiting, so the next wallet login asks for a wallet again.
    releaseWallet(session);
    // An email session also ends at Openfort and flushes this device's signer, so the
    // next person on a shared phone starts from nothing. It completes locally even offline.
    if (session.openfortMethod) {
      void openfortServices
        .signOutOpenfort()
        .catch((error: unknown) =>
          logger.warn("[AuthProvider] Openfort sign-out did not complete", { error })
        );
    }
    if (walletModal.isOpen() || manualWalletLoginPendingRef.current || isConnecting)
      walletModal.close();
    walletRestore.clear();
    // The one join-request credential a browser keeps ends with the session.
    useJoinRequestCountGrantStore.getState().clearAll();

    // A late connector event must not revive the ended session.
    walletRestoreAttemptedRef.current = true;
    manualWalletLoginPendingRef.current = false;

    // Keep cached reads. Rebuild local work projections for the next account
    // from its own IndexedDB jobs, without deleting those jobs or drafts.
    queryClient.removeQueries({
      predicate: ({ queryKey: [namespace, group, source] }) =>
        namespace !== "greengoods" ||
        group === "queue" ||
        (group === "works" && (source === "offline" || source === "merged")) ||
        (group === "workApprovals" && source === "offline"),
    });
    queryClient.getMutationCache().clear();
  }, [
    actor,
    walletRestore,
    releaseWallet,
    cancelDeferredLogin,
    isConnecting,
    walletModal,
    pilotEnrollment,
    openfortServices,
  ]);

  const { syncSignOut, notifySignOut } = useCrossTabSignOut(
    endSession,
    actor ? getActorSignOutRevision(actor) : undefined
  );

  // ACTIONS

  const createAccount = useCallback(
    async (userName: string) => {
      if (!actor) return;
      syncSignOut();
      const generation = loginGenerationRef.current;
      cancelDeferredLogin(); // A passkey choice drops any wallet login still waiting.
      // Display name is required for new passkey accounts (minimum 3 characters)
      const trimmedName = userName?.trim();
      if (!trimmedName || trimmedName.length < 3) {
        throw new Error("Display name must be at least 3 characters");
      }

      // Disconnect wallet if connected (starting fresh with passkey)
      if (isConnected) {
        await disconnectWallet();
      }

      syncSignOut();
      if (generation !== loginGenerationRef.current) return;
      // Send event to machine
      actor.send({ type: "LOGIN_PASSKEY_NEW", userName: trimmedName });
      saveAuthModeToStorage("passkey");
    },
    [actor, isConnected, disconnectWallet, cancelDeferredLogin, syncSignOut]
  );

  const loginWithPasskey = useCallback(
    async (
      userName?: string,
      options: { originalAccount?: boolean; createIfMissing?: boolean } = {}
    ) => {
      if (!actor) return;
      syncSignOut();
      const generation = loginGenerationRef.current;
      cancelDeferredLogin();
      // Disconnect wallet if connected (switching to passkey)
      if (isConnected) {
        await disconnectWallet();
      }

      // Preserve an explicit "" for local sign-in; omitted names use the remembered username.
      const finalUserName = userName ?? getStoredUsername() ?? "";

      syncSignOut();
      if (generation !== loginGenerationRef.current) return;
      // Send event to machine
      actor.send({
        type: "LOGIN_PASSKEY_EXISTING",
        userName: finalUserName,
        originalAccount: options.originalAccount === true,
        createIfMissing: options.createIfMissing === true,
      });
      saveAuthModeToStorage("passkey");
    },
    [actor, isConnected, disconnectWallet, cancelDeferredLogin, syncSignOut]
  );

  const loginWithOriginalPasskey = useCallback(
    (userName?: string) => loginWithPasskey(userName, { originalAccount: true }),
    [loginWithPasskey]
  );

  const { loginWithWallet, loginWithConnectedWallet, loginWithEmbedded } = useWalletSignInActions({
    actor,
    wagmiConfig,
    walletAnswered,
    wagmiWalletAddress,
    connector,
    walletRestoreAttemptedRef,
    manualWalletLoginPendingRef,
    syncSignOut,
    afterWalletRelease,
    isConnectionQuarantined,
  });

  const requestSignInCode = useCallback(
    async (email: string) => {
      syncSignOut();
      await openfortServices.requestCode(email);
    },
    [openfortServices, syncSignOut]
  );

  const startOpenfortSignIn = useCallback(
    async (signIn: OpenfortSignIn) => {
      if (!actor) return;
      syncSignOut();
      const generation = loginGenerationRef.current;
      cancelDeferredLogin(); // A code sign-in drops any wallet login still waiting.
      if (isConnected) await disconnectWallet();
      syncSignOut();
      if (generation !== loginGenerationRef.current) return;
      const event = { type: "LOGIN_OPENFORT" as const, ...signIn };
      if (!actor.getSnapshot().can(event)) return;
      actor.send(event);
      saveAuthModeToStorage("openfort");
    },
    [actor, isConnected, disconnectWallet, cancelDeferredLogin, syncSignOut]
  );

  const loginWithCode = useCallback(
    (email: string, code: string) => startOpenfortSignIn({ email, code }),
    [startOpenfortSignIn]
  );

  const loginWithOpenfortSession = useCallback(
    (session: OpenfortEmailSession) => startOpenfortSignIn({ session }),
    [startOpenfortSignIn]
  );

  const switchToWallet = useCallback(() => {
    if (!actor) return;
    pilotEnrollment.cancel();
    syncSignOut();
    actor.send({ type: "SWITCH_TO_WALLET" });
    saveAuthModeToStorage("wallet");
  }, [actor, syncSignOut, pilotEnrollment]);

  const switchToPasskey = useCallback(
    (userName?: string) => {
      if (!actor) return;
      syncSignOut();
      // Empty username routes to the local one-tap path (see loginWithPasskey).
      const finalUserName = userName ?? getStoredUsername() ?? "";
      actor.send({ type: "SWITCH_TO_PASSKEY", userName: finalUserName });
      saveAuthModeToStorage("passkey");
      clearStoredWalletAddress();
    },
    [actor, syncSignOut]
  );

  const signOut = useCallback(async () => {
    if (!actor) return;
    endSession();
    clearSessionForSignOut();
    notifySignOut();
  }, [actor, endSession, notifySignOut]);

  const retry = useCallback(() => {
    if (!actor) return;
    if (walletReleaseStalled) {
      window.location.reload();
      return;
    }
    // Reset the wallet auto-restore guard so a manual retry can attempt
    // wallet hydration again (the ref otherwise stays "spent" until signOut
    // or clearPasskey, deadlocking re-attempts in the same session).
    walletRestoreAttemptedRef.current = false;
    manualWalletLoginPendingRef.current = false;
    actor.send({ type: "RETRY" });
  }, [actor, walletReleaseStalled]);

  const dismissError = useCallback(() => {
    if (!actor) return;
    actor.send({ type: "DISMISS_ERROR" });
  }, [actor]);

  const clearPasskey = useCallback(() => {
    // Clear stored credential, username, and expected address from localStorage.
    clearStoredCredential();
    clearStoredUsername();
    clearStoredSmartAccountAddress();
    if (actor) {
      actor.send({ type: "SIGN_OUT" });
    }
    // Reset wallet restore guard to allow future auto-restore
    walletRestoreAttemptedRef.current = false;
    manualWalletLoginPendingRef.current = false;
  }, [actor]);

  const computedValues = useMemo(
    () =>
      deriveAuthSnapshotState(snapshot, {
        walletRestore: walletRestore.state,
        isConnecting,
        walletModalOpen,
        hasStoredCredential: storedCredential,
      }),
    [snapshot, walletRestore.state, isConnecting, walletModalOpen, storedCredential]
  );

  // A passkey or wallet session on this phone ends an email sign-in a closed page left.
  const signedInOtherwise =
    computedValues.isAuthenticated && computedValues.authMode !== "openfort";
  useEffect(() => {
    if (signedInOtherwise) openfortServices.endUnfinishedSignIn();
  }, [signedInOtherwise, openfortServices]);

  // State value — changes on auth events
  const stateValue: AuthStateValue = useMemo(
    () => ({
      walletReleaseStalled,
      walletConnectFailure,
      walletRestore: walletRestore.state,
      authMode: computedValues.authMode,
      isReady: computedValues.isReady,
      isAuthenticated: computedValues.isAuthenticated,
      isAuthenticating: computedValues.isAuthenticating,
      error: computedValues.error,
      credential: computedValues.credential,
      smartAccountAddress: computedValues.smartAccountAddress,
      passkeyAccountProfile: computedValues.passkeyAccountProfile,
      smartAccountClient: computedValues.smartAccountClient,
      resolveSmartAccountClient: computedValues.resolveSmartAccountClient,
      userName: computedValues.userName,
      hasStoredCredential: computedValues.hasStoredCredential,
      walletAddress: computedValues.walletAddress,
      eoaAddress: computedValues.walletAddress ?? undefined,
      embeddedAddress: computedValues.embeddedAddress,
      openfortMethod: computedValues.openfortMethod,
      externalWalletConnected: computedValues.externalWalletConnected,
      externalWalletAddress: computedValues.externalWalletAddress,
    }),
    [computedValues, walletReleaseStalled, walletConnectFailure, walletRestore.state]
  );

  // Actions value — stable references, only changes when actor/disconnectWallet change
  const actionsValue: AuthActionsValue = useMemo(
    () => ({
      preparePilotAccount: pilotEnrollment.prepare,
      findExistingPilotAccount: pilotEnrollment.findExisting,
      quotePilotAccount: pilotEnrollment.quote,
      confirmPilotAccount: pilotEnrollment.confirm,
      reconcilePilotAccount: pilotEnrollment.reconcile,
      cancelPilotAccountEnrollment: pilotEnrollment.cancel,
      createAccount,
      loginWithPasskey,
      loginWithOriginalPasskey,
      loginWithWallet,
      loginWithConnectedWallet,
      loginWithEmbedded,
      requestSignInCode,
      loginWithCode,
      loginWithOpenfortSession,
      signOut,
      switchToWallet,
      switchToPasskey,
      retry,
      dismissError,

      // Session management
      clearPasskey,
      disconnectWallet,
    }),
    [
      pilotEnrollment,
      createAccount,
      loginWithPasskey,
      loginWithOriginalPasskey,
      loginWithWallet,
      loginWithConnectedWallet,
      loginWithEmbedded,
      requestSignInCode,
      loginWithCode,
      loginWithOpenfortSession,
      signOut,
      switchToWallet,
      switchToPasskey,
      retry,
      dismissError,
      clearPasskey,
      disconnectWallet,
    ]
  );

  // Combined value for backward compatibility
  const contextValue: AuthContextType = useMemo(
    () => ({ ...stateValue, ...actionsValue }),
    [stateValue, actionsValue]
  );

  return (
    <AuthActionsContext.Provider value={actionsValue}>
      <AuthStateContext.Provider value={stateValue}>
        <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
      </AuthStateContext.Provider>
    </AuthActionsContext.Provider>
  );
}
