/**
 * Passkey Auth Provider
 *
 * Client package authentication with passkey-first approach.
 * Supports both passkey (smart account) and wallet auth modes.
 */

import { type Connector, connect, disconnect, getAccount, watchAccount } from "@wagmi/core";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Hex } from "viem";
import { type P256Credential } from "viem/account-abstraction";
import { useConfig } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import {
  clearStoredCredential,
  type PasskeySession,
  registerPasskeySession,
  restorePasskeySession,
} from "../modules/auth/passkey";

export type AuthMode = "passkey" | "wallet" | null;

interface PasskeyAuthContextType {
  // Auth mode
  authMode: AuthMode;

  // Passkey state
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: PasskeySession["client"] | null;

  // Wallet state
  walletAddress: Hex | null;
  walletConnector: Connector | null;

  // Status flags - separate concerns
  isAuthenticating: boolean; // Currently in auth flow (passkey creation, wallet connection)
  isReady: boolean; // Provider has finished initialization
  isAuthenticated: boolean; // User has valid credentials AND smart account is ready
  error: Error | null;

  // Passkey actions
  createPasskey: () => Promise<PasskeySession>;
  clearPasskey: () => void;
  setPasskeySession: (session: PasskeySession) => void;

  // Wallet actions
  connectWallet: (connector: Connector) => Promise<void>;
  disconnectWallet: () => Promise<void>;

  // Session actions
  signOut: () => void;
}

const PasskeyAuthContext = createContext<PasskeyAuthContextType | undefined>(undefined);

export function usePasskeyAuth(): PasskeyAuthContextType {
  const context = useContext(PasskeyAuthContext);
  if (!context) {
    throw new Error("usePasskeyAuth must be used within PasskeyAuthProvider");
  }
  return context;
}

export function useOptionalPasskeyAuth(): PasskeyAuthContextType | undefined {
  return useContext(PasskeyAuthContext);
}

export const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

interface PasskeyAuthProviderProps {
  children: React.ReactNode;
  chainId?: number;
}

