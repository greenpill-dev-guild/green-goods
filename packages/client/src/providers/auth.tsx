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
import { type Hex, http } from "viem";
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
  // Auth mode
  authMode: AuthMode;

  // Passkey state
  credential: P256Credential | null;
  smartAccountAddress: Hex | null;
  smartAccountClient: SmartAccountClient | null;

  // Wallet state
  walletAddress: Hex | null;
  walletConnector: Connector | null;

  // Status flags - separate concerns
  isCreating: boolean; // Currently creating passkey/credential
  isAuthenticating: boolean; // Currently in auth flow (passkey creation, wallet connection)
  isReady: boolean; // Provider has finished initialization
  isAuthenticated: boolean; // User has valid credentials AND smart account is ready
  error: Error | null;

  // Passkey actions
  createPasskey: () => Promise<void>;
  clearPasskey: () => void;

  // Wallet actions
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
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load saved auth mode and credentials on mount
  useEffect(() => {
    const savedAuthMode = localStorage.getItem(AUTH_MODE_STORAGE_KEY) as AuthMode;

    if (savedAuthMode === "passkey") {
      // Load passkey credential
      try {
        const saved = localStorage.getItem(PASSKEY_STORAGE_KEY);
        if (saved) {
          const serialized = JSON.parse(saved) as SerializedCredential;
          // Reconstruct P256Credential from serialized public data
          const reconstructed: P256Credential = {
            id: serialized.id,
            publicKey: serialized.publicKey as Hex,
            raw: serialized.raw as any, // Raw authenticator data
          };
          setCredential(reconstructed);
          setAuthMode("passkey");
          console.log("Restored passkey from storage", { credentialId: serialized.id });
        }
      } catch (err) {
        console.error("Failed to load saved credential", err);
        // Clear corrupted data
        localStorage.removeItem(PASSKEY_STORAGE_KEY);
        localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
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

    // Mark as initialized after checking localStorage
    setIsInitialized(true);
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
        console.log("Starting smart account initialization", {
          credentialId: credential.id,
          chainId,
        });

        // Step 1: Get chain and clients
        console.log("Setting up blockchain clients");
        const chain = getChainFromId(chainId);
        const publicClient = createPublicClientForChain(chainId);
        const pimlicoClient = createPimlicoClientForChain(chainId);

        console.log("Blockchain clients ready", {
          chainName: chain.name,
          pimlicoEndpoint: (pimlicoClient.transport as { url?: string }).url,
        });

        // Step 2: Create WebAuthn account from credential
        console.log("Creating WebAuthn account from credential");
        const webAuthnAccount = toWebAuthnAccount({ credential });
        console.log("WebAuthn account created", {
          accountType: webAuthnAccount.type,
        });

        // Step 3: Create Kernel smart account
        console.log("Initializing Kernel smart account", {
          version: "0.3.1",
          entryPointVersion: "0.7",
          ownersCount: 1,
        });

        const account = await toKernelSmartAccount({
          client: publicClient,
          version: "0.3.1",
          owners: [webAuthnAccount],
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        });

        console.log("Kernel smart account created", {
          smartAccountAddress: account.address,
          accountType: account.type,
        });

        setSmartAccountAddress(account.address);

        // Step 4: Create smart account client with Pimlico bundler
        console.log("Setting up Pimlico smart account client", {
          bundlerUrl: (pimlicoClient.transport as { url?: string }).url,
        });

        const client = createSmartAccountClient({
          account,
          chain,
          bundlerTransport: http((pimlicoClient.transport as { url?: string }).url || ""),
          paymaster: pimlicoClient,
          userOperation: {
            estimateFeesPerGas: async () => {
              console.log("Estimating gas prices with Pimlico");
              const gasPrice = await pimlicoClient.getUserOperationGasPrice();
              console.log("Gas prices estimated", {
                slow: gasPrice.slow,
                standard: gasPrice.standard,
                fast: gasPrice.fast,
              });
              return gasPrice.fast;
            },
          },
        });

        console.log("Pimlico smart account client created", {
          smartAccountAddress: account.address,
          bundlerUrl: (pimlicoClient.transport as { url?: string }).url,
        });

        setSmartAccountClient(client);
        setAuthMode("passkey"); // Only set when smart account is fully ready
        setIsAuthenticating(false); // Authentication flow complete

        console.log("Smart account initialization completed successfully", {
          smartAccountAddress: account.address,
          credentialId: credential.id,
        });
      } catch (err) {
        console.error("Smart account initialization failed", {
          error: err,
          credentialId: credential.id,
          chainId,
        });
        setError(err instanceof Error ? err : new Error("Failed to initialize smart account"));
      }
    };

    initializeSmartAccount();
  }, [credential, chainId]);

  /**
   * Create a new passkey credential using WebAuthn.
   *
   * Process:
   * 1. Prompts user for biometric authentication (Face ID, Touch ID, Windows Hello, etc.)
   * 2. Generates P256 key pair (private key stays in device's secure enclave)
   * 3. Saves public credential data to localStorage
   * 4. Smart account initialization happens automatically via useEffect
   *
   * Security:
   * - Private key never leaves the device
   * - Only public credential data is persisted (id, publicKey, type)
   * - WebAuthn standard ensures phishing resistance
   *
   * @throws If WebAuthn is not supported or user cancels
   */
  const createPasskey = useCallback(async () => {
    setIsAuthenticating(true);
    setIsCreating(true);
    setError(null);

    try {
      // Create WebAuthn credential
      const newCredential = await createWebAuthnCredential({
        name: "Green Goods Wallet",
      });

      // Serialize only public data for storage
      const serialized: SerializedCredential = {
        id: newCredential.id,
        publicKey: newCredential.publicKey,
        raw: newCredential.raw as any, // Raw authenticator data needed for verification
      };

      // Save to localStorage (only public data)
      localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(serialized));
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
      // Note: userOnboarded flag will be set after successful garden join in Login component

      setCredential(newCredential);
      // Don't set auth mode here - let the useEffect handle it after smart account is ready

      console.log("Passkey created successfully", { credentialId: newCredential.id });
    } catch (err) {
      console.error("Passkey creation failed", err);
      const error =
        err instanceof Error ? err : new Error("Failed to create passkey. Please try again.");
      setError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, []);

  /**
   * Clear passkey credential and reset auth state.
   * Used for logout or account reset.
   */
  const clearPasskey = useCallback(() => {
    localStorage.removeItem(PASSKEY_STORAGE_KEY);
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setCredential(null);
    setSmartAccountAddress(null);
    setSmartAccountClient(null);
    setAuthMode(null);
    setError(null);
    console.log("Passkey cleared");
  }, []);

  /**
   * Connect a traditional wallet (MetaMask, WalletConnect, Coinbase Wallet, etc.)
   *
   * Used primarily by operators and admins who prefer traditional wallet management.
   * Does NOT create a smart account - uses EOA directly.
   *
   * @throws If connection fails or user rejects
   */
  const connectWallet = useCallback(async (connector: Connector) => {
    setIsAuthenticating(true);
    setIsCreating(true);
    setError(null);

    try {
      // Connect without specifying chainId to allow wallet's default network
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
      setIsCreating(false);
    }
  }, []);

  /**
   * Disconnect traditional wallet and reset auth state.
   */
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
      isCreating,
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
      isCreating,
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
