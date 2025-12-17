/**
 * Unified Auth Provider
 *
 * Single authentication provider using XState for state management
 * and Pimlico passkey server for credential storage.
 *
 * Features:
 * - XState-based state management for predictable auth flows
 * - Pimlico passkey server integration (no localStorage for credentials)
 * - Automatic session restoration on mount
 * - Wallet fallback for admin/operator users
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
 * Reference: https://docs.pimlico.io/guides/how-to/signers/passkey-server
 */

import { disconnect } from "@wagmi/core";
import { useSelector } from "@xstate/react";
import type { SmartAccountClient } from "permissionless";
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import { useAccount, useConfig } from "wagmi";

import { appKit } from "../config/appkit";
import { queryClient } from "../config/react-query";
import {
  type AuthMode,
  clearAuthMode,
  clearStoredUsername,
  hasStoredUsername,
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

  // Wallet state
  walletAddress: Hex | null;
  eoaAddress: Hex | undefined;

  // Actions - Primary flow
  createAccount: (userName?: string) => Promise<void>;
  loginWithPasskey: (userName?: string) => Promise<void>;
  loginWithWallet: () => void;
  signOut: () => Promise<void>;

  // Actions - Additional
  claimENS: (name: string) => void;
  retry: () => void;

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
  const { address: walletAddress, isConnected, isConnecting } = useAccount();

  // Get the singleton auth actor (safe for SSR)
  const actor = typeof window !== "undefined" ? getAuthActor() : null;

  // Use XState selectors for state
  const snapshot = useSelector(actor as AuthActor, (s) => s);

  // ============================================================
  // WALLET EVENT SYNC
  // ============================================================
  // Sync wallet connection events to XState machine
  useEffect(() => {
    if (!actor) return;

    // When wallet connects, notify the machine
    if (isConnected && walletAddress && !isConnecting) {
      const currentState = actor.getSnapshot();
      // Only dispatch if we're in a state that expects wallet connection
      if (currentState.matches("wallet_connecting") || currentState.matches("unauthenticated")) {
        actor.send({ type: "WALLET_CONNECTED", address: walletAddress as Hex });
      }
    }

    // When wallet disconnects, notify the machine
    if (!isConnected && !isConnecting) {
      const currentState = actor.getSnapshot();
      if (currentState.matches({ authenticated: "wallet" })) {
        actor.send({ type: "WALLET_DISCONNECTED" });
      }
    }
  }, [actor, isConnected, isConnecting, walletAddress]);

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

      // Disconnect wallet if connected
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

      // Disconnect wallet if connected
      if (isConnected) {
        await disconnectWallet();
      }

      // Get stored username or use provided
      const storedUsername =
        typeof window !== "undefined" ? localStorage.getItem("greengoods_username") : null;
      const finalUserName = userName || storedUsername || "user";

      // Send event to machine
      actor.send({ type: "LOGIN_PASSKEY_EXISTING", userName: finalUserName });
      saveAuthModeToStorage("passkey");
    },
    [actor, isConnected, disconnectWallet]
  );

  const loginWithWallet = useCallback(() => {
    if (!actor) return;

    // Send event to machine
    actor.send({ type: "LOGIN_WALLET" });
    saveAuthModeToStorage("wallet");

    // Open wallet modal
    appKit.open();
  }, [actor]);

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

  const clearPasskey = useCallback(() => {
    // Clear stored username (credentials are on Pimlico server)
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

    // Check for stored username (indicates existing account with Pimlico server)
    const storedCredential = hasStoredUsername();

    return {
      authMode,
      isReady: !snapshot.matches("initializing"),
      isAuthenticated: snapshot.matches("authenticated"),
      isAuthenticating,
      error: snapshot.context.error,
      credential: snapshot.context.credential,
      smartAccountAddress: snapshot.context.smartAccountAddress,
      smartAccountClient: snapshot.context.smartAccountClient,
      userName: snapshot.context.userName,
      hasStoredCredential: storedCredential,
    };
  }, [snapshot, isConnecting]);

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

      // Wallet state
      walletAddress:
        computedValues.authMode === "wallet" && isConnected ? (walletAddress as Hex) : null,
      eoaAddress:
        computedValues.authMode === "wallet" && isConnected ? (walletAddress as Hex) : undefined,

      // Actions - Primary flow
      createAccount,
      loginWithPasskey,
      loginWithWallet,
      signOut,

      // Actions - Additional
      claimENS,
      retry,

      // Legacy aliases
      signInWithPasskey: loginWithPasskey,
      createPasskey: createAccount,
      clearPasskey,
      connectWallet: loginWithWallet,
      disconnectWallet,
    }),
    [
      computedValues,
      isConnected,
      walletAddress,
      createAccount,
      loginWithPasskey,
      loginWithWallet,
      signOut,
      claimENS,
      retry,
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
