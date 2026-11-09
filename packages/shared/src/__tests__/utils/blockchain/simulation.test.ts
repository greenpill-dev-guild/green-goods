// TEST-QUALITY: allow-small-test-file - every caller's test mocks simulateTransaction, so only a real wagmi config with the RPC stubbed proves the revert flag Manage Roles trusts before each signature.
import { encodeErrorResult, parseAbi } from "viem";
import { describe, expect, it, vi } from "vitest";
import { simulateTransaction } from "../../../utils/blockchain/simulation";

const { rpc } = vi.hoisted(() => ({
  rpc: { answer: (_id: number): Response => new Response(null, { status: 500 }) },
}));

// The real wagmi and viem path, with only the RPC's answer stubbed.
vi.mock("../../../config/appkit", async () => {
  const { createConfig, http } = await import("@wagmi/core");
  const { arbitrum } = await import("viem/chains");
  const config = createConfig({
    chains: [arbitrum],
    multiInjectedProviderDiscovery: false,
    transports: {
      [arbitrum.id]: http("https://rpc.test", {
        retryCount: 0,
        fetchFn: async (_url, init) => rpc.answer(JSON.parse(String(init?.body)).id),
      }),
    },
  });
  return { getWagmiConfig: () => config };
});

const ABI = parseAbi([
  "function revokeRole(address garden, address account, uint8 role)",
  "error NotAllowed()",
]);

const simulateRemoval = () =>
  simulateTransaction(
    "0x9999999999999999999999999999999999999999",
    ABI,
    "revokeRole",
    ["0x3333333333333333333333333333333333333333", "0x2222222222222222222222222222222222222222", 2],
    "0x1111111111111111111111111111111111111111",
    42161
  );

describe("utils/blockchain/simulation", () => {
  it("marks a failure the contract reverted", async () => {
    rpc.answer = (id) =>
      Response.json({
        jsonrpc: "2.0",
        id,
        error: {
          code: 3,
          message: "execution reverted",
          data: encodeErrorResult({ abi: ABI, errorName: "NotAllowed" }),
        },
      });

    await expect(simulateRemoval()).resolves.toMatchObject({
      success: false,
      error: { reverted: true },
    });
  });

  it("leaves unmarked a failure that never reached the contract, such as an RPC's 503", async () => {
    rpc.answer = () => new Response("Service Unavailable", { status: 503 });

    await expect(simulateRemoval()).resolves.toMatchObject({
      success: false,
      error: { reverted: false },
    });
  });
});
