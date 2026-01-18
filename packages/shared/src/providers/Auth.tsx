/**
 * Unified Auth Provider
 *
 * Single authentication provider using XState for state management
 * and localStorage for credential storage (client-only approach).
 *
 * Design Principles:
 * 1. React only REPORTS events to the machine (no filtering)
 * 2. The state machine DECIDES what to do with events
 * 3. All auth logic lives in the machine, not in React effects
 *
 * Features:
 * - XState-based state management for predictable auth flows
 * - Client-only credential storage in localStorage
 * - Automatic session restoration on mount
 * - Wallet fallback for admin/operator users
 * - External wallet tracking (available for switching)
 *
 * Usage:
 * ```tsx
 * // In main.tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 *
 * // In components
 * const { authMode, smartAccountAddress, createAccount, signOut } = useAuth();
 * ```
 *
 * Reference: https://docs.pimlico.io/docs/how-tos/signers/passkey
 */

import { disconnect } from "@wagmi/core";
import { useSelector } from "@xstate/react";
import type { SmartAccountClient } from "permissionless";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import { useAccount, useConfig } from "wagmi";

import { appKit } from "../config/appkit";
import { queryClient } from "../config/react-query";
import {
  type AuthMode,
  clearAuthMode,
  clearStoredCredential,
  clearStoredUsername,
  getAuthMode,
  getStoredUsername,
  hasStoredCredential,
  setAuthMode as saveAuthModeToStorage,
} from "../modules/auth/session";
import { type AuthActor, getAuthActor } from "../workflows/authActor";

// ============================================================================
// CONTEXT TYPE
// ============================================================================

export interface AuthContextType {
  // State
  authMode: AuthMode;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: Error | null;

  // Passkey state
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: SmartAccountClient | null;
  userName: string | null;
  hasStoredCredential: boolean;

  // Wallet state (when wallet is the primary auth)
  walletAddress: Hex | null;
  eoaAddress: Hex | undefined;

  // External wallet state (always available, even in passkey mode)
  externalWalletConnected: boolean;
  externalWalletAddress: Hex | null;

  // Actions - Primary flow
  createAccount: (userName?: string) => Promise<void>;
  loginWithPasskey: (userName?: string) => Promise<void>;
  loginWithWallet: () => void;
  signOut: () => Promise<void>;

  // Actions - Switching auth methods
  switchToWallet: () => void;
  switchToPasskey: (userName?: string) => void;

  // Actions - Additional
  claimENS: (name: string) => void;
  retry: () => void;
  dismissError: () => void;

  // Legacy aliases (kept for backwards compatibility)
  signInWithPasskey: (userName?: string) => Promise<void>;
  createPasskey: (userName?: string) => Promise<void>;
  clearPasskey: () => void;
  connectWallet: () => void;
  disconnectWallet: () => Promise<void>;
  setPasskeySession?: (session: unknown) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// HOOKS
// ============================================================================

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}

export function useOptionalAuthContext(): AuthContextType | undefined {
  return useContext(AuthContext);
}

