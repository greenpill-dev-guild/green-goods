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
  // Wallet connection state
  address?: `0x${string}`;
  isConnected: boolean;
  isConnecting: boolean;

  // Actions
  connect: () => void;
  disconnect: () => void;

  // Legacy compatibility (will be replaced with onchain roles)
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

// Legacy hook for compatibility during migration
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

  // Create legacy-compatible user object
  const user = address
    ? {
        id: `user-${address}`,
        wallet: { address: address as string },
      }
    : null;

  const contextValue: WalletAuthContextType = {
    address,
    isConnected,
    isConnecting,
    connect: () => appKit.open(),
    disconnect,
    ready: !isConnecting, // Ready when we've finished checking connection status
    user,
  };

  return <WalletAuthContext.Provider value={contextValue}>{children}</WalletAuthContext.Provider>;
}
