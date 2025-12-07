/**
 * Wallet Auth Provider
 *
 * Simple wallet-only authentication for admin package.
 * Uses AppKit for wallet connection UI.
 */

import React, { createContext, useContext } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { appKit } from "../config/appkit";

interface WalletAuthContextType {
  // State
  authMode: "wallet" | null;
  eoaAddress: `0x${string}` | undefined;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;

  // Legacy aliases
  address?: `0x${string}`;
  isConnected: boolean;
  isConnecting: boolean;

  // Actions
  connect: () => void;
  disconnect: () => void;

  // Legacy compatibility
  ready: boolean;
  user: { id: string; wallet: { address: string } } | null;
}

const WalletAuthContext = createContext<WalletAuthContextType | undefined>(undefined);

export function useWalletAuth(): WalletAuthContextType {
  const context = useContext(WalletAuthContext);
  if (!context) {
    throw new Error("useWalletAuth must be used within WalletAuthProvider");
  }
  return context;
}

export function useOptionalWalletAuth(): WalletAuthContextType | undefined {
  return useContext(WalletAuthContext);
}

// Legacy hook for compatibility
export function useUser() {
  const { address, ready, user } = useWalletAuth();
  return {
    address,
    ready,
    user,
    eoa: user ? { address: address as string } : null,
  };
}

export function WalletAuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();

  const isReady = !isConnecting;
  const isAuthenticated = isConnected && Boolean(address);

  // Legacy user object
  const user = address
    ? {
        id: `user-${address}`,
        wallet: { address: address as string },
      }
    : null;

  const contextValue: WalletAuthContextType = {
    // State
    authMode: isAuthenticated ? "wallet" : null,
    eoaAddress: address,
    isReady,
    isAuthenticated,
    isAuthenticating: isConnecting,

    // Legacy aliases
    address,
    isConnected,
    isConnecting,
    connect: () => appKit.open(),
    disconnect,
    ready: isReady,
    user,
  };

  return <WalletAuthContext.Provider value={contextValue}>{children}</WalletAuthContext.Provider>;
}
