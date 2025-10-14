import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import React, { createContext, useContext, useEffect, useState } from "react";
import { type Hex, http } from "viem";
import {
  createWebAuthnCredential,
  entryPoint07Address,
  type P256Credential,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import { connect, disconnect, getAccount, watchAccount, type Connector } from "@wagmi/core";
import { DEFAULT_CHAIN_ID } from "@/config/blockchain";
import { wagmiConfig } from "@/config/wagmi";
import { createLogger } from "@/utils/app/logger";
import {
  createPimlicoClientForChain,
  createPublicClientForChain,
  getChainFromId,
} from "@/modules/pimlico/config";

export type AuthMode = "passkey" | "wallet" | null;

interface AuthContextType {
  // Auth mode
  authMode: AuthMode;

  // Passkey state
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: SmartAccountClient | null;

  // Wallet state
  walletAddress: Hex | null;
  walletConnector: Connector | null;

  // Status flags
  isCreating: boolean;
  isReady: boolean;
  error: Error | null;

  // Passkey actions
  createPasskey: () => Promise<void>;
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

// Storage keys
const PASSKEY_STORAGE_KEY = "greengoods_passkey_credential";
const AUTH_MODE_STORAGE_KEY = "greengoods_auth_mode";

const logger = createLogger("Auth");

interface AuthProviderProps {
  children: React.ReactNode;
  chainId?: number;
}

export function AuthProvider({ children, chainId = DEFAULT_CHAIN_ID }: AuthProviderProps) {
  // Auth mode
  const [authMode, setAuthMode] = useState<AuthMode>(null);

  // Passkey state
  const [credential, setCredential] = useState<P256Credential | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<Hex | null>(null);
  const [smartAccountClient, setSmartAccountClient] = useState<SmartAccountClient | null>(null);

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<Hex | null>(null);
  const [walletConnector, setWalletConnector] = useState<Connector | null>(null);

  // Status
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load saved auth mode and credentials on mount
  useEffect(() => {
    const savedAuthMode = localStorage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode;

    if (savedAuthMode === "passkey") {
      // Load passkey credential
      try {
        const saved = localStorage.getItem(PASSKEY_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setCredential(parsed);
          setAuthMode("passkey");
        }
      } catch (err) {
        logger.error("Failed to load saved credential", err);
      }
    } else if (savedAuthMode === "wallet") {
      // Check for existing wallet connection
      const account = getAccount(wagmiConfig);
      if (account.address) {
        setWalletAddress(account.address as Hex);
        setWalletConnector(account.connector || null);
        setAuthMode("wallet");
      }
    }
  }, []);

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

  // Initialize smart account when credential is available
  useEffect(() => {
    if (!credential) {
      setSmartAccountAddress(null);
      setSmartAccountClient(null);
      return;
    }

    const initializeSmartAccount = async () => {
      try {
        const chain = getChainFromId(chainId);
        const publicClient = createPublicClientForChain(chainId);
        const pimlicoClient = createPimlicoClientForChain(chainId);

        // Create WebAuthn account from credential
        const webAuthnAccount = toWebAuthnAccount({ credential });

        // Create Kernel smart account
        const account = await toKernelSmartAccount({
          client: publicClient,
          version: "0.3.1",
          owners: [webAuthnAccount],
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        });

        setSmartAccountAddress(account.address);

        // Create smart account client with Pimlico
        const client = createSmartAccountClient({
          account,
          chain,
          bundlerTransport: http((pimlicoClient.transport as { url?: string }).url || ""),
          paymaster: pimlicoClient,
          userOperation: {
            estimateFeesPerGas: async () => {
              const gasPrice = await pimlicoClient.getUserOperationGasPrice();
              return gasPrice.fast;
            },
          },
        });

        setSmartAccountClient(client);
      } catch (err) {
        logger.error("Failed to initialize smart account", err);
        setError(err instanceof Error ? err : new Error("Failed to initialize smart account"));
      }
    };

    initializeSmartAccount();
  }, [credential, chainId]);

  const createPasskey = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Create WebAuthn credential
      const newCredential = await createWebAuthnCredential({
        name: "Green Goods Wallet",
      });

      // Save to localStorage (only public data)
      localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(newCredential));
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");

      setCredential(newCredential);
      setAuthMode("passkey");

      logger.log("Passkey created successfully", { credentialId: newCredential.id });
    } catch (err) {
      logger.error("Passkey creation failed", err);
      const error =
        err instanceof Error ? err : new Error("Failed to create passkey. Please try again.");
      setError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const clearPasskey = () => {
    localStorage.removeItem(PASSKEY_STORAGE_KEY);
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setCredential(null);
    setSmartAccountAddress(null);
    setSmartAccountClient(null);
    setAuthMode(null);
    setError(null);
  };

  const connectWallet = async (connector: Connector) => {
    setIsCreating(true);
    setError(null);

    try {
      // Connect without specifying chainId to allow wallet's default network
      const result = await connect(wagmiConfig, { connector });

      setWalletAddress(result.accounts[0] as Hex);
      setWalletConnector(connector);
      setAuthMode("wallet");
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");

      logger.log("Wallet connected", { account: result.accounts[0] });
    } catch (err) {
      logger.error("Wallet connection failed", err);
      const error =
        err instanceof Error ? err : new Error("Failed to connect wallet. Please try again.");
      setError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const disconnectWallet = () => {
    disconnect(wagmiConfig);
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setWalletAddress(null);
    setWalletConnector(null);
    setAuthMode(null);
    setError(null);
  };

  // User is ready when either passkey or wallet is authenticated
  const isReady =
    (authMode === "passkey" && Boolean(credential && smartAccountAddress && smartAccountClient)) ||
    (authMode === "wallet" && Boolean(walletAddress));

  const contextValue: AuthContextType = {
    authMode,
    credential,
    smartAccountAddress,
    smartAccountClient,
    walletAddress,
    walletConnector,
    isCreating,
    isReady,
    error,
    createPasskey,
    clearPasskey,
    connectWallet,
    disconnectWallet,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
