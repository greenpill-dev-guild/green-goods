/**
 * Passkey Auth Provider
 *
 * Manages passkey (WebAuthn) authentication and smart account state.
 * Automatically restores session on mount if credentials exist.
 */

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
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import {
  authenticatePasskey,
  clearStoredCredential,
  type PasskeySession,
  registerPasskeySession,
  restorePasskeySession,
} from "../modules/auth/passkey";
import { clearStoredPasskey, hasStoredPasskey, PASSKEY_STORAGE_KEY } from "../modules/auth/session";

interface PasskeyAuthContextType {
  // State
  authMode: "passkey" | null;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: Error | null;

  // Passkey data
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: PasskeySession["client"] | null;

  // Check if passkey exists
  hasStoredCredential: boolean;

  // Legacy aliases
  eoaAddress?: Hex | undefined;
  walletAddress?: Hex | undefined;

  // Actions
  createPasskey: () => Promise<PasskeySession>;
  loginPasskey: () => Promise<PasskeySession>;
  resumePasskey: () => Promise<PasskeySession>;
  clearPasskey: () => void;
  setPasskeySession: (session: PasskeySession) => void;
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

// Re-export for backwards compatibility
export { PASSKEY_STORAGE_KEY } from "../modules/auth/session";

interface PasskeyAuthProviderProps {
  children: React.ReactNode;
  chainId?: number;
}

export function PasskeyAuthProvider({
  children,
  chainId = DEFAULT_CHAIN_ID,
}: PasskeyAuthProviderProps) {
  const [session, setSession] = useState<PasskeySession | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initRef = useRef(false);

  const credential = session?.credential ?? null;
  const smartAccountAddress = session?.address ?? null;
  const smartAccountClient = session?.client ?? null;
  const isAuthenticated = Boolean(credential && smartAccountAddress && smartAccountClient);
  const [hasStoredCredential, setHasStoredCredential] = useState(() => hasStoredPasskey());

  // ============================================================
  // INITIALIZE: Restore session on mount
  // ============================================================
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const restore = async () => {
      if (hasStoredPasskey()) {
        setIsAuthenticating(true);
        try {
          const restored = await restorePasskeySession(chainId);
          if (restored) {
            setSession(restored);
          }
        } catch (err) {
          console.error("[PasskeyAuth] Failed to restore session:", err);
          setError(err instanceof Error ? err : new Error("Failed to restore passkey"));
          // Clear invalid credential
          clearStoredCredential();
        } finally {
          setIsAuthenticating(false);
        }
      }
      setIsReady(true);
    };

    void restore();
  }, [chainId]);

  // ============================================================
  // CREATE: Register a NEW passkey (always creates new credential)
  // ============================================================
  const createPasskey = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      // Always create a new passkey - don't try to authenticate existing
      // This prevents silent credential creation when user expects login
      const newSession = await registerPasskeySession(chainId);
      setSession(newSession);
      setHasStoredCredential(true);
      return newSession;
    } catch (err) {
      console.error("[PasskeyAuth] Create failed:", err);
      const error = err instanceof Error ? err : new Error("Failed to create passkey");
      setError(error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [chainId]);

  // ============================================================
  // LOGIN: Authenticate with EXISTING passkey (prompts biometric)
  // ============================================================
  const loginPasskey = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      // Check if there's a stored credential first
      if (!hasStoredPasskey()) {
        throw new Error("No passkey found. Please create a new account.");
      }

      const existingSession = await authenticatePasskey(chainId);
      setSession(existingSession);
      return existingSession;
    } catch (err) {
      console.error("[PasskeyAuth] Login failed:", err);
      const error = err instanceof Error ? err : new Error("Failed to authenticate passkey");
      setError(error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [chainId]);

  // ============================================================
  // RESUME: Authenticate with existing passkey
  // ============================================================
  const resumePasskey = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const resumed = await authenticatePasskey(chainId);
      setSession(resumed);
      return resumed;
    } catch (err) {
      console.error("[PasskeyAuth] Resume failed:", err);
      const error = err instanceof Error ? err : new Error("Failed to authenticate passkey");
      setError(error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [chainId]);

  // ============================================================
  // SIGN OUT: Clear session
  // ============================================================
  const signOut = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  // ============================================================
  // CLEAR: Remove stored credential and sign out
  // ============================================================
  const clearPasskey = useCallback(() => {
    clearStoredCredential();
    clearStoredPasskey();
    setHasStoredCredential(false);
    signOut();
  }, [signOut]);

  // ============================================================
  // SET SESSION: Manual session update
  // ============================================================
  const setPasskeySession = useCallback((newSession: PasskeySession) => {
    setSession(newSession);
    setError(null);
  }, []);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================
  const contextValue: PasskeyAuthContextType = useMemo(
    () => ({
      // State
      authMode: isAuthenticated ? "passkey" : null,
      isReady,
      isAuthenticated,
      isAuthenticating,
      error,

      // Passkey data
      credential,
      smartAccountAddress,
      smartAccountClient,

      // Check if passkey exists
      hasStoredCredential,

      // Legacy aliases
      eoaAddress: undefined,
      walletAddress: undefined,

      // Actions
      createPasskey,
      loginPasskey,
      resumePasskey,
      clearPasskey,
      setPasskeySession,
      signOut,
    }),
    [
      isReady,
      isAuthenticated,
      isAuthenticating,
      error,
      credential,
      smartAccountAddress,
      smartAccountClient,
      hasStoredCredential,
      createPasskey,
      loginPasskey,
      resumePasskey,
      clearPasskey,
      setPasskeySession,
      signOut,
    ]
  );

  return <PasskeyAuthContext.Provider value={contextValue}>{children}</PasskeyAuthContext.Provider>;
}
