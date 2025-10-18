import { type Connector, connect, disconnect, getAccount, watchAccount } from "@wagmi/core";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Hex } from "viem";
import { type P256Credential } from "viem/account-abstraction";
import { wagmiConfig } from "@/config/appkit";
import { DEFAULT_CHAIN_ID } from "@/config/blockchain";
import {
  clearStoredCredential,
  type PasskeySession,
  registerPasskeySession,
  restorePasskeySession,
} from "@/modules/auth/passkey";

export type AuthMode = "passkey" | "wallet" | null;

interface AuthContextType {
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

  // Wallet actions
  connectWallet: (connector: Connector) => Promise<void>;
  disconnectWallet: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

interface AuthProviderProps {
  children: React.ReactNode;
  chainId?: number;
}

export function AuthProvider({ children, chainId = DEFAULT_CHAIN_ID }: AuthProviderProps) {
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
  }, [chainId]);

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
  }, [authMode]);

  const createPasskey = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const newSession = await registerPasskeySession(chainId);
      setSession(newSession);
      setAuthMode("passkey");
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
      return newSession;
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

  const clearPasskey = useCallback(() => {
    clearStoredCredential();
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setSession(null);
    setAuthMode(null);
    setError(null);
    console.log("Passkey cleared");
  }, []);

  const connectWallet = useCallback(async (connector: Connector) => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const result = await connect(wagmiConfig, { connector });

      setWalletAddress(result.accounts[0] as Hex);
      setWalletConnector(connector);
      setAuthMode("wallet");
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");

      console.log("Wallet connected", { account: result.accounts[0] });
    } catch (err) {
      console.error("Wallet connection failed", err);
      const error =
        err instanceof Error ? err : new Error("Failed to connect wallet. Please try again.");
      setError(error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    disconnect(wagmiConfig);
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setWalletAddress(null);
    setWalletConnector(null);
    setAuthMode(null);
    setError(null);
    console.log("Wallet disconnected");
  }, []);

  // isReady means auth provider has finished initialization (checked localStorage, etc.)
  const isReady = isInitialized;

  // isAuthenticated means user has valid credentials AND smart account is ready
  const isAuthenticated = useMemo(() => {
    if (authMode === "passkey") {
      // Only consider authenticated when smart account client is fully ready
      return Boolean(credential && smartAccountAddress && smartAccountClient);
    } else if (authMode === "wallet") {
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

  const contextValue: AuthContextType = useMemo(
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
      connectWallet,
      disconnectWallet,
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
      connectWallet,
      disconnectWallet,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