// ============================================================================
// PROVIDER
// ============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const wagmiConfig = useConfig();
  const { address: wagmiWalletAddress, isConnected, isConnecting } = useAccount();

  // Get the singleton auth actor (safe for SSR)
  const actor = typeof window !== "undefined" ? getAuthActor() : null;

  // Use XState selectors for state
  const snapshot = useSelector(actor as AuthActor, (s) => s);

  // Track previous wallet state to detect changes
  const prevWalletState = useRef<{ isConnected: boolean; address: Hex | undefined }>({
    isConnected: false,
    address: undefined,
  });

  // Track wallet hydration timeout - give up waiting after 2 seconds
  const [walletHydrationTimedOut, setWalletHydrationTimedOut] = React.useState(false);
  const hydrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Start hydration timeout on mount if wallet auth mode is stored
  useEffect(() => {
    const storedAuthMode = getAuthMode();
    if (storedAuthMode === "wallet" && !isConnected && !walletHydrationTimedOut) {
      hydrationTimeoutRef.current = setTimeout(() => {
        setWalletHydrationTimedOut(true);
      }, 2000); // 2 second timeout for wallet reconnection
    }

    // Clear timeout if wallet connects
    if (isConnected) {
      clearTimeout(hydrationTimeoutRef.current);
    }

    return () => clearTimeout(hydrationTimeoutRef.current);
  }, [isConnected, walletHydrationTimedOut]);

  // ============================================================
  // WALLET EVENT SYNC
  // ============================================================
  // React REPORTS wallet events - the machine DECIDES what to do
  // This is the key principle: no filtering, just reporting
  useEffect(() => {
    if (!actor) return;

    const prev = prevWalletState.current;
    const currentAddress = wagmiWalletAddress as Hex | undefined;

    // Detect wallet connection (wasn't connected, now is)
    if (isConnected && currentAddress && !isConnecting) {
      if (!prev.isConnected || prev.address !== currentAddress) {
        // Report wallet connection to machine - it decides what to do
        console.debug("[AuthProvider] Reporting EXTERNAL_WALLET_CONNECTED:", currentAddress);
        actor.send({ type: "EXTERNAL_WALLET_CONNECTED", address: currentAddress });

        // If machine is unauthenticated and wallet just connected, trigger wallet login
        // This handles the case where user opens AppKit modal then connects
        const currentState = actor.getSnapshot();
        if (currentState?.matches("unauthenticated")) {
          console.debug(
            "[AuthProvider] Wallet connected in unauthenticated state, triggering LOGIN_WALLET"
          );
          actor.send({ type: "LOGIN_WALLET" });
          saveAuthModeToStorage("wallet");
        }
      }
    }

    // Detect wallet disconnection (was connected, now isn't)
    if (!isConnected && !isConnecting && prev.isConnected) {
      console.debug("[AuthProvider] Reporting EXTERNAL_WALLET_DISCONNECTED");
      actor.send({ type: "EXTERNAL_WALLET_DISCONNECTED" });
    }

    // Update previous state
    prevWalletState.current = {
      isConnected: isConnected && !isConnecting,
      address: currentAddress,
    };
  }, [actor, isConnected, isConnecting, wagmiWalletAddress]);

  // ============================================================
  // HELPER: Disconnect wallet
  // ============================================================
  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect(wagmiConfig);
    } catch {
      // Ignore disconnect errors
    }
  }, [wagmiConfig]);

  // ============================================================
  // ACTIONS
  // ============================================================

  const createAccount = useCallback(
    async (userName?: string) => {
      if (!actor) return;

      // Disconnect wallet if connected (starting fresh with passkey)
      if (isConnected) {
        await disconnectWallet();
      }

      // Generate username if not provided
      const finalUserName = userName || `user_${Date.now()}`;

      // Send event to machine
      actor.send({ type: "LOGIN_PASSKEY_NEW", userName: finalUserName });
      saveAuthModeToStorage("passkey");
    },
    [actor, isConnected, disconnectWallet]
  );

  const loginWithPasskey = useCallback(
    async (userName?: string) => {
      if (!actor) return;

      // Disconnect wallet if connected (switching to passkey)
      if (isConnected) {
        await disconnectWallet();
      }

      // Get stored username or use provided
      const finalUserName = userName || getStoredUsername() || "user";

      // Send event to machine
      actor.send({ type: "LOGIN_PASSKEY_EXISTING", userName: finalUserName });
      saveAuthModeToStorage("passkey");
    },
    [actor, isConnected, disconnectWallet]
  );

  const loginWithWallet = useCallback(() => {
    if (!actor) return;

    // If wallet already connected, proceed with login
    if (isConnected && wagmiWalletAddress) {
      actor.send({ type: "LOGIN_WALLET" });
      saveAuthModeToStorage("wallet");
    } else {
      // Just open modal - don't send LOGIN_WALLET yet
      // Machine stays in current state, buttons remain enabled
      // When wallet connects, we'll handle auth via LOGIN_WALLET
      appKit.open();
    }
  }, [actor, isConnected, wagmiWalletAddress]);

  const switchToWallet = useCallback(() => {
    if (!actor) return;
    actor.send({ type: "SWITCH_TO_WALLET" });
    saveAuthModeToStorage("wallet");
  }, [actor]);

  const switchToPasskey = useCallback(
    (userName?: string) => {
      if (!actor) return;
      const finalUserName = userName || getStoredUsername() || "user";
      actor.send({ type: "SWITCH_TO_PASSKEY", userName: finalUserName });
      saveAuthModeToStorage("passkey");
    },
    [actor]
  );

  const signOut = useCallback(async () => {
    if (!actor) return;

    // Clear from machine
    actor.send({ type: "SIGN_OUT" });

    // Disconnect wallet
    await disconnectWallet();

    // Clear local storage (auth mode + username to prevent auto-restore)
    clearAuthMode();
    clearStoredUsername();

    // Clear query cache
    queryClient.clear();
  }, [actor, disconnectWallet]);

  const claimENS = useCallback(
    (name: string) => {
      if (!actor) return;
      actor.send({ type: "CLAIM_ENS", name });
    },
    [actor]
  );

  const retry = useCallback(() => {
    if (!actor) return;
    actor.send({ type: "RETRY" });
  }, [actor]);

  const dismissError = useCallback(() => {
    if (!actor) return;
    actor.send({ type: "DISMISS_ERROR" });
  }, [actor]);

  const clearPasskey = useCallback(() => {
    // Clear stored credential and username from localStorage
    clearStoredCredential();
    clearStoredUsername();
    if (actor) {
      actor.send({ type: "SIGN_OUT" });
    }
  }, [actor]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

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
        smartAccountClient: null,
        userName: null,
        hasStoredCredential: false,
        walletAddress: null,
        externalWalletConnected: false,
        externalWalletAddress: null,
      };
    }

    // Determine auth mode from state
    let authMode: AuthMode = null;
    if (
      snapshot.matches({ authenticated: "passkey" }) ||
      snapshot.matches({ authenticated: "claiming_ens" })
    ) {
      authMode = "passkey";
    } else if (snapshot.matches({ authenticated: "wallet" })) {
      authMode = "wallet";
    }

    // Check if authenticating
    const isAuthenticating =
      snapshot.matches("registering") ||
      snapshot.matches("authenticating") ||
      snapshot.matches("wallet_connecting") ||
      isConnecting;

    // Check for stored credential (indicates existing account in localStorage)
    const storedCredential = hasStoredCredential();

    // Determine if auth is ready
    // For wallet mode: wait for Wagmi to finish reconnecting before declaring ready
    // This prevents the login flash when refreshing with wallet auth
    const machineReady = !snapshot.matches("initializing");
    const storedAuthMode = typeof window !== "undefined" ? getAuthMode() : null;

    // If user was previously authenticated with wallet, wait for Wagmi to settle
    // before declaring auth as ready. This prevents:
    // 1. Auto-logout on refresh (RequireAuth redirecting before wallet reconnects)
    // 2. Login view flash (showing login briefly before auto-login completes)
    // Give up waiting after timeout to prevent infinite loading
    const isWalletHydrating =
      storedAuthMode === "wallet" &&
      !snapshot.matches("authenticated") &&
      !walletHydrationTimedOut &&
      (isConnecting || (!isConnected && !snapshot.matches("unauthenticated")));

    return {
      authMode,
      isReady: machineReady && !isWalletHydrating,
      isAuthenticated: snapshot.matches("authenticated"),
      isAuthenticating,
      error: snapshot.context.error,
      credential: snapshot.context.credential,
      smartAccountAddress: snapshot.context.smartAccountAddress,
      smartAccountClient: snapshot.context.smartAccountClient,
      userName: snapshot.context.userName,
      hasStoredCredential: storedCredential,
      // Wallet address is only set when wallet is the PRIMARY auth
      walletAddress: snapshot.context.walletAddress,
      // External wallet state (always available)
      externalWalletConnected: snapshot.context.externalWalletConnected,
      externalWalletAddress: snapshot.context.externalWalletAddress,
    };
  }, [snapshot, isConnecting, isConnected, walletHydrationTimedOut]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const contextValue: AuthContextType = useMemo(
    () => ({
      // State
      authMode: computedValues.authMode,
      isReady: computedValues.isReady,
      isAuthenticated: computedValues.isAuthenticated,
      isAuthenticating: computedValues.isAuthenticating,
      error: computedValues.error,

      // Passkey state
      credential: computedValues.credential,
      smartAccountAddress: computedValues.smartAccountAddress,
      smartAccountClient: computedValues.smartAccountClient,
      userName: computedValues.userName,
      hasStoredCredential: computedValues.hasStoredCredential,

      // Wallet state (when wallet is PRIMARY auth)
      walletAddress: computedValues.walletAddress,
      eoaAddress: computedValues.walletAddress ?? undefined,

      // External wallet state (always available)
      externalWalletConnected: computedValues.externalWalletConnected,
      externalWalletAddress: computedValues.externalWalletAddress,

      // Actions - Primary flow
      createAccount,
      loginWithPasskey,
      loginWithWallet,
      signOut,

      // Actions - Switching
      switchToWallet,
      switchToPasskey,

      // Actions - Additional
      claimENS,
      retry,
      dismissError,

      // Legacy aliases
      signInWithPasskey: loginWithPasskey,
      createPasskey: createAccount,
      clearPasskey,
      connectWallet: loginWithWallet,
      disconnectWallet,
    }),
    [
      computedValues,
      createAccount,
      loginWithPasskey,
      loginWithWallet,
      signOut,
      switchToWallet,
      switchToPasskey,
      claimENS,
      retry,
      dismissError,
      clearPasskey,
      disconnectWallet,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

// ============================================================================
// RE-EXPORTS for backwards compatibility
// ============================================================================

export { AUTH_MODE_STORAGE_KEY, type AuthMode } from "../modules/auth/session";