export function PasskeyAuthProvider({
  children,
  chainId = DEFAULT_CHAIN_ID,
}: PasskeyAuthProviderProps) {
  // Get Wagmi config from WagmiProvider context (ensures we use the same instance)
  const wagmiConfig = useConfig();

  // Auth mode
  const [authMode, setAuthMode] = useState<AuthMode>(null);

  // Passkey state
  const [session, setSession] = useState<PasskeySession | null>(null);

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<Hex | null>(null);
  const [walletConnector, setWalletConnector] = useState<Connector | null>(null);

  // Status
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const credential = session?.credential ?? null;
  const smartAccountAddress = session?.address ?? null;
  const smartAccountClient = session?.client ?? null;

  const syncWalletAccount = useCallback(
    (accountOverride?: ReturnType<typeof getAccount>) => {
      const account = accountOverride ?? getAccount(wagmiConfig);
      if (!account.address || !account.connector) {
        return false;
      }

      setWalletAddress(account.address as Hex);
      setWalletConnector(account.connector);
      setAuthMode("wallet");
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
      return true;
    },
    [wagmiConfig]
  );

  // Load saved auth mode and credentials on mount
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const savedAuthMode = localStorage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode | null;

      if (savedAuthMode === "passkey") {
        setIsAuthenticating(true);
        try {
          const restored = await restorePasskeySession(chainId);
          if (!cancelled && restored) {
            setSession(restored);
            setAuthMode("passkey");
          }
        } catch (err) {
          if (!cancelled) {
            console.error("Failed to restore passkey session", err);
            setError(err instanceof Error ? err : new Error("Failed to restore passkey"));
            localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
          }
        } finally {
          if (!cancelled) {
            setIsAuthenticating(false);
          }
        }
      } else if (savedAuthMode === "wallet") {
        const account = getAccount(wagmiConfig);
        if (account.address && !cancelled) {
          setWalletAddress(account.address as Hex);
          setWalletConnector(account.connector || null);
          setAuthMode("wallet");
        }
      }

      if (!cancelled) {
        setIsInitialized(true);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [chainId, wagmiConfig]);

  // Watch for wallet account changes
  useEffect(() => {
    if (authMode !== "wallet") return;

    const unwatch = watchAccount(wagmiConfig, {
      onChange(account) {
        if (account.address) {
          setWalletAddress(account.address as Hex);
          setWalletConnector(account.connector || null);
        } else {
          // Wallet disconnected
          setWalletAddress(null);
          setWalletConnector(null);
          setAuthMode(null);
          localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
        }
      },
    });

    return () => unwatch();
  }, [authMode, wagmiConfig]);

  const createPasskey = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      let sessionToUse: PasskeySession | null = null;

      try {
        sessionToUse = await restorePasskeySession(chainId);
      } catch (restoreError) {
        console.warn("Failed to restore saved passkey session, creating a new one", restoreError);
      }

      if (!sessionToUse) {
        sessionToUse = await registerPasskeySession(chainId);
      }

      setSession(sessionToUse);
      setAuthMode("passkey");
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
      return sessionToUse;
    } catch (err) {
      console.error("Passkey creation failed", err);
      const error =
        err instanceof Error ? err : new Error("Failed to create passkey. Please try again.");
      setError(error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [chainId]);

  const signOut = useCallback(() => {
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setSession(null);
    setWalletAddress(null);
    setWalletConnector(null);
    setAuthMode(null);
    setIsAuthenticating(false);
    setError(null);
  }, []);

  const clearPasskey = useCallback(() => {
    clearStoredCredential();
    signOut();
  }, [signOut]);

  const setPasskeySession = useCallback((newSession: PasskeySession) => {
    setSession(newSession);
    setAuthMode("passkey");
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
  }, []);

  const connectWallet = useCallback(
    async (connector: Connector) => {
      setIsAuthenticating(true);
      setError(null);

      try {
        const account = getAccount(wagmiConfig);
        const isAlreadyConnected =
          Boolean(account.address) && account.connector?.id === connector.id;

        if (isAlreadyConnected && syncWalletAccount(account)) {
          return;
        }

        const result = await connect(wagmiConfig, { connector });

        setWalletAddress(result.accounts[0] as Hex);
        setWalletConnector(connector);
        setAuthMode("wallet");
        localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
      } catch (err) {
        if (err instanceof Error && err.name === "ConnectorAlreadyConnectedError") {
          const hydrated = syncWalletAccount();
          if (hydrated) {
            console.info("Wallet already connected; hydrated existing session");
            return;
          }
        }

        console.error("Wallet connection failed", err);
        const error =
          err instanceof Error ? err : new Error("Failed to connect wallet. Please try again.");
        setError(error);
        throw error;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [syncWalletAccount, wagmiConfig]
  );

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect(wagmiConfig);
    } catch (err) {
      console.error("Wallet disconnect failed", err);
    } finally {
      signOut();
    }
  }, [signOut, wagmiConfig]);

  // isReady means auth provider has finished initialization (checked localStorage, etc.)
  const isReady = isInitialized;

  // isAuthenticated means user has valid credentials AND smart account is ready
  const isAuthenticated = useMemo(() => {
    if (authMode === "passkey") {
      // Only consider authenticated when smart account client is fully ready
      return Boolean(credential && smartAccountAddress && smartAccountClient);
    }
    if (authMode === "wallet") {
      return Boolean(walletAddress && walletConnector);
    }
    return false;
  }, [
    authMode,
    credential,
    smartAccountAddress,
    smartAccountClient,
    walletAddress,
    walletConnector,
  ]);

  const contextValue: PasskeyAuthContextType = useMemo(
    () => ({
      authMode,
      credential,
      smartAccountAddress,
      smartAccountClient,
      walletAddress,
      walletConnector,
      isAuthenticating,
      isReady,
      isAuthenticated,
      error,
      createPasskey,
      clearPasskey,
      setPasskeySession,
      connectWallet,
      disconnectWallet,
      signOut,
    }),
    [
      authMode,
      credential,
      smartAccountAddress,
      smartAccountClient,
      walletAddress,
      walletConnector,
      isAuthenticating,
      isReady,
      isAuthenticated,
      error,
      createPasskey,
      clearPasskey,
      setPasskeySession,
      connectWallet,
      disconnectWallet,
      signOut,
    ]
  );

  return <PasskeyAuthContext.Provider value={contextValue}>{children}</PasskeyAuthContext.Provider>;
}
