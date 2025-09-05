// Re-export all mocks for easy import
import React from "react";
export * from "./privy";
export * from "./viem";
export * from "./server";

// Mock @privy-io/react-auth
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
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
  }),
  useWallets: () => ({
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
  }),
  PrivyProvider: ({ children }: { children: React.ReactNode }) => 
    React.createElement("div", { "data-testid": "privy-provider" }, children),
}));

// Mock react-router-dom for navigation testing
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({
      pathname: "/dashboard",
      search: "",
      hash: "",
    }),
  };
});
