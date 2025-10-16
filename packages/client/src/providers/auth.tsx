/**
 * Authentication Provider
 *
 * Manages user authentication via passkey (WebAuthn) or traditional wallets.
 * Handles smart account initialization with Pimlico for gasless transactions.
 *
 * @module providers/auth
 */

import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Hex } from "viem";
import {
  createWebAuthnCredential,
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import { connect, disconnect, getAccount, watchAccount, type Connector } from "@wagmi/core";
import { DEFAULT_CHAIN_ID } from "@/config/blockchain";
import { wagmiConfig } from "@/config/appkit";
import {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getChainFromId,
} from "@/modules/pimlico/config";

/**
 * Authentication mode type
 * - passkey: WebAuthn biometric authentication (primary for gardeners)
 * - wallet: Traditional wallet connection (MetaMask, WalletConnect, etc.) for operators
 * - null: Not authenticated
 */
export type AuthMode = "passkey" | "wallet" | null;

/**
 * Authentication context value
 */
interface AuthContextType {
  authMode: AuthMode;
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: SmartAccountClient | null;
  walletAddress: Hex | null;
  walletConnector: Connector | null;
  isCreating: boolean;
  isAuthenticating: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  createPasskey: () => Promise<SmartAccountClient>;
  clearPasskey: () => void;
  connectWallet: (connector: Connector) => Promise<void>;
  disconnectWallet: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Hook to access authentication context.
 * Must be used within AuthProvider.
 *
 * @throws If used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

/**
 * LocalStorage keys for persisting auth state
 *
 * Security Note: Only public credential data is stored.
 * Private keys never leave the device's secure enclave.
 */
const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";
const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

/**
 * Serializable passkey credential data (public data only).
 * Used for localStorage persistence.
 *
 * Note: P256Credential from viem includes id, publicKey, and raw authenticator data.
 * The raw field contains the WebAuthn response needed for credential verification.
 */
interface SerializedCredential {
  id: string;
  publicKey: string;
  raw: {
    id: string;
    type: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      attestationObject: string;
    };
  };
}

/**
 * Props for AuthProvider component
 */
interface AuthProviderProps {
  children: React.ReactNode;
  chainId?: number;
}

interface AuthState {
  authMode: AuthMode;
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: SmartAccountClient | null;
  walletAddress: Hex | null;
  walletConnector: Connector | null;
  isCreating: boolean;
  isAuthenticating: boolean;
  isReady: boolean;
  error: Error | null;
}

const initialState: AuthState = {
  authMode: null,
  credential: null,
  smartAccountAddress: null,
  smartAccountClient: null,
  walletAddress: null,
  walletConnector: null,
  isCreating: false,
  isAuthenticating: false,
  isReady: false,
  error: null,
};

/**
 * Authentication Provider Component
 *
 * Provides authentication context to the entire app.
 * Manages passkey and wallet authentication, smart account initialization.
 *
 * Initialization Flow:
 * 1. Load saved auth mode from localStorage
 * 2. If passkey mode: Load credential and initialize smart account
 * 3. If wallet mode: Check for existing wallet connection
 * 4. Set isReady to true when initialization complete
 */
export function AuthProvider({ children, chainId = DEFAULT_CHAIN_ID }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);

  const setStatePartial = useCallback((patch: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const initializeSmartAccount = useCallback(
    async (credential: P256Credential): Promise<SmartAccountClient> => {
      setStatePartial({ isAuthenticating: true, error: null });

      try {
        const chain = getChainFromId(chainId);
        const publicClient = createPublicClientForChain(chainId);
        const pimlicoClient = createPimlicoClientForChain(chainId);
        const webAuthnAccount = toWebAuthnAccount({ credential });
        const kernelAccount = await toKernelSmartAccount({
          client: publicClient,
          version: "0.3.1",
          owners: [webAuthnAccount],
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        });

        const client = createSmartAccountClient({
          account: kernelAccount,
          chain,
          bundlerTransport: pimlicoClient.transport,
          paymaster: pimlicoClient,
        });

        localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");

        setStatePartial({
          authMode: "passkey",
          credential,
          smartAccountAddress: kernelAccount.address,
          smartAccountClient: client,
          isAuthenticating: false,
        });

        return client;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to initialize smart account. Please try again.");
        setStatePartial({
          authMode: null,
          smartAccountAddress: null,
          smartAccountClient: null,
          isAuthenticating: false,
          error,
        });
        throw error;
      }
    },
    [chainId, setStatePartial]
  );

  const restorePasskeyFromStorage = useCallback(async () => {
    try {
      const saved = localStorage.getItem(PASSKEY_STORAGE_KEY);
      if (!saved) return;

      const serialized = JSON.parse(saved) as SerializedCredential;
      const reconstructed: P256Credential = {
        id: serialized.id,
        publicKey: serialized.publicKey as Hex,
        raw: serialized.raw as unknown as P256Credential["raw"],
      };

      await initializeSmartAccount(reconstructed);
    } catch (err) {
      console.error("Failed to restore passkey from storage", err);
      localStorage.removeItem(PASSKEY_STORAGE_KEY);
      localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    }
  }, [initializeSmartAccount]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const savedAuthMode = localStorage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode;

      if (savedAuthMode === "passkey") {
        await restorePasskeyFromStorage();
      } else if (savedAuthMode === "wallet") {
        const account = getAccount(wagmiConfig);
        if (account.address) {
          setStatePartial({
            authMode: "wallet",
            walletAddress: account.address as Hex,
            walletConnector: account.connector || null,
          });
        } else {
          localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
        }
      }

      if (!cancelled) {
        setStatePartial({ isReady: true });
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [restorePasskeyFromStorage, setStatePartial]);

  useEffect(() => {
    const unwatch = watchAccount(wagmiConfig, {
      onChange(account) {
        if (account.address) {
          setStatePartial({
            authMode: "wallet",
            walletAddress: account.address as Hex,
            walletConnector: account.connector || null,
            error: null,
          });
          localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
        } else {
          setStatePartial({
            authMode: null,
            walletAddress: null,
            walletConnector: null,
          });
          localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
        }
      },
    });

    return () => {
      unwatch();
    };
  }, [setStatePartial]);

  const createPasskey = useCallback(async () => {
    setStatePartial({ isAuthenticating: true, isCreating: true, error: null });

    try {
      const newCredential = await createWebAuthnCredential({ name: "Green Goods Wallet" });
      const serialized: SerializedCredential = {
        id: newCredential.id,
        publicKey: newCredential.publicKey,
        raw: newCredential.raw as unknown,
      };

      localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(serialized));

      const client = await initializeSmartAccount(newCredential);
      return client;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to create passkey. Please try again.");
      setStatePartial({ error, isAuthenticating: false });
      throw error;
    } finally {
      setStatePartial({ isCreating: false });
    }
  }, [initializeSmartAccount, setStatePartial]);

  const clearPasskey = useCallback(() => {
    localStorage.removeItem(PASSKEY_STORAGE_KEY);
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setState((prev) => ({ ...initialState, isReady: prev.isReady }));
  }, []);

  const connectWallet = useCallback(
    async (connector: Connector) => {
      setStatePartial({ isAuthenticating: true, isCreating: true, error: null });

      try {
        const result = await connect(wagmiConfig, { connector });

        setStatePartial({
          authMode: "wallet",
          walletAddress: result.accounts[0] as Hex,
          walletConnector: connector,
          isAuthenticating: false,
        });

        localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to connect wallet. Please try again.");
        setStatePartial({ error, isAuthenticating: false });
        throw error;
      } finally {
        setStatePartial({ isCreating: false });
      }
    },
    [setStatePartial]
  );

  const disconnectWallet = useCallback(() => {
    disconnect(wagmiConfig);
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setStatePartial({
      authMode: null,
      walletAddress: null,
      walletConnector: null,
      error: null,
    });
  }, [setStatePartial]);

  const isAuthenticated = useMemo(() => {
    if (state.authMode === "passkey") {
      return Boolean(state.smartAccountAddress && state.smartAccountClient);
    }

    if (state.authMode === "wallet") {
      return Boolean(state.walletAddress && state.walletConnector);
    }

    return false;
  }, [
    state.authMode,
    state.smartAccountAddress,
    state.smartAccountClient,
    state.walletAddress,
    state.walletConnector,
  ]);

  const contextValue: AuthContextType = useMemo(
    () => ({
      authMode: state.authMode,
      credential: state.credential,
      smartAccountAddress: state.smartAccountAddress,
      smartAccountClient: state.smartAccountClient,
      walletAddress: state.walletAddress,
      walletConnector: state.walletConnector,
      isCreating: state.isCreating,
      isAuthenticating: state.isAuthenticating,
      isReady: state.isReady,
      isAuthenticated,
      error: state.error,
      createPasskey,
      clearPasskey,
      connectWallet,
      disconnectWallet,
    }),
    [
      state.authMode,
      state.credential,
      state.smartAccountAddress,
      state.smartAccountClient,
      state.walletAddress,
      state.walletConnector,
      state.isCreating,
      state.isAuthenticating,
      state.isReady,
      state.error,
      isAuthenticated,
      createPasskey,
      clearPasskey,
      connectWallet,
      disconnectWallet,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
