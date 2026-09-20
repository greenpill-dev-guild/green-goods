import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicClientForChain } from "../../config/pimlico";
import { CELO_G_DOLLAR_TOKEN } from "../../config/tokens";
import { ERC20_BALANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Celo public reads", () => {
  it("reads G$ from Forno when the configured RPC rejects the request", async () => {
    vi.stubEnv("VITE_ALCHEMY_API_KEY", "unavailable-provider");
    const configuredRpcUrl = new URL(getRpcUrl(42220, "unavailable-provider")).href;
    const publicRpcUrl = new URL(getRpcUrl(42220)).href;
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input)).href;
      requests.push(url);
      if (url === configuredRpcUrl) {
        return new Response("provider unavailable", { status: 503 });
      }
      if (url !== publicRpcUrl) throw new Error("Unexpected RPC endpoint");
      const body = JSON.parse(String(init?.body)) as { id: number };
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: `0x${123n.toString(16).padStart(64, "0")}`,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const balance = await createPublicClientForChain(42220).readContract({
      address: CELO_G_DOLLAR_TOKEN.address,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: ["0x1111111111111111111111111111111111111111"],
    });
    expect(balance).toBe(123n);
    expect(requests).toContain(configuredRpcUrl);
    expect(requests).toContain(publicRpcUrl);
    await expect(fetch("https://forno.celo.org.evil.example")).rejects.toThrow(
      "Unexpected RPC endpoint"
    );
    await expect(fetch("https://evil.example/celo-mainnet.g.alchemy.com")).rejects.toThrow(
      "Unexpected RPC endpoint"
    );
  });
});
