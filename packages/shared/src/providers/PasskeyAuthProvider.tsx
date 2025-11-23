/**
 * Passkey Auth Provider
 *
 * Manages passkey (WebAuthn) authentication and smart account state.
 * Does NOT handle wallet connections - use ClientAuthProvider for that.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Hex } from "viem";
import { type P256Credential } from "viem/account-abstraction";
import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import {
  clearStoredCredential,
  type PasskeySession,
  authenticatePasskey,
  registerPasskeySession,
  restorePasskeySession,
} from "../modules/auth/passkey";

interface PasskeyAuthContextType {
  // Passkey state
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: PasskeySession["client"] | null;

  // Status flags
  isAuthenticating: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  error: Error | null;

  // Actions
  createPasskey: () => Promise<PasskeySession>;
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

export const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";
const PASSKEY_SIGNED_OUT_KEY = "greengoods_passkey_signed_out";

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const credential = session?.credential ?? null;
  const smartAccountAddress = session?.address ?? null;
  const smartAccountClient = session?.client ?? null;

  // Restore passkey session on mount
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const hasStoredCredential = !!localStorage.getItem(PASSKEY_STORAGE_KEY);
      const wasSignedOut = localStorage.getItem(PASSKEY_SIGNED_OUT_KEY) === "true";

      if (hasStoredCredential && !wasSignedOut) {
        setIsAuthenticating(true);
        try {
          const restored = await restorePasskeySession(chainId);
          if (!cancelled && restored) {
            setSession(restored);
          }
        } catch (err) {
          if (!cancelled) {
            console.error("Failed to restore passkey session", err);
            setError(err instanceof Error ? err : new Error("Failed to restore passkey"));
            localStorage.removeItem(PASSKEY_STORAGE_KEY);
          }
        } finally {
          if (!cancelled) {
            setIsAuthenticating(false);
          }
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

  const resumePasskey = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const sessionToUse = await authenticatePasskey(chainId);
      setSession(sessionToUse);
      localStorage.removeItem(PASSKEY_SIGNED_OUT_KEY);
      return sessionToUse;
    } catch (err) {
      console.error("Passkey authentication failed", err);
      const error =
        err instanceof Error ? err : new Error("Failed to authenticate passkey. Please try again.");
      setError(error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [chainId]);

  const createPasskey = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      let sessionToUse: PasskeySession | null = null;

      const hasStoredCredential = !!localStorage.getItem(PASSKEY_STORAGE_KEY);
      if (hasStoredCredential) {
        try {
          sessionToUse = await authenticatePasskey(chainId);
        } catch (resumeError) {
          console.warn("Failed to authenticate existing passkey, creating a new one", resumeError);
        }
      }

      if (!sessionToUse) {
        sessionToUse = await registerPasskeySession(chainId);
      }

      setSession(sessionToUse);
      localStorage.removeItem(PASSKEY_SIGNED_OUT_KEY);
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
    setSession(null);
    setIsAuthenticating(false);
    setError(null);
    localStorage.setItem(PASSKEY_SIGNED_OUT_KEY, "true");
  }, []);

  const clearPasskey = useCallback(() => {
    clearStoredCredential();
    localStorage.removeItem(PASSKEY_SIGNED_OUT_KEY);
    signOut();
  }, [signOut]);

  const setPasskeySession = useCallback((newSession: PasskeySession) => {
    setSession(newSession);
    localStorage.removeItem(PASSKEY_SIGNED_OUT_KEY);
  }, []);

  const isReady = isInitialized;
  const isAuthenticated = Boolean(credential && smartAccountAddress && smartAccountClient);

  const contextValue: PasskeyAuthContextType = useMemo(
    () => ({
      credential,
      smartAccountAddress,
      smartAccountClient,
      isAuthenticating,
      isReady,
      isAuthenticated,
      error,
      createPasskey,
      resumePasskey,
      clearPasskey,
      setPasskeySession,
      signOut,
    }),
    [
      credential,
      smartAccountAddress,
      smartAccountClient,
      isAuthenticating,
      isReady,
      isAuthenticated,
      error,
      createPasskey,
      resumePasskey,
      clearPasskey,
      setPasskeySession,
      signOut,
    ]
  );

  return <PasskeyAuthContext.Provider value={contextValue}>{children}</PasskeyAuthContext.Provider>;
}
