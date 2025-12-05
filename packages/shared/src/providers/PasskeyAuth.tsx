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
  authenticatePasskey,
  clearStoredCredential,
  type PasskeySession,
  registerPasskeySession,
  restorePasskeySession,
} from "../modules/auth/passkey";
import {
  clearPasskeySignedOut,
  hasStoredPasskeyCredential,
  isFreshAppStart,
  markSessionActive,
  PASSKEY_STORAGE_KEY,
  setPasskeySignedOut,
  wasPasskeySignedOut,
} from "../modules/auth/session";

interface PasskeyAuthContextType {
  // Unified auth interface properties
  authMode: "passkey" | null;
  eoaAddress?: Hex | undefined;
  /** Wallet address (alias for compatibility - same as eoaAddress) */
  walletAddress?: Hex | undefined;

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const credential = session?.credential ?? null;
  const smartAccountAddress = session?.address ?? null;
  const smartAccountClient = session?.client ?? null;

  // Restore passkey session on mount
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      // Check for fresh app start (reinstall detection)
      // If detected, don't auto-restore - require user to re-authenticate
      if (isFreshAppStart()) {
        markSessionActive();
        if (hasStoredPasskeyCredential()) {
          console.log("[Auth] Detected fresh app start - requiring re-authentication");
        }
        if (!cancelled) {
          setIsInitialized(true);
        }
        return;
      }

      // Mark session as active for subsequent checks
      markSessionActive();

      if (hasStoredPasskeyCredential() && !wasPasskeySignedOut()) {
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
            clearStoredCredential();
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
      clearPasskeySignedOut();
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

      if (hasStoredPasskeyCredential()) {
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
      clearPasskeySignedOut();
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
    setPasskeySignedOut();
  }, []);

  const clearPasskeyHandler = useCallback(() => {
    clearStoredCredential();
    clearPasskeySignedOut();
    signOut();
  }, [signOut]);

  const setPasskeySession = useCallback((newSession: PasskeySession) => {
    setSession(newSession);
    clearPasskeySignedOut();
  }, []);

  const isReady = isInitialized;
  const isAuthenticated = Boolean(credential && smartAccountAddress && smartAccountClient);

  const contextValue: PasskeyAuthContextType = useMemo(
    () => ({
      // Unified auth interface
      authMode: isAuthenticated ? "passkey" : null,
      eoaAddress: undefined,
      walletAddress: undefined,

      // Passkey state
      credential,
      smartAccountAddress,
      smartAccountClient,
      isAuthenticating,
      isReady,
      isAuthenticated,
      error,
      createPasskey,
      resumePasskey,
      clearPasskey: clearPasskeyHandler,
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
      clearPasskeyHandler,
      setPasskeySession,
      signOut,
    ]
  );

  return <PasskeyAuthContext.Provider value={contextValue}>{children}</PasskeyAuthContext.Provider>;
}
