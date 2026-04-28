import { describe, expect, it } from "vitest";

import { getRpcUrl } from "../../../utils/blockchain/chain-registry";

describe("getRpcUrl", () => {
  it("uses Alchemy templates when a real provider key is configured", () => {
    expect(getRpcUrl(1, "real-key")).toBe("https://eth-mainnet.g.alchemy.com/v2/real-key");
    expect(getRpcUrl(11155111, "real-key")).toBe("https://eth-sepolia.g.alchemy.com/v2/real-key");
    expect(getRpcUrl(42161, "real-key")).toBe("https://arb-mainnet.g.alchemy.com/v2/real-key");
    expect(getRpcUrl(42220, "real-key")).toBe("https://celo-mainnet.g.alchemy.com/v2/real-key");
  });

  it("uses public fallbacks when the provider key is missing or demo-only", () => {
    expect(getRpcUrl(1)).toBe("https://ethereum-rpc.publicnode.com");
    expect(getRpcUrl(1, "")).toBe("https://ethereum-rpc.publicnode.com");
    expect(getRpcUrl(1, "demo")).toBe("https://ethereum-rpc.publicnode.com");
    expect(getRpcUrl(11155111)).toBe("https://ethereum-sepolia.publicnode.com");
    expect(getRpcUrl(42161)).toBe("https://arb1.arbitrum.io/rpc");
  });

  it("uses public fallbacks for chains with non-Alchemy public RPCs", () => {
    expect(getRpcUrl(42220)).toBe("https://forno.celo.org");
  });

  it("keeps localhost on the local RPC URL", () => {
    expect(getRpcUrl(31337)).toBe("http://localhost:8545");
    expect(getRpcUrl(31337, "demo")).toBe("http://localhost:8545");
  });

  it("falls back unknown chains to Sepolia public RPC without a provider key", () => {
    expect(getRpcUrl(999999)).toBe("https://ethereum-sepolia.publicnode.com");
  });
});
