/**
 * AppKit configuration tests.
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";

const { mockCreateAppKit, mockHttp, mockSetThemeMode, mockWagmiAdapter } = vi.hoisted(() => ({
  mockCreateAppKit: vi.fn(() => ({ setThemeMode: mockSetThemeMode })),
  mockHttp: vi.fn((url: string) => ({ kind: "http", url })),
  mockSetThemeMode: vi.fn(),
  mockWagmiAdapter: vi.fn(function WagmiAdapterMock(
    this: { wagmiConfig: unknown },
    config: unknown
  ) {
    this.wagmiConfig = { kind: "wagmi-config", config };
  }),
}));

vi.mock("viem", () => ({
  http: (url: string) => mockHttp(url),
}));

vi.mock("@reown/appkit/react", () => ({
  createAppKit: (...args: unknown[]) => mockCreateAppKit(...args),
}));

vi.mock("@reown/appkit-adapter-wagmi", () => ({
  WagmiAdapter: mockWagmiAdapter,
}));

vi.mock("../../lib/env", () => ({
  ENV: {
    VITE_ALCHEMY_API_KEY: "",
    VITE_WALLETCONNECT_PROJECT_ID: "env-project",
  },
}));

vi.mock("../../modules/app/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("../../utils/styles/theme", () => ({
  getResolvedTheme: () => "light",
}));

const { createAppKitTransports, ensureAppKit } = await import("../../config/appkit");

describe("AppKit config", () => {
  it("builds explicit HTTP transports for every supported chain", () => {
    const transports = createAppKitTransports();

    expect(transports).toMatchObject({
      42161: { kind: "http", url: "https://arb1.arbitrum.io/rpc" },
      11155111: { kind: "http", url: "https://ethereum-sepolia.publicnode.com" },
      42220: { kind: "http", url: "https://forno.celo.org" },
    });

    const urls = mockHttp.mock.calls.map(([url]) => url);
    expect(urls.join(" ")).not.toContain("rpc.walletconnect.org");
  });

  it("passes explicit transports into the Wagmi adapter", () => {
    const metadata = {
      name: "Green Goods",
      description: "Test metadata",
      url: "https://www.greengoods.app",
      icons: ["https://www.greengoods.app/icon.png"],
    };

    ensureAppKit({
      projectId: "explicit-project",
      metadata,
      defaultChainId: 42161,
    });

    const adapterConfig = mockWagmiAdapter.mock.calls[0]?.[0] as
      | { projectId?: string; transports?: Record<number, unknown> }
      | undefined;

    expect(adapterConfig).toBeDefined();
    expect(adapterConfig?.projectId).toBe("explicit-project");
    expect(adapterConfig?.transports).toMatchObject({
      42161: { kind: "http", url: "https://arb1.arbitrum.io/rpc" },
      11155111: { kind: "http", url: "https://ethereum-sepolia.publicnode.com" },
      42220: { kind: "http", url: "https://forno.celo.org" },
    });
    expect(mockCreateAppKit).toHaveBeenCalledWith(
      expect.objectContaining({
        adapters: [mockWagmiAdapter.mock.instances[0]],
        projectId: "explicit-project",
      })
    );
  });
});
