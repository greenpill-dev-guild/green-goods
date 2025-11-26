/**
 * Wallet Auth Provider
 *
 * Simple wallet-only authentication for admin package.
 * Uses AppKit for wallet connection UI.
 */

import React, { createContext, useContext, useEffect, useRef } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { appKit } from "../config/appkit";

// Session marker to detect reinstalls - sessionStorage clears when app is fully closed
const SESSION_MARKER_KEY = "greengoods_active_session";

/**
 * Check if this is a fresh app start (after reinstall or cold launch).
 * If detected, returns true to indicate wallet should be disconnected.
 */
function checkFreshAppStart(): boolean {
  const hasActiveSession = sessionStorage.getItem(SESSION_MARKER_KEY) === "true";

  if (!hasActiveSession) {
    // Set the marker for this session
    sessionStorage.setItem(SESSION_MARKER_KEY, "true");
    return true; // This is a fresh start
  }

  return false;
}

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
  const freshStartChecked = useRef(false);
  const shouldDisconnectOnConnect = useRef(false);

  // Handle fresh start detection - disconnect wallet on reinstall
  // This needs to handle the case where wagmi reconnects after the initial render
  useEffect(() => {
    // Check for fresh start only once
    if (!freshStartChecked.current) {
      freshStartChecked.current = true;
      const isFreshStart = checkFreshAppStart();
      if (isFreshStart) {
        // Mark that we should disconnect when/if connection is established
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
