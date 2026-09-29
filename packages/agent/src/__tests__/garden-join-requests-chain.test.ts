import { afterEach, describe, expect, it, vi } from "vitest";
import { arbitrum } from "viem/chains";
import { createGardenJoinRequestChainReader } from "../services/garden-join-requests-chain";

const GARDEN = "0x1111111111111111111111111111111111111111";
const PRIMARY = "https://primary.example/";
const PUBLIC = arbitrum.rpcUrls.default.http[0];
const closed = () => Response.json({ jsonrpc: "2.0", id: 1, result: `0x${"0".repeat(64)}` });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("garden join request chain reader", () => {
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
