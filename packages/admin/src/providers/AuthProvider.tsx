import React, { createContext, useContext } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Legacy hook for compatibility during migration
export function useUser() {
  const { address, ready, user } = useAuth();
  return {
    address,
    ready,
    user,
    eoa: user ? { address: address as string } : null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

  // Create legacy-compatible user object
  const user = address
    ? {
        id: `user-${address}`,
        wallet: { address: address as string },
      }
    : null;

  const contextValue: AuthContextType = {
    address,
    isConnected,
    isConnecting,
    connect: open,
    disconnect,
    ready: !isConnecting, // Ready when we've finished checking connection status
    user,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
