import { afterEach, describe, expect, it, vi } from "vitest";
import { arbitrum } from "viem/chains";
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionResult,
  multicall3Abi,
  toFunctionSelector,
} from "viem";
import { createGardenJoinRequestChainReader } from "../services/garden-join-requests-chain";

const GARDEN = "0x1111111111111111111111111111111111111111";
const ACCOUNT = "0x2222222222222222222222222222222222222222";
const PRIMARY = "https://primary.example/";
const PUBLIC = arbitrum.rpcUrls.default.http[0];
const closed = () => Response.json({ jsonrpc: "2.0", id: 1, result: `0x${"0".repeat(64)}` });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("garden join request chain reader", () => {
  it.each([
    ["gardener", "isGardener(address)", false],
    ["operator", "isOperator(address)", true],
    ["owner", "isOwner(address)", true],
  ] as const)("only treats the %s role as stewardship when it carries authority", async (_role, activeFunction, expected) => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as {
          id: number;
          params: [{ data: string }];
        };
        const selector = request.params[0].data.slice(0, 10);
        calls.push(selector);
        return Response.json({
          jsonrpc: "2.0",
          id: request.id,
          result: `0x${"0".repeat(63)}${selector === toFunctionSelector(activeFunction) ? "1" : "0"}`,
        });
      })
    );
    const reader = createGardenJoinRequestChainReader({
      chain: arbitrum,
      rpcUrl: "http://127.0.0.1:3009",
    });
    expect(await reader.isSteward(GARDEN, ACCOUNT)).toBe(expected);
    expect(calls.sort()).toEqual(
      [toFunctionSelector("isOperator(address)"), toFunctionSelector("isOwner(address)")].sort()
    );
  });

  it("batches strict steward checks without treating gardeners as authorized", async () => {
    const operator = "0x3333333333333333333333333333333333333333" as const;
    const owner = "0x4444444444444444444444444444444444444444" as const;
    const selectors: string[] = [];
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        id: number;
        params: [{ data: `0x${string}` }];
      };
      const decoded = decodeFunctionData({ abi: multicall3Abi, data: request.params[0].data });
      if (decoded.functionName !== "aggregate3") throw new Error("Expected batched role reads");
      const results = decoded.args[0].map(({ callData }) => {
        const selector = callData.slice(0, 10);
        selectors.push(selector);
        const account = `0x${callData.slice(-40)}`;
        const authorized =
          (account === operator && selector === toFunctionSelector("isOperator(address)")) ||
          (account === owner && selector === toFunctionSelector("isOwner(address)"));
        return { success: true, returnData: encodeAbiParameters([{ type: "bool" }], [authorized]) };
      });
      return Response.json({
        jsonrpc: "2.0",
        id: request.id,
        result: encodeFunctionResult({
          abi: multicall3Abi,
          functionName: "aggregate3",
          result: results,
        }),
      });
    });
    vi.stubGlobal("fetch", fetch);
    const reader = createGardenJoinRequestChainReader({
      chain: arbitrum,
      rpcUrl: "http://127.0.0.1:3009",
    });
    expect(await reader.areStewards!(GARDEN, [ACCOUNT, operator, owner])).toEqual([
      false,
      true,
      true,
    ]);
    expect(selectors).toHaveLength(6);
    expect(selectors).not.toContain(toFunctionSelector("isGardener(address)"));
    expect(fetch).toHaveBeenCalledOnce();
    expect(await reader.areStewards!(GARDEN, [])).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("bounds a stalled provider before reading from the public RPC", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (url: unknown, init?: RequestInit) =>
      String(url) === PRIMARY
        ? new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
          })
        : closed()
    );
    vi.stubGlobal("fetch", fetch);
    const read = createGardenJoinRequestChainReader({
      chain: arbitrum,
      rpcUrl: PRIMARY,
    }).isOpenJoining(GARDEN);
    const result = expect(read).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    await result;
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([PRIMARY, PUBLIC]);
  });
  it.each([
    429, 503,
  ])("uses the chain's public RPC when the configured provider returns %s", async (status) => {
    const fetch = vi.fn(async (url: unknown) =>
      String(url) === PRIMARY ? new Response("Unavailable", { status }) : closed()
    );
    vi.stubGlobal("fetch", fetch);
    const reader = createGardenJoinRequestChainReader({ chain: arbitrum, rpcUrl: PRIMARY });
    expect(await reader.isOpenJoining(GARDEN)).toBe(false);
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([PRIMARY, PUBLIC]);
  });

  it("keeps a successful primary result authoritative", async () => {
    const fetch = vi.fn(async (_url: unknown) =>
      Response.json({ jsonrpc: "2.0", id: 1, result: `0x${"0".repeat(63)}1` })
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await createGardenJoinRequestChainReader({ chain: arbitrum, rpcUrl: PRIMARY }).isOpenJoining(
        GARDEN
      )
    ).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not turn a contract rejection into permission to join", async () => {
    const fetch = vi.fn(async (_url: unknown) =>
      Response.json({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "execution reverted" } })
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      createGardenJoinRequestChainReader({ chain: arbitrum, rpcUrl: PRIMARY }).isOpenJoining(GARDEN)
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("fails closed after both providers fail", async () => {
    const fetch = vi.fn(async (_url: unknown) => new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      createGardenJoinRequestChainReader({ chain: arbitrum, rpcUrl: PRIMARY }).isOpenJoining(GARDEN)
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not send a local fork read to the public chain", async () => {
    const fetch = vi.fn(async (_url: unknown) => new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      createGardenJoinRequestChainReader({
        chain: arbitrum,
        rpcUrl: "http://127.0.0.1:3009",
      }).isOpenJoining(GARDEN)
    ).rejects.toThrow();
    expect(fetch.mock.calls.every(([url]) => String(url) === "http://127.0.0.1:3009/")).toBe(true);
  });
});
