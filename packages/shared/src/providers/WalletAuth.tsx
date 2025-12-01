/**
 * Wallet Auth Provider
 *
 * Simple wallet-only authentication for admin package.
 * Uses AppKit for wallet connection UI.
 */

import React, { createContext, useContext, useEffect, useRef } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { appKit } from "../config/appkit";
import { isFreshAppStart, markSessionActive } from "../modules/auth/session";

interface WalletAuthContextType {
  // Unified auth interface properties
  authMode: "wallet" | null;
  eoaAddress: `0x${string}` | undefined;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;

  // Wallet connection state (legacy aliases)
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
  const freshStartChecked = useRef(false);
  const shouldDisconnectOnConnect = useRef(false);

  // Handle fresh start detection - disconnect wallet on reinstall
  // This needs to handle the case where wagmi reconnects after the initial render
  useEffect(() => {
    // Check for fresh start only once
    if (!freshStartChecked.current) {
      freshStartChecked.current = true;
      if (isFreshAppStart()) {
        // Mark session as active and flag for disconnect
        markSessionActive();
        shouldDisconnectOnConnect.current = true;
      }
    }

    // Disconnect if we detected fresh start and wallet is now connected
    if (shouldDisconnectOnConnect.current && isConnected) {
      console.log("[Auth] Detected fresh app start - disconnecting wallet");
      shouldDisconnectOnConnect.current = false; // Only disconnect once
      disconnect();
    }
  }, [isConnected, disconnect]);

  // Create legacy-compatible user object
  const user = address
    ? {
        id: `user-${address}`,
        wallet: { address: address as string },
      }
    : null;

  const isReady = !isConnecting;
  const isAuthenticated = isConnected && Boolean(address);

  const contextValue: WalletAuthContextType = {
    // Unified auth interface
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
