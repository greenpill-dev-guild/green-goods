import { vi } from "vitest";
import React from "react";

export const mockPrivyHooks = {
  // Mock usePrivy hook
  usePrivy: vi.fn(() => ({
    ready: true,
    authenticated: true,
    user: {
      id: "test-user-id",
      wallet: {
        address: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
      },
    },
    login: vi.fn(),
    logout: vi.fn(),
    connectWallet: vi.fn(),
  })),

  // Mock useWallets hook
  useWallets: vi.fn(() => ({
    wallets: [
      {
        address: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
        walletClientType: "privy",
        chainId: "eip155:84532",
        provider: {
          request: vi.fn(),
        },
      },
    ],
  })),
};

// Mock Privy provider
export const MockPrivyProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement("div", { "data-testid": "privy-provider" }, children);
};

// Export mock implementations
export const createMockPrivyUser = (role: "admin" | "operator" | "unauthorized") => {
  const addressMap = {
    admin: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
    operator: "0x04D60647836bcA09c37B379550038BdaaFD82503",
    unauthorized: "0x1234567890123456789012345678901234567890",
  };

  return {
    ready: true,
    authenticated: true,
    user: {
      id: `test-${role}-user`,
      wallet: {
        address: addressMap[role],
      },
    },
    address: addressMap[role],
  };
};
