import { afterEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { createGardenJoinRequestSignatureVerifier } from "../services/garden-join-requests-verifier";

const signer = privateKeyToAccount(`0x${"11".repeat(32)}` as `0x${string}`);
const PRIMARY = "https://join-primary.example/";
const contract = "0x2222222222222222222222222222222222222222";
const message = "Disposable join authorization conformance";
const result = (valid: boolean) =>
  Response.json({ jsonrpc: "2.0", id: 1, result: `0x${"0".repeat(63)}${valid ? "1" : "0"}` });
const verifier = (rpcUrl = PRIMARY) =>
  createGardenJoinRequestSignatureVerifier({ chain: arbitrum, rpcUrl });
async function input(address: `0x${string}` = contract) {
  return {
    chainId: arbitrum.id,
    address,
    message,
    signature: await signer.signMessage({ message }),
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("join signature verifier production adapter", () => {
  it("verifies a real EOA signature locally without an RPC", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await verifier()(await input(signer.address as `0x${string}`))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("falls back on a provider outage for contract-account validation", async () => {
    const fetch = vi.fn(async (url: unknown) =>
      String(url) === PRIMARY ? new Response("unavailable", { status: 503 }) : result(true)
    );
    vi.stubGlobal("fetch", fetch);
    expect(await verifier()(await input())).toBe(true);
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      PRIMARY,
      arbitrum.rpcUrls.default.http[0],
    ]);
  });
  it("aborts a stalled verification transport before fallback", async () => {
    const proof = await input();
    vi.useFakeTimers();
    const fetch = vi.fn(async (url: unknown, init?: RequestInit) =>
      String(url) === PRIMARY
        ? new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")))
          )
        : result(true)
    );
    vi.stubGlobal("fetch", fetch);
    const pending = verifier()(proof);
    const assertion = expect(pending).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(1_500);
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("keeps an authoritative invalid signature invalid without fallback", async () => {
    const fetch = vi.fn(async () => result(false));
    vi.stubGlobal("fetch", fetch);
    expect(await verifier()(await input())).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("keeps a validator revert distinct from provider unavailability", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "execution reverted" } })
    );
    vi.stubGlobal("fetch", fetch);
    expect(await verifier()(await input())).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not use live state when a local validator is unavailable", async () => {
    const fetch = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(verifier("http://127.0.0.1:3009")(await input())).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("rejects a different chain without contacting RPC", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await verifier()({ ...(await input()), chainId: 1 })).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
