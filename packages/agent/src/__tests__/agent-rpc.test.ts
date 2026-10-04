import { describe, expect, it } from "vitest";
import { resolveAgentRpc, resolveAgentRpcUrl, rpcHost } from "../services/agent-rpc";

/** Which RPC address the Agent reads a chain through, from its environment alone. */
describe("agent RPC address", () => {
  it("uses the chain's own address before anything else", () => {
    expect(
      resolveAgentRpc(42161, {
        ARBITRUM_RPC_URL: "https://rpc.test/arbitrum",
        ALCHEMY_API_KEY: "key",
      })
    ).toEqual({ url: "https://rpc.test/arbitrum", source: "configured" });
    expect(
      resolveAgentRpc(11155111, { VITE_RPC_URL_11155111: "https://rpc.test/sepolia" })
    ).toEqual({ url: "https://rpc.test/sepolia", source: "configured" });
  });

  it("builds the Alchemy address from either name of the key", () => {
    for (const env of [{ ALCHEMY_API_KEY: "key-a" }, { ALCHEMY_KEY: "key-a" }]) {
      expect(resolveAgentRpc(42161, env)).toEqual({
        url: "https://arb-mainnet.g.alchemy.com/v2/key-a",
        source: "alchemy",
      });
    }
  });

  it("reads through the chain's public endpoint, never Alchemy's keyless one, when nothing is set", () => {
    for (const chainId of [1, 10, 42161, 42220, 11155111]) {
      const rpc = resolveAgentRpc(chainId, {});
      expect(rpc.source).toBe("public");
      expect(rpc.url).toMatch(/^https:\/\//);
      expect(rpc.url).not.toContain("alchemy");
    }
    expect(resolveAgentRpcUrl(42161, {})).toBe("https://arb1.arbitrum.io/rpc");
  });

  it("logs an address by its host only, and never fails on a setting that is not an address", () => {
    expect(rpcHost("https://arb-mainnet.g.alchemy.com/v2/provider-key")).toBe(
      "arb-mainnet.g.alchemy.com"
    );
    expect(rpcHost("provider-key")).toBe("not a readable address");
  });

  it("treats an empty setting as unset", () => {
    expect(resolveAgentRpc(42161, { ARBITRUM_RPC_URL: "", ALCHEMY_API_KEY: "" }).source).toBe(
      "public"
    );
  });
});
