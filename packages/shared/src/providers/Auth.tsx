/**
 * Shared auth composition: reports connector and user events to the auth machine,
 * restores saved sessions, and clears active sessions across same-origin tabs.
 * Recovery credentials remain on the device after sign-out.
 */

import { useSelector } from "@xstate/react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { Hex } from "viem";
import { useAccount, useConfig } from "wagmi";

import { getAppKit } from "../config/appkit";
import { queryClient } from "../config/react-query";
import { useCrossTabSignOut } from "../hooks/auth/useCrossTabSignOut";
import { getActorSignOutRevision } from "../modules/auth/sessionSignOut";
import { useAuthActor } from "../hooks/auth/useAuthActor";
import { useHasStoredCredential } from "../hooks/auth/useHasStoredCredential";
import { useWalletDisconnect } from "../hooks/auth/useWalletDisconnect";
import { useWalletRestoreLifecycle } from "../hooks/auth/useWalletRestoreLifecycle";
import { useWalletModalOpen } from "../hooks/auth/useWalletModalOpen";
import { logger } from "../modules/app/logger";
import {
  type AuthMode,
  clearSessionForSignOut,
  clearStoredWalletAddress,
  clearStoredCredential,
  clearStoredSmartAccountAddress,
  clearStoredUsername,
  getAuthMode,
  getStoredUsername,
  setAuthMode as saveAuthModeToStorage,
  setEmbeddedAddress,
  setStoredWalletAddress,
} from "../modules/auth/session";
import { defaultPasskeyAdapters, type PasskeyAdapters } from "../workflows/auth-passkey-adapters";
import type { AuthActor } from "../workflows/authActor";
import type { WalletConnectionType } from "../workflows/authMachine";
import { createPilotAccountEnrollment } from "../modules/auth/pilot-account-enrollment";
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

// Pinned to @reown/appkit ^1.8.14 (see packages/{client,admin,shared}/
// package.json). The auth connector exposes its ID as "ID_AUTH" via
// ConstantsUtil.CONNECTOR_ID.AUTH; older AppKit builds used "w3mAuth"
// and "AUTH". Use exact equality on a known set instead of substring
// matching to avoid false positives if a wallet's name happens to contain
// "embedded".
const APPKIT_EMBEDDED_CONNECTOR_IDS = ["ID_AUTH", "w3mAuth", "AUTH"] as const;
function isAppKitEmbeddedConnector(connector?: { id?: string } | null): boolean {
  return Boolean(
    connector?.id && (APPKIT_EMBEDDED_CONNECTOR_IDS as readonly string[]).includes(connector.id)
  );
}

export interface AuthProviderProps {
  children: React.ReactNode;
  adapters?: PasskeyAdapters;
}

