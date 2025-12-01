/**
 * Client Auth Provider
 *
 * Orchestrates authentication for the client package.
 * Supports both passkey (primary) and wallet (fallback) auth modes.
 */

import { disconnect, watchAccount } from "@wagmi/core";
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
import { type Connector, useConfig } from "wagmi";
import { queryClient } from "../config/react-query";
import { type PasskeySession } from "../modules/auth/passkey";
import {
  AUTH_MODE_STORAGE_KEY,
  checkAndHandleFreshStart,
  clearAuthMode,
  clearSignedOut,
  saveAuthMode,
  setSignedOut,
  wasExplicitlySignedOut,
} from "../modules/auth/session";
import { PasskeyAuthProvider, usePasskeyAuth } from "./PasskeyAuth";

export type AuthMode = "passkey" | "wallet" | null;

interface ClientAuthContextType {
  // Unified auth interface properties
  authMode: AuthMode;
  eoaAddress: Hex | undefined;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;

  // Passkey state (from PasskeyAuthProvider)
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: PasskeySession["client"] | null;

  // Wallet state (from Wagmi)
  walletAddress: Hex | null;

  // Error state
  error: Error | null;

  // Passkey actions
  signInWithPasskey: () => Promise<PasskeySession>;
  createPasskey: () => Promise<PasskeySession>;
  clearPasskey: () => void;
  setPasskeySession: (session: PasskeySession) => void;

  // Wallet actions
  connectWallet?: (connector: Connector) => Promise<void>;
  disconnectWallet: () => Promise<void>;

  // Session actions
  signOut: () => Promise<void>;
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
export { AUTH_MODE_STORAGE_KEY } from "../modules/auth/session";

function ClientAuthProviderInner({ children }: { children: React.ReactNode }) {
  const wagmiConfig = useConfig();
  const passkeyAuth = usePasskeyAuth();

  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [walletAddress, setWalletAddress] = useState<Hex | null>(null);
  const freshStartChecked = useRef(false);
  // Track if we should block wallet auto-reconnection due to fresh start
  const blockWalletReconnect = useRef(false);

  // Handle fresh start detection and clear auth state if needed
  // This runs once on mount before other effects
  useEffect(() => {
    if (freshStartChecked.current) return;
    freshStartChecked.current = true;

    const savedAuthMode = localStorage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode;
    const isFreshStart = checkAndHandleFreshStart(savedAuthMode);

    if (isFreshStart) {
      // Fresh start detected - block wallet auto-reconnection
      blockWalletReconnect.current = true;
      // Disconnect wallet if it was connected
      void disconnect(wagmiConfig).catch(() => {
        // Ignore disconnect errors - wallet may not be connected
      });
      // Don't restore any auth mode - user must re-authenticate
      return;
    }

    // Not a fresh start - restore saved auth mode
    if (savedAuthMode === "passkey" && passkeyAuth.isAuthenticated) {
      setAuthMode("passkey");
    } else if (savedAuthMode === "wallet") {
      // Will be picked up by watchAccount below
      setAuthMode("wallet");
    }
  }, [passkeyAuth.isAuthenticated, wagmiConfig]);

  // Watch for wallet connections/disconnections
  // Always watch, but only update state when appropriate
  useEffect(() => {
    const unwatch = watchAccount(wagmiConfig, {
      onChange(account) {
        if (account.address && account.connector) {
          // Block wallet auto-reconnection after fresh start
          if (blockWalletReconnect.current) {
            console.log("[Auth] Blocking wallet auto-reconnection after fresh start");
            blockWalletReconnect.current = false; // Only block once
            void disconnect(wagmiConfig);
            return;
          }

          // Block wallet auto-reconnection after explicit sign-out
          if (wasExplicitlySignedOut()) {
            console.log("[Auth] Blocking wallet auto-reconnection after sign-out");
            void disconnect(wagmiConfig);
            return;
          }

          // Wallet connected - only update if not in passkey mode
          if (authMode === "passkey") {
            void disconnect(wagmiConfig);
            return;
          }

          // Drop any existing passkey session when switching to wallet
          if (passkeyAuth.isAuthenticated) {
            passkeyAuth.signOut();
          }

          setWalletAddress(account.address as Hex);
          setAuthMode("wallet");
          saveAuthMode("wallet");
        } else {
          // Wallet disconnected - clear wallet state regardless of mode
          setWalletAddress(null);
          if (authMode === "wallet") {
            setAuthMode(null);
            clearAuthMode();
          }
        }
      },
    });

    return () => unwatch();
  }, [authMode, passkeyAuth, wagmiConfig]);

  // When passkey auth completes, set authMode
  useEffect(() => {
    if (passkeyAuth.isAuthenticated && authMode !== "passkey") {
      setAuthMode("passkey");
      saveAuthMode("passkey");
    }
  }, [passkeyAuth.isAuthenticated, authMode]);

  const signInWithPasskey = useCallback(async () => {
    // Clear signed-out flag on explicit login
    clearSignedOut();

    // Disconnect wallet to enforce exclusivity
    try {
      await disconnect(wagmiConfig);
      setWalletAddress(null);
    } catch {
      // ignore disconnect errors
    }

    const session = await passkeyAuth.createPasskey();
    setAuthMode("passkey");
    saveAuthMode("passkey");
    return session;
  }, [passkeyAuth, wagmiConfig]);

  const signOut = useCallback(async () => {
    // Set signed-out flag FIRST to prevent wallet auto-reconnection
    setSignedOut();

    // Clear passkey session
    passkeyAuth.signOut();

    // Disconnect wallet regardless of mode
    try {
      await disconnect(wagmiConfig);
    } catch (err) {
      console.error("Failed to disconnect wallet", err);
    }

    // Clear all auth state
    setWalletAddress(null);
    setAuthMode(null);
    clearAuthMode();
    queryClient.clear();
  }, [passkeyAuth, wagmiConfig]);

  const isReady = passkeyAuth.isReady;
  const isAuthenticating = passkeyAuth.isAuthenticating;
  const isAuthenticated = useMemo(() => {
    if (authMode === "passkey") {
      return passkeyAuth.isAuthenticated;
    }
    if (authMode === "wallet") {
      return Boolean(walletAddress);
    }
    return false;
  }, [authMode, passkeyAuth.isAuthenticated, walletAddress]);

  // eoaAddress is walletAddress when in wallet mode, undefined otherwise
  const eoaAddress = authMode === "wallet" ? (walletAddress ?? undefined) : undefined;

  const contextValue: ClientAuthContextType = useMemo(
    () => ({
      // Unified auth interface
      authMode,
      eoaAddress,
      isReady,
      isAuthenticated,
      isAuthenticating,

      // Passkey state
      credential: passkeyAuth.credential,
      smartAccountAddress: passkeyAuth.smartAccountAddress,
      smartAccountClient: passkeyAuth.smartAccountClient,

      // Wallet state
      walletAddress,

      // Error state
      error: passkeyAuth.error,

      // Actions
      signInWithPasskey,
      createPasskey: passkeyAuth.createPasskey,
      clearPasskey: passkeyAuth.clearPasskey,
      setPasskeySession: passkeyAuth.setPasskeySession,
      connectWallet: async () => {},
      disconnectWallet: () => disconnect(wagmiConfig),
      signOut,
    }),
    [
      authMode,
      eoaAddress,
      passkeyAuth,
      walletAddress,
      isAuthenticating,
      isReady,
      isAuthenticated,
      signOut,
      signInWithPasskey,
      wagmiConfig,
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
