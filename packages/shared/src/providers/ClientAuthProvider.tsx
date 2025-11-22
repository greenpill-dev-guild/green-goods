/**
 * Client Auth Provider
 *
 * Orchestrates authentication for the client package.
 * Supports both passkey (primary) and wallet (fallback) auth modes.
 */

import { disconnect, watchAccount } from "@wagmi/core";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Hex } from "viem";
import { type P256Credential } from "viem/account-abstraction";
import { type Connector, useConfig } from "wagmi";
import { queryClient } from "../config/react-query";
import { type PasskeySession } from "../modules/auth/passkey";
import { PasskeyAuthProvider, usePasskeyAuth } from "./PasskeyAuthProvider";

export type AuthMode = "passkey" | "wallet" | null;

interface ClientAuthContextType {
  // Auth mode
  authMode: AuthMode;

  // Passkey state (from PasskeyAuthProvider)
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: PasskeySession["client"] | null;

  // Wallet state (from Wagmi)
  walletAddress: Hex | null;

  // Status flags
  isAuthenticating: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
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

export const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

function ClientAuthProviderInner({ children }: { children: React.ReactNode }) {
  const wagmiConfig = useConfig();
  const passkeyAuth = usePasskeyAuth();

  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [walletAddress, setWalletAddress] = useState<Hex | null>(null);

  // Load saved auth mode on mount
  useEffect(() => {
    const savedAuthMode = localStorage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode | null;

    if (savedAuthMode === "passkey" && passkeyAuth.isAuthenticated) {
      setAuthMode("passkey");
    } else if (savedAuthMode === "wallet") {
      // Will be picked up by watchAccount below
      setAuthMode("wallet");
    }
  }, [passkeyAuth.isAuthenticated]);

  // Watch for wallet connections/disconnections
  // Always watch, but only update state when appropriate
  useEffect(() => {
    const unwatch = watchAccount(wagmiConfig, {
      onChange(account) {
        if (account.address && account.connector) {
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
          localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
        } else {
          // Wallet disconnected - clear wallet state regardless of mode
          setWalletAddress(null);
          if (authMode === "wallet") {
            setAuthMode(null);
            localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
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
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
    }
  }, [passkeyAuth.isAuthenticated, authMode]);

  const signInWithPasskey = useCallback(async () => {
    // Disconnect wallet to enforce exclusivity
    try {
      await disconnect(wagmiConfig);
      setWalletAddress(null);
    } catch {
      // ignore disconnect errors
    }

    const session = await passkeyAuth.createPasskey();
    setAuthMode("passkey");
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
    return session;
  }, [passkeyAuth, wagmiConfig]);

  const signOut = useCallback(async () => {
    // Clear passkey session
    passkeyAuth.signOut();

    // Disconnect wallet if in wallet mode
    // The watchAccount callback will automatically clear wallet state
    if (authMode === "wallet") {
      try {
        await disconnect(wagmiConfig);
      } catch (err) {
        console.error("Failed to disconnect wallet", err);
        // Manually clear state if disconnect fails
        setWalletAddress(null);
        setAuthMode(null);
        localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
      }
    } else {
      // Not in wallet mode, just clear state
      setWalletAddress(null);
      setAuthMode(null);
      localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    }
    queryClient.clear();
  }, [authMode, passkeyAuth, wagmiConfig]);

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

  const contextValue: ClientAuthContextType = useMemo(
    () => ({
      authMode,
      credential: passkeyAuth.credential,
      smartAccountAddress: passkeyAuth.smartAccountAddress,
      smartAccountClient: passkeyAuth.smartAccountClient,
      walletAddress,
      isAuthenticating,
      isReady,
      isAuthenticated,
      error: passkeyAuth.error,
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
      passkeyAuth,
      walletAddress,
      isAuthenticating,
      isReady,
      isAuthenticated,
      signOut,
      signInWithPasskey,
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
