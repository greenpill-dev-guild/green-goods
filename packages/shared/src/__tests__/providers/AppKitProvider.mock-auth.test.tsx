/**
 * A mock-auth session must never sign or broadcast: it borrows a role's address with no key,
 * and a wallet extension in the same tab would otherwise sign for it. Under `?mockAuth=` the
 * provider hands wagmi a config with no connector, so writes fail before reaching a wallet.
 */
import { render } from "@testing-library/react";
import { sendTransaction, signMessage, writeContract } from "@wagmi/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Config, createConfig, http, useConfig } from "wagmi";
import { arbitrum } from "wagmi/chains";

const realConfig = createConfig({ chains: [arbitrum], transports: { [arbitrum.id]: http() } });

vi.mock("../../config/appkit", () => ({
  ensureAppKit: () => ({ appKit: {}, wagmiConfig: realConfig }),
  createAppKitTransports: () => ({ [arbitrum.id]: http() }),
}));

const { AppKitProvider } = await import("../../providers/AppKitProvider");
const { DEV_MOCK_AUTH_STORAGE_KEY } = await import("../../providers/DevAuthProvider");

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

describe("AppKitProvider under mock auth", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => {
    window.sessionStorage.clear();
    setLocation("localhost", "");
  });

  it("keeps the real config without the mock seam", () => {
    setLocation("localhost", "");
    expect(renderedConfig()).toBe(realConfig);
  });

  it("gives wagmi no connector, so writes, sends and signatures all fail", async () => {
    setLocation("localhost", "?mockAuth=steward");
    const config = renderedConfig();
    expect(config).not.toBe(realConfig);
    expect(config.connectors).toHaveLength(0);
    expect(config.chains.map((chain) => chain.id)).toEqual([arbitrum.id]);
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
    // The role persists per tab, so a QA tab that loses `?mockAuth=` stays a mock session.
    window.sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, "deployer");
    setLocation("localhost", "");
    expect(renderedConfig().connectors).toHaveLength(0);
  });

  it("ignores the seam on a non-loopback host, as the auth gate does", () => {
    setLocation("192.168.1.20", "?mockAuth=steward");
    expect(renderedConfig()).toBe(realConfig);
  });
});
