/**
 * ENS Lookup Batching Tests
 *
 * A list of promises names each row's other person, so a long list asks for many ENS names
 * at once. Those reverse lookups go to mainnet as one multicall, not one request per row.
 */

import {
  type Address,
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  type Hex,
  multicall3Abi,
  type PublicClientConfig,
} from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";

const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));

// The real viem client on a transport that records each request. Every lookup's call
// reverts, so each row reads no name, which is what an address without ENS gets.
vi.mock("../../config/pimlico", () => ({
  createPublicClientForChain: (_chainId: number, { batch }: Pick<PublicClientConfig, "batch">) =>
    createPublicClient({
      chain: mainnet,
      batch,
      transport: custom({
        async request({ method, params }: { method: string; params: [{ data: Hex }] }) {
          calls.push(method);
          if (method !== "eth_call") throw new Error(`Unexpected ${method}`);
          const { functionName, args } = decodeFunctionData({
            abi: multicall3Abi,
            data: params[0].data,
          });
          if (functionName !== "aggregate3") throw new Error("Expected one batched call");
          return encodeFunctionResult({
            abi: multicall3Abi,
            functionName: "aggregate3",
            result: args[0].map(() => ({ success: false, returnData: "0x" as Hex })),
          });
        },
      }),
    }),
}));

import { resolveEnsName } from "../../utils/blockchain/ens";

const PEOPLE = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
] as Address[];

describe("ENS name lookups", () => {
  it("read a list's names in one mainnet call", async () => {
    await Promise.allSettled(PEOPLE.map((address) => resolveEnsName(address, { chainId: 1 })));

    expect(calls).toEqual(["eth_call"]);
  });
});
