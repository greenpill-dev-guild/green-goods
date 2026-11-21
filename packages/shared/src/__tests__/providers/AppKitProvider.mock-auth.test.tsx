/**
 * A mock-auth session must never sign or broadcast: it borrows a role's address with no key, and
 * a wallet in the same browser would otherwise sign for it. Under `?mockAuth=` both the provider's
 * config and `getWagmiConfig()`, which the direct work, approval and mint signers read, are one
 * config with no connector, and AppKit reconnects no stored wallet.
 */
import { render } from "@testing-library/react";
import { getWalletClient, sendTransaction, signMessage, writeContract } from "@wagmi/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Config, createConfig, http, useConfig } from "wagmi";
import { arbitrum } from "wagmi/chains";

const { realConfig, appKitOptions } = vi.hoisted(() => ({
  realConfig: { current: null as Config | null },
  appKitOptions: [] as Array<{ enableReconnect?: boolean }>,
}));

vi.mock("@reown/appkit-adapter-wagmi", () => ({
  WagmiAdapter: class {
    get wagmiConfig() {
      return realConfig.current;
    }
  },
}));

vi.mock("@reown/appkit/react", () => ({
  createAppKit: (options: { enableReconnect?: boolean }) => {
    appKitOptions.push(options);
    return { setThemeMode: () => undefined, getUniversalProvider: () => Promise.resolve(null) };
  },
  useAppKit: () => ({ open: () => Promise.resolve() }),
}));

realConfig.current = createConfig({ chains: [arbitrum], transports: { [arbitrum.id]: http() } });

const { AppKitProvider } = await import("../../providers/AppKitProvider");
const { getWagmiConfig } = await import("../../config/appkit");
const { DEV_MOCK_AUTH_STORAGE_KEY } = await import("../../modules/auth/mock-auth-seam");

function setLocation(hostname: string, search: string) {
  Object.assign(window.location as unknown as { hostname: string; search: string }, {
    hostname,
    search,
  });
}

function renderedConfig(): Config {
  let seen: Config | undefined;
  function Capture() {
    seen = useConfig();
    return null;
  }
  render(
    <AppKitProvider
      projectId="test"
      metadata={{ name: "t", description: "t", url: "http://localhost", icons: [] }}
    >
      <Capture />
    </AppKitProvider>
  );
  if (!seen) throw new Error("no wagmi config rendered");
  return seen;
}

const recipient = "0x1234567890123456789012345678901234567890";

describe("wagmi config under mock auth", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => {
    window.sessionStorage.clear();
    setLocation("localhost", "");
  });

  it("keeps the real config without the mock seam", () => {
    setLocation("localhost", "");
    expect(renderedConfig()).toBe(realConfig.current);
    expect(getWagmiConfig()).toBe(realConfig.current);
  });

  it("gives the provider and every getWagmiConfig() caller one config no wallet signs through", async () => {
    setLocation("localhost", "?mockAuth=steward");
    const config = getWagmiConfig();
    expect(config).not.toBe(realConfig.current);
    expect(renderedConfig()).toBe(config);
    expect(config.connectors).toHaveLength(0);
    expect(config.chains.map((chain) => chain.id)).toEqual([arbitrum.id]);
    await expect(getWalletClient(config)).rejects.toThrow(/connector not connected/i);
    await expect(signMessage(config, { message: "hello" })).rejects.toThrow(
      /connector not connected/i
    );
    await expect(sendTransaction(config, { to: recipient, value: 1n })).rejects.toThrow(
      /connector not connected/i
    );
    await expect(
      writeContract(config, {
        address: recipient,
        abi: [
          {
            type: "function",
            name: "ping",
            inputs: [],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "ping",
      })
    ).rejects.toThrow(/connector not connected/i);
  });

  it("still refuses after the param is dropped, while the tab keeps its mock role", () => {
    window.sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, "deployer");
    setLocation("localhost", "");
    expect(getWagmiConfig().connectors).toHaveLength(0);
    expect(renderedConfig().connectors).toHaveLength(0);
  });

  it("ignores the seam on a non-loopback host, as the auth gate does", () => {
    setLocation("192.168.1.20", "?mockAuth=steward");
    expect(getWagmiConfig()).toBe(realConfig.current);
    expect(renderedConfig()).toBe(realConfig.current);
  });
});

describe("AppKit reconnect under mock auth", () => {
  it("is off when AppKit is first created in a mock-auth tab", async () => {
    vi.resetModules();
    appKitOptions.length = 0;
    setLocation("localhost", "?mockAuth=steward");
    const fresh = await import("../../config/appkit");
    fresh.getWagmiConfig();
    expect(appKitOptions.at(-1)?.enableReconnect).toBe(false);
    setLocation("localhost", "");
  });
});
