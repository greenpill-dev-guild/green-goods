// TEST-QUALITY: allow-small-test-file - It needs the real viem client on a recording transport, while ens.test.ts replaces the client factory with stubs for the whole file.
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
  encodeErrorResult,
  encodeFunctionResult,
  type Hex,
  multicall3Abi,
  type PublicClientConfig,
} from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";

const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));

// The real viem client on a transport that records each request. Every lookup's call
// reverts with the universal resolver's ResolverNotFound, which viem reads as no name: what
// an address without ENS gets.
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
          const noName = encodeErrorResult({
            abi: [
              {
                type: "error",
                name: "ResolverNotFound",
                inputs: [{ name: "name", type: "bytes" }],
              },
            ],
            errorName: "ResolverNotFound",
            args: ["0x"],
          });
          return encodeFunctionResult({
            abi: multicall3Abi,
            functionName: "aggregate3",
            result: args[0].map(() => ({ success: false, returnData: noName })),
          });
        },
      }),
    }),
}));

import { resolveEnsName } from "../../utils/blockchain/ens";

// The review's pool: 80 people, about 38KB of reverse reads, far past viem's 1KB default batch.
const PEOPLE = Array.from(
  { length: 80 },
  (_, index) => `0x${(index + 1).toString(16).padStart(40, "0")}` as Address
);

describe("ENS name lookups", () => {
  it("read a list's names in one mainnet call, each row still getting its own answer", async () => {
    const names = await Promise.all(
      PEOPLE.map((address) => resolveEnsName(address, { chainId: 1 }))
    );

    expect(names).toEqual(PEOPLE.map(() => null));
    expect(calls).toEqual(["eth_call"]);
  });
});
