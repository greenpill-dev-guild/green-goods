/**
 * Client Auth Provider
 *
 * Simple authentication for the client package.
 * Supports passkey (primary) and wallet (fallback) auth modes.
 *
 * Core methods:
 * - loginWithPasskey() - Create/authenticate passkey
 * - loginWithWallet() - Open wallet modal
 * - signOut() - Clear all auth state
 */

import { disconnect } from "@wagmi/core";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Hex } from "viem";
import { type P256Credential } from "viem/account-abstraction";
import { useAccount, useConfig } from "wagmi";
import { appKit } from "../config/appkit";
import { queryClient } from "../config/react-query";
import { type PasskeySession } from "../modules/auth/passkey";
import {
  type AuthMode,
  clearAuthMode,
  getAuthMode,
  setAuthMode as saveAuthMode,
} from "../modules/auth/session";
import { PasskeyAuthProvider, usePasskeyAuth } from "./PasskeyAuth";

interface ClientAuthContextType {
  // State
  authMode: AuthMode;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;

  // Addresses
  eoaAddress: Hex | undefined;
  walletAddress: Hex | null;
  smartAccountAddress: Hex | null;

  // Passkey
  credential: P256Credential | null;
  smartAccountClient: PasskeySession["client"] | null;

  // Error
  error: Error | null;

  // Actions
  loginWithPasskey: () => Promise<PasskeySession>;
  loginWithWallet: () => void;
  signOut: () => Promise<void>;

  // Legacy aliases
  signInWithPasskey: () => Promise<PasskeySession>;
  createPasskey: () => Promise<PasskeySession>;
  clearPasskey: () => void;
  setPasskeySession: (session: PasskeySession) => void;
  connectWallet: () => void;
  disconnectWallet: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function useClientAuth(): ClientAuthContextType {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error("useClientAuth must be used within ClientAuthProvider");
  }
  return context;
}

export function useOptionalClientAuth(): ClientAuthContextType | undefined {
  return useContext(ClientAuthContext);
}

// Re-export for backwards compatibility
export { AUTH_MODE_STORAGE_KEY, type AuthMode } from "../modules/auth/session";