export function AuthProvider({ children, adapters }: AuthProviderProps) {
  const wagmiConfig = useConfig();
  const {
    address: wagmiWalletAddress,
    isConnected,
    isConnecting,
    isReconnecting,
    connector,
  } = useAccount();

  const actor = useAuthActor(adapters);
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
  }>({
    isConnected: false,
    address: undefined,
    connectionType: null,
  });

  // Guard to prevent duplicate LOGIN_WALLET events during session restore
  const walletRestoreAttemptedRef = useRef(false);
  const manualWalletLoginPendingRef = useRef(false);
  const loginGenerationRef = useRef(0);
  // Reflects the Reown AppKit wallet modal open state; the ref tracks the
  // open->closed edge so we can recover from a dismissed or expired modal.
  const prevWalletModalOpenRef = useRef(false);
  const walletModalOpen = useWalletModalOpen();
  const clearRestoreAttempt = useWalletRestoreLifecycle(actor as AuthActor, snapshot, wagmiConfig);
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
      prevWalletState.current = { isConnected: false, address: undefined, connectionType: null };
      return;
    }

    const prev = prevWalletState.current;
    const currentAddress = wagmiWalletAddress as Hex | undefined;
    const connectionType: WalletConnectionType = isAppKitEmbeddedConnector(connector)
      ? "embedded"
      : "wallet";
    // Record this state before any early return below, so the next change compares with it.
    prevWalletState.current = {
      isConnected: isConnected && !isConnecting,
      address: currentAddress,
      connectionType: isConnected && !isConnecting ? connectionType : null,
    };

    // Detect wallet connection (wasn't connected, now is)
    if (isConnected && currentAddress && !isConnecting) {
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
        if (connectionType === "wallet") setStoredWalletAddress(currentAddress);

        const currentState = actor.getSnapshot();
        const isEmbeddedConnector = isAppKitEmbeddedConnector(connector);

        if (manualWalletLoginPendingRef.current) {
          manualWalletLoginPendingRef.current = false;

          if (isEmbeddedConnector) {
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
          if (storedAuthMode === "embedded" && isEmbeddedConnector) {
            walletRestoreAttemptedRef.current = true;
            logger.debug("[AuthProvider] Embedded wallet reconnected, restoring embedded session", {
              address: currentAddress,
              connectorId: connector?.id,
            });
            actor.send({ type: "LOGIN_EMBEDDED", address: currentAddress });
            setEmbeddedAddress(currentAddress);
          } else if (storedAuthMode === "wallet" && !isEmbeddedConnector) {
            walletRestoreAttemptedRef.current = true;
            logger.debug(
              "[AuthProvider] Wallet connected in unauthenticated state with wallet intent, triggering LOGIN_WALLET"
            );
            actor.send({ type: "LOGIN_WALLET" });
          }
        }
      }
    }

    // Detect wallet disconnection (was connected, now isn't)
    if (!isConnected && !isConnecting && prev.isConnected) {
      logger.debug("[AuthProvider] Reporting EXTERNAL_WALLET_DISCONNECTED");
      actor.send({
        type: "EXTERNAL_WALLET_DISCONNECTED",
        connectionType: prev.connectionType ?? undefined,
      });
    }
  }, [actor, isConnected, isConnecting, wagmiWalletAddress, connector, isConnectionQuarantined]);

  // WALLET SESSION RESTORE
  // Handle race condition: wallet may connect during 'initializing' state,
  // then machine transitions to 'unauthenticated'. We need to auto-login
  // with wallet if authMode was 'wallet' and wallet is already connected.
  useEffect(() => {
    if (!actor || !snapshot || isConnectionQuarantined()) return;

    const storedAuthMode = getAuthMode();

    // Only act when machine just entered unauthenticated state
    // Use snapshot from dependency array instead of actor.getSnapshot()
    if (!snapshot.matches("unauthenticated")) return;

    // Check if we should auto-restore wallet or embedded session:
    // 1. Wallet is connected
    // 2. Stored authMode matches ("wallet" or "embedded")
    // 3. Machine context already has external wallet tracked
    if (
      isConnected &&
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
  }, [actor, snapshot, isConnected, wagmiWalletAddress, connector, isConnectionQuarantined]);

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

  // WALLET MODAL CLOSE DETECTION
  // The wagmi-flag safety net above can miss a dismissal when isConnecting does
  // not reset promptly (WalletConnect QR, mobile app-switch). Subscribing to
  // AppKit's modal state (via useWalletModalOpen) catches the open->closed edge
  // directly: if the modal closes while the machine is still waiting in
  // wallet_connecting, the user cancelled — return to unauthenticated at once.
  useEffect(() => {
    if (!actor) return;
    const wasOpen = prevWalletModalOpenRef.current;
    prevWalletModalOpenRef.current = walletModalOpen;
    // Use the LIVE snapshot (not the React one) so a successful connect — which
    // already moved the machine to authenticated.wallet — is never clobbered.
    if (wasOpen && !walletModalOpen && actor.getSnapshot().matches("wallet_connecting")) {
      logger.debug("[AuthProvider] Wallet modal closed while connecting, sending MODAL_CLOSED");
      actor.send({ type: "MODAL_CLOSED" });
    }
  }, [actor, walletModalOpen]);

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
    if (manualWalletLoginPendingRef.current || isConnecting) void getAppKit()?.close();
    clearRestoreAttempt();

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
    clearRestoreAttempt,
    releaseWallet,
    cancelDeferredLogin,
    isConnecting,
    pilotEnrollment,
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
    async (userName?: string, originalAccount = false) => {
      if (!actor) return;
      syncSignOut();
      const generation = loginGenerationRef.current;
      cancelDeferredLogin();
      // Disconnect wallet if connected (switching to passkey)
      if (isConnected) {
        await disconnectWallet();
      }

      // Get stored username or use provided. An empty username routes the
      // auth service straight to the local one-tap path — never fabricate a
      // placeholder, because under the passkey-server flag any truthy name
      // triggers a hosted-server lookup for that literal username. Nullish
      // coalescing preserves an explicit "" from the caller.
      const finalUserName = userName ?? getStoredUsername() ?? "";

      syncSignOut();
      if (generation !== loginGenerationRef.current) return;
      // Send event to machine
      actor.send({
        type: "LOGIN_PASSKEY_EXISTING",
        userName: finalUserName,
        ...(originalAccount ? { originalAccount: true } : {}),
      });
      saveAuthModeToStorage("passkey");
    },
    [actor, isConnected, disconnectWallet, cancelDeferredLogin, syncSignOut]
  );

  const loginWithOriginalPasskey = useCallback(
    (userName?: string) => loginWithPasskey(userName, true),
    [loginWithPasskey]
  );

  const loginWithWallet = useCallback(() => {
    if (!actor) return;
    syncSignOut();
    walletRestoreAttemptedRef.current = false;
    const askForWallet = () => {
      if (syncSignOut()) return;
      saveAuthModeToStorage("wallet");
      manualWalletLoginPendingRef.current = true;
      getAppKit()?.open();
    };
    if (afterWalletRelease(askForWallet)) return;

    // Save wallet intent FIRST — this signals to the WALLET EVENT SYNC effect
    // that any subsequent wallet connection should trigger auto-login.
    // Without this, wallet auto-reconnect after passkey sign-out would
    // incorrectly log the user in with wallet (the guard checks this value).
    saveAuthModeToStorage("wallet");
    manualWalletLoginPendingRef.current = true;

    if (isConnected && wagmiWalletAddress) {
      if (isAppKitEmbeddedConnector(connector)) {
        manualWalletLoginPendingRef.current = false;
        logger.warn(
          "[AuthProvider] Connected AppKit account is embedded, opening wallet selector",
          {
            connectorId: connector?.id,
          }
        );
        getAppKit()?.open();
        return;
      }

      const walletAddress = wagmiWalletAddress as Hex;
      const currentState = actor.getSnapshot();
      if (
        !currentState.context.externalWalletConnected ||
        currentState.context.externalWalletAddress !== walletAddress
      ) {
        actor.send({ type: "EXTERNAL_WALLET_CONNECTED", address: walletAddress });
      }

      // Wallet already connected, proceed with login immediately
      manualWalletLoginPendingRef.current = false;
      actor.send({ type: "LOGIN_WALLET" });
    } else {
      // Open modal - when wallet connects, WALLET EVENT SYNC will
      // detect the connection + stored "wallet" intent and send LOGIN_WALLET
      getAppKit()?.open();
    }
  }, [actor, isConnected, wagmiWalletAddress, connector, afterWalletRelease, syncSignOut]);

  const loginWithEmbedded = useCallback(() => {
    if (!actor) return;
    syncSignOut();
    walletRestoreAttemptedRef.current = false;

    if (
      afterWalletRelease(() => {
        if (!syncSignOut()) {
          saveAuthModeToStorage("embedded");
          getAppKit()?.open();
        }
      })
    )
      return;
    saveAuthModeToStorage("embedded");
    if (isConnected && wagmiWalletAddress && isAppKitEmbeddedConnector(connector)) {
      const address = wagmiWalletAddress as Hex;
      actor.send({ type: "EXTERNAL_WALLET_CONNECTED", address, connectionType: "embedded" });
      actor.send({ type: "LOGIN_EMBEDDED", address });
      setEmbeddedAddress(address);
      return;
    }
    getAppKit()?.open();
  }, [actor, isConnected, wagmiWalletAddress, connector, afterWalletRelease, syncSignOut]);

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

  const computedValues = useMemo(() => {
    if (!snapshot) {
      return {
        authMode: null as AuthMode,
        isReady: false,
        isAuthenticated: false,
        isAuthenticating: false,
        error: null,
        credential: null,
        smartAccountAddress: null,
        passkeyAccountProfile: null,
        smartAccountClient: null,
        resolveSmartAccountClient: null,
        userName: null,
        hasStoredCredential: false,
        walletAddress: null,
        embeddedAddress: null,
        externalWalletConnected: false,
        externalWalletAddress: null,
      };
    }

    // Determine auth mode from state
    let authMode: AuthMode = null;
    if (snapshot.matches({ authenticated: "passkey" })) {
      authMode = "passkey";
    } else if (snapshot.matches({ authenticated: "embedded" })) {
      authMode = "embedded";
    } else if (snapshot.matches({ authenticated: "wallet" })) {
      authMode = "wallet";
    } else if (snapshot.matches({ restoring: "embedded" }) && snapshot.context.embeddedAddress) {
      authMode = "embedded";
    } else if (snapshot.matches({ restoring: "wallet" }) && snapshot.context.walletAddress) {
      authMode = "wallet";
    }

    // Check if authenticating
    const isAuthenticating =
      snapshot.matches("registering") ||
      snapshot.matches("authenticating") ||
      snapshot.matches("wallet_connecting") ||
      snapshot.matches("restoring") ||
      // Wagmi's `isConnecting` only blocks the UI while the wallet modal is
      // actually open. Once the user dismisses it (or a WalletConnect QR
      // expires), the login UI must come back even if wagmi hasn't cleared
      // isConnecting yet — otherwise the input stays disabled and the wallet
      // button stays hidden with no way to recover.
      (isConnecting && walletModalOpen);

    const isRestoring = snapshot.matches("restoring");
    const authenticatedSession =
      snapshot.matches("authenticated") ||
      (snapshot.matches({ restoring: "wallet" }) && Boolean(snapshot.context.walletAddress)) ||
      (snapshot.matches({ restoring: "embedded" }) && Boolean(snapshot.context.embeddedAddress));

    return {
      authMode,
      isReady: !snapshot.matches("initializing") && !isRestoring,
      isAuthenticated: authenticatedSession,
      isAuthenticating,
      error: snapshot.context.error,
      credential: snapshot.context.credential,
      smartAccountAddress: snapshot.context.smartAccountAddress,
      passkeyAccountProfile: snapshot.context.passkeyAccountProfile ?? null,
      smartAccountClient: snapshot.context.smartAccountClient,
      resolveSmartAccountClient: snapshot.context.resolveSmartAccountClient,
      userName: snapshot.context.userName,
      // A stored credential indicates an existing account in localStorage.
      hasStoredCredential: storedCredential,
      // Wallet address is only set when wallet is the PRIMARY auth
      walletAddress: snapshot.context.walletAddress,
      // Embedded wallet address (AppKit email/social auth)
      embeddedAddress: snapshot.context.embeddedAddress,
      // External wallet state (always available)
      externalWalletConnected: snapshot.context.externalWalletConnected,
      externalWalletAddress: snapshot.context.externalWalletAddress,
    };
  }, [snapshot, isConnecting, walletModalOpen, storedCredential]);

  // State value — changes on auth events
  const stateValue: AuthStateValue = useMemo(
    () => ({
      walletReleaseStalled,
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
      externalWalletConnected: computedValues.externalWalletConnected,
      externalWalletAddress: computedValues.externalWalletAddress,
    }),
    [computedValues, walletReleaseStalled]
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
      loginWithEmbedded,
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
      loginWithEmbedded,
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
