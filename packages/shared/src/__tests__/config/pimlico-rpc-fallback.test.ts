import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicClientForChain } from "../../config/pimlico";
import { CELO_G_DOLLAR_TOKEN } from "../../config/tokens";
import { ERC20_BALANCE_ABI } from "../../utils/blockchain/abis/erc20";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Celo public reads", () => {
  it("reads G$ from Forno when the configured RPC rejects the request", async () => {
    vi.stubEnv("VITE_ALCHEMY_API_KEY", "unavailable-provider");
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("alchemy.com")) {
        return new Response("provider unavailable", { status: 503 });
      }
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
    expect(requests.some((url) => url.includes("alchemy.com"))).toBe(true);
    expect(requests.some((url) => url.startsWith("https://forno.celo.org"))).toBe(true);
  });
});