function ClientAuthProviderInner({ children }: { children: React.ReactNode }) {
  const wagmiConfig = useConfig();
  const passkeyAuth = usePasskeyAuth();
  const { address, isConnected, isConnecting } = useAccount();

  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);

  // Helper to disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect(wagmiConfig);
    } catch {
      // Ignore disconnect errors
    }
  }, [wagmiConfig]);

  // ============================================================
  // INITIALIZE: Check for existing session on mount
  // ============================================================
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const savedMode = getAuthMode();

    if (savedMode === "passkey") {
      // Trust PasskeyAuth to restore - set mode immediately
      // If passkey restore fails, the sync effect will handle it
      setAuthMode("passkey");
    } else if (savedMode === "wallet") {
      // Wallet mode - wagmi will handle reconnection
      setAuthMode("wallet");
    }
    // No else - if no saved mode, authMode stays null

    setIsReady(true);
  }, []); // Run exactly once on mount

  // ============================================================
  // SYNC: Handle wallet state changes
  // ============================================================
  // Handles both runtime disconnect and stale state on page reload.
  // When wallet connects, useAccount() updates isConnected/address,
  // which triggers isAuthenticated to recompute automatically.
  useEffect(() => {
    if (!isReady) return;

    // Wallet disconnected or was never connected while in wallet mode
    if (!isConnected && !isConnecting && authMode === "wallet") {
      setAuthMode(null);
      clearAuthMode();
    }
  }, [isConnected, isConnecting, authMode, isReady]);

  // ============================================================
  // SYNC: Handle passkey authentication changes
  // ============================================================
  useEffect(() => {
    if (!isReady) return;

    // Passkey just authenticated - ensure mode is set
    if (passkeyAuth.isAuthenticated && authMode !== "passkey") {
      setAuthMode("passkey");
      saveAuthMode("passkey");
    }

    // Passkey was expected but failed to restore - clear mode
    if (
      !passkeyAuth.isAuthenticated &&
      !passkeyAuth.isAuthenticating &&
      authMode === "passkey" &&
      passkeyAuth.isReady
    ) {
      setAuthMode(null);
      clearAuthMode();
    }
  }, [
    passkeyAuth.isAuthenticated,
    passkeyAuth.isAuthenticating,
    passkeyAuth.isReady,
    authMode,
    isReady,
  ]);

  // ============================================================
  // LOGIN: Passkey
  // ============================================================
  const loginWithPasskey = useCallback(async () => {
    // Disconnect wallet if connected
    if (isConnected) {
      await disconnectWallet();
    }

    const session = await passkeyAuth.createPasskey();
    setAuthMode("passkey");
    saveAuthMode("passkey");
    return session;
  }, [passkeyAuth, isConnected, disconnectWallet]);

  // ============================================================
  // LOGIN: Wallet
  // ============================================================
  const loginWithWallet = useCallback(() => {
    // Clear passkey if authenticated
    if (passkeyAuth.isAuthenticated) {
      passkeyAuth.signOut();
    }

    // Set mode and open wallet modal
    setAuthMode("wallet");
    saveAuthMode("wallet");
    appKit.open();
  }, [passkeyAuth]);

  // ============================================================
  // SIGN OUT
  // ============================================================
  const signOut = useCallback(async () => {
    // Clear passkey session (but keep credential for next login)
    passkeyAuth.signOut();

    // Disconnect wallet
    await disconnectWallet();

    // Clear auth mode (but NOT passkey credential - user should be able to log back in)
    setAuthMode(null);
    clearAuthMode(); // Only clear auth mode, not credential
    queryClient.clear();
  }, [passkeyAuth, disconnectWallet]);

  // ============================================================
  // COMPUTED STATE
  // ============================================================
  const isAuthenticated = useMemo(() => {
    if (authMode === "passkey") return passkeyAuth.isAuthenticated;
    if (authMode === "wallet") return isConnected && Boolean(address);
    return false;
  }, [authMode, passkeyAuth.isAuthenticated, isConnected, address]);

  // Include wallet connecting state in isAuthenticating for better UX
  const isAuthenticating = passkeyAuth.isAuthenticating || (authMode === "wallet" && isConnecting);

  const walletAddress = authMode === "wallet" && isConnected ? (address as Hex) : null;
  const eoaAddress = walletAddress ?? undefined;

  // ============================================================
  // CONTEXT VALUE
  // ============================================================
  const contextValue: ClientAuthContextType = useMemo(
    () => ({
      // State
      authMode,
      isReady: isReady && passkeyAuth.isReady,
      isAuthenticated,
      isAuthenticating,

      // Addresses
      eoaAddress,
      walletAddress,
      smartAccountAddress: passkeyAuth.smartAccountAddress,

      // Passkey
      credential: passkeyAuth.credential,
      smartAccountClient: passkeyAuth.smartAccountClient,

      // Error
      error: passkeyAuth.error,

      // Actions
      loginWithPasskey,
      loginWithWallet,
      signOut,

      // Legacy aliases
      signInWithPasskey: loginWithPasskey,
      createPasskey: passkeyAuth.createPasskey,
      clearPasskey: passkeyAuth.clearPasskey,
      setPasskeySession: passkeyAuth.setPasskeySession,
      connectWallet: loginWithWallet,
      disconnectWallet,
    }),
    [
      authMode,
      isReady,
      isAuthenticated,
      isAuthenticating,
      passkeyAuth,
      eoaAddress,
      walletAddress,
      loginWithPasskey,
      loginWithWallet,
      signOut,
      disconnectWallet,
    ]
  );

  return <ClientAuthContext.Provider value={contextValue}>{children}</ClientAuthContext.Provider>;
}

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <PasskeyAuthProvider>
      <ClientAuthProviderInner>{children}</ClientAuthProviderInner>
    </PasskeyAuthProvider>
  );
}
