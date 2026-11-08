import {
  buildPublicGardenImpactPath,
  PUBLIC_AGENT_ROUTES,
  type Address,
  type PublicGardenImpactResponseV1,
} from "@green-goods/shared/public-contracts";
import { Hono } from "hono";
import { getAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, startServer } from "../api/server";
import { InMemoryPublicRateLimiter } from "../api/public-protection";
import {
  PublicGardenImpactCache,
  registerPublicGardenImpactRoutes,
} from "../api/routes/public-garden-impact";

const gardenAddress = getAddress("0x1111111111111111111111111111111111111111") as Address;
const route = buildPublicGardenImpactPath(11155111, gardenAddress);
const fetchedAt = "2026-08-28T12:00:00.000Z";

function snapshot(recentCount = 12): PublicGardenImpactResponseV1 {
  return {
    version: 1,
    ok: true,
    garden: {
      chainId: 11155111,
      address: gardenAddress,
      name: "Sun Garden",
      location: "Lisbon",
      url: `https://agent.greengoods.app${route}`,
    },
    summary: {
      submittedWorkCount: recentCount,
      approvedWorkCount: recentCount,
      assessmentCount: 1,
      impactCertificateCount: 1,
      latestKnownActivityAt: fetchedAt,
    },
    breakdown: { byDomain: [], byAction: [] },
    recentWork: Array.from({ length: recentCount }, (_, index) => ({
      id: `0xwork-${index}`,
      title: `Work ${index}`,
      description: null,
      media: [],
      actionUid: index,
      action: null,
      createdAt: fetchedAt,
      approvedAt: fetchedAt,
    })),
    provenance: {
      status: "ready",
      partialData: false,
      unavailableSources: [],
      fetchedAt,
    },
  };
}

function deps(loader = vi.fn(async () => snapshot())) {
  return {
    isAIReady: () => true,
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    publicGardenImpactChainSupported: (chainId: number) => chainId === 11155111,
    publicGardenImpactLoader: loader,
    fundingSweepIntervalMs: 0,
    chatMessageSweepIntervalMs: 0,
    gardenJoinRequestSweepIntervalMs: 0,
  };
}

describe("public garden impact API", () => {
  it("cancels sibling provider work when a snapshot fails before its deadline", async () => {
    let signal: AbortSignal | undefined;
    const app = createServer({
      ...deps(),
      publicGardenImpactLoader: async (input) => {
        signal = input.signal;
        throw new Error("garden identity read failed");
      },
    });
    expect((await app.request(route)).status).toBe(503);
    expect(signal?.aborted).toBe(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives the HTTP runtime time to return the snapshot deadline response", async () => {
    const serve = vi.fn(() => ({}));
    vi.stubGlobal("Bun", { serve });
    await startServer(createServer(deps()), { port: 0 });
    expect(serve).toHaveBeenCalledWith(expect.objectContaining({ idleTimeout: 30 }));
  });

  it("keeps complete data through failed refreshes without extending its maximum age", async () => {
    let now = 0;
    const cache = new PublicGardenImpactCache({ now: () => now });
    const good = snapshot();
    const load = vi.fn(async () => good);
    await cache.get("a", load);
    now = 300_000;
    load.mockRejectedValue(new Error("provider unavailable"));
    const [stale, coalesced] = await Promise.all([cache.get("a", load), cache.get("a", load)]);
    expect(coalesced).toEqual(stale);
    expect(stale.summary).toEqual(good.summary);
    expect(stale.provenance).toMatchObject({
      stale: true,
      fetchedAt,
      refreshFailedAt: new Date(now).toISOString(),
    });
    now += 1;
    await cache.get("a", load);
    expect(load).toHaveBeenCalledTimes(2);
    now = 3_600_000;
    await expect(cache.get("a", load)).rejects.toThrow("provider unavailable");
  });

  it("does not replace complete data with a partial refresh and recovers on the next retry", async () => {
    let now = 0;
    const cache = new PublicGardenImpactCache({ now: () => now });
    const partial = snapshot();
    partial.summary.approvedWorkCount = null;
    partial.provenance = {
      ...partial.provenance,
      status: "partial",
      partialData: true,
      unavailableSources: ["approvals"],
    };
    const load = vi
      .fn(async () => snapshot())
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(partial);
    await cache.get("a", load);
    now = 300_000;
    expect((await cache.get("a", load)).summary.approvedWorkCount).toBe(12);
    now += 30_000;
    expect((await cache.get("a", load)).provenance.stale).not.toBe(true);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("invalidates retained data when a garden is no longer public", async () => {
    let now = 0;
    const cache = new PublicGardenImpactCache({ now: () => now });
    await cache.get("a", async () => snapshot());
    now = 300_000;
    const missing = Object.assign(new Error("hidden"), { name: "PublicGardenImpactNotFoundError" });
    await expect(
      cache.get("a", async () => {
        throw missing;
      })
    ).rejects.toBe(missing);
    await expect(
      cache.get("a", async () => {
        throw new Error("offline");
      })
    ).rejects.toThrow("offline");
  });

  it("gives cold partial responses a short cache lifetime", async () => {
    let now = 0;
    const partial = snapshot();
    partial.provenance = {
      ...partial.provenance,
      status: "partial",
      partialData: true,
      unavailableSources: ["works"],
    };
    const loader = vi.fn(async () => partial);
    const app = createServer({ ...deps(loader), now: () => now });
    const response = await app.request(route);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=30, must-revalidate"
    );
    now = 30_000;
    await app.request(route);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("returns stale provenance without allowing intermediaries to extend its lifetime", async () => {
    let now = 0;
    const loader = vi.fn(async () => snapshot()).mockResolvedValueOnce(snapshot());
    const app = createServer({ ...deps(loader), now: () => now });
    await app.request(route);
    now = 300_000;
    loader.mockRejectedValue(new Error("offline"));
    const response = await app.request(route);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).provenance).toMatchObject({ fetchedAt, stale: true });
  });

  it("aborts a hung snapshot at twenty seconds and allows a subsequent retry", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const loader = vi.fn(async (input: { signal?: AbortSignal }) => {
      signal = input.signal;
      return new Promise<PublicGardenImpactResponseV1>(() => {});
    });
    const app = createServer({ ...deps(), publicGardenImpactLoader: loader });
    const pending = app.request(route);
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await pending).status).toBe(503);
    expect(signal?.aborted).toBe(true);
    loader.mockResolvedValue(snapshot());
    expect((await app.request(route)).status).toBe(200);
  });
  it("registers the concrete route and slices one canonical cached snapshot", async () => {
    const loader = vi.fn(async () => snapshot());
    const app = createServer(deps(loader));

    const first = await app.request(`${route}?recentLimit=1`, {
      headers: { origin: "https://partner.example" },
    });
    const second = await app.request(`${route}?recentLimit=2`, {
      headers: { origin: "https://another.example" },
    });

    expect(first.status).toBe(200);
    expect((await first.json()).recentWork).toHaveLength(1);
    expect((await second.json()).recentWork).toHaveLength(2);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith({
      chainId: 11155111,
      gardenAddress,
      recentLimit: 12,
      signal: expect.any(AbortSignal),
    });
    expect(first.headers.get("access-control-allow-origin")).toBe("*");
    expect(first.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300, must-revalidate"
    );
  });

  it("handles arbitrary-origin preflight without opening protected routes", async () => {
    const app = createServer({ ...deps(), allowedOrigins: new Set(["https://greengoods.app"]) });
    const preflight = await app.request(PUBLIC_AGENT_ROUTES.gardenImpact, {
      method: "OPTIONS",
      headers: { origin: "https://partner.example" },
    });
    const protectedPreflight = await app.request(PUBLIC_AGENT_ROUTES.subscribe, {
      method: "OPTIONS",
      headers: { origin: "https://partner.example" },
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
    expect(preflight.headers.get("vary")).toBeNull();
    expect(protectedPreflight.status).toBe(403);
  });

  it.each([
    ["/public/gardens/not-a-chain/0x1111111111111111111111111111111111111111/impact", 400],
    ["/public/gardens/1/0x1111111111111111111111111111111111111111/impact", 400],
    ["/public/gardens/11155111/not-an-address/impact", 400],
    [`${route}?recentLimit=0`, 400],
    [`${route}?recentLimit=1&recentLimit=2`, 400],
  ])("rejects invalid input at %s", async (path, status) => {
    const response = await createServer(deps()).request(path, {
      headers: { origin: "https://partner.example" },
    });
    expect(response.status).toBe(status);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).errorCode).toBe("invalid_request");
  });

  it("clamps oversized positive integer limits to twelve", async () => {
    const response = await createServer(deps()).request(`${route}?recentLimit=999999999999999999`);
    expect(response.status).toBe(200);
    expect((await response.json()).recentWork).toHaveLength(12);
  });

  it("maps missing and provider failures to safe public errors", async () => {
    const missingError = new Error("missing");
    missingError.name = "PublicGardenImpactNotFoundError";
    const providerError = new Error("unavailable");
    providerError.name = "PublicGardenImpactProviderError";
    const missing = createServer(deps(vi.fn(async () => Promise.reject(missingError))));
    const failed = createServer(deps(vi.fn(async () => Promise.reject(providerError))));

    const missingResponse = await missing.request(route);
    const failedResponse = await failed.request(route);
    expect(missingResponse.status).toBe(404);
    expect((await missingResponse.json()).errorCode).toBe("not_found");
    expect(failedResponse.status).toBe(503);
    expect((await failedResponse.json()).errorCode).toBe("provider_unavailable");
  });

  it("rate-limits cached reads after 120 requests and skips OPTIONS", async () => {
    const app = createServer(deps());
    for (let index = 0; index < 120; index++) {
      expect((await app.request(route)).status).toBe(200);
    }
    const limited = await app.request(route);
    const preflight = await app.request(PUBLIC_AGENT_ROUTES.gardenImpact, { method: "OPTIONS" });
    expect(limited.status).toBe(429);
    expect((await limited.json()).errorCode).toBe("rate_limited");
    expect(preflight.status).toBe(204);
  });

  it("rate-limits one client IP across caller-controlled origins", async () => {
    const app = createServer({
      ...deps(),
      trustedProxy: { allowTestSocketIp: true },
    });
    for (let index = 0; index < 120; index++) {
      const response = await app.request(route, {
        headers: {
          origin: `https://partner-${index}.example`,
          "x-gg-test-socket-ip": "198.51.100.10",
        },
      });
      expect(response.status).toBe(200);
    }
    const limited = await app.request(route, {
      headers: {
        origin: "https://partner-120.example",
        "x-gg-test-socket-ip": "198.51.100.10",
      },
    });

    expect(limited.status).toBe(429);
    expect((await limited.json()).errorCode).toBe("rate_limited");
  });

  it("coalesces concurrent loads and removes a failed pending entry", async () => {
    let resolveLoad: ((value: PublicGardenImpactResponseV1) => void) | undefined;
    const loader = vi
      .fn<() => Promise<PublicGardenImpactResponseV1>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          })
      );
    const app = createServer(deps(loader));

    expect((await app.request(route)).status).toBe(503);
    const first = app.request(route);
    const second = app.request(route);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    resolveLoad?.(snapshot());
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("expires completed entries after the configured TTL", async () => {
    let now = 0;
    const cache = new PublicGardenImpactCache({ now: () => now, ttlMs: 10, maxEntries: 3 });
    const loadA = vi.fn(async () => snapshot(1));

    await cache.get("a", loadA);
    now = 9;
    await cache.get("a", loadA);
    expect(loadA).toHaveBeenCalledTimes(1);

    now = 10;
    await cache.get("a", loadA);
    expect(loadA).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used completed value", async () => {
    let now = 0;
    const cache = new PublicGardenImpactCache({ now: () => now, ttlMs: 100, maxEntries: 2 });
    const loadA = vi.fn(async () => snapshot(1));
    const loadB = vi.fn(async () => snapshot(2));
    const loadC = vi.fn(async () => snapshot(3));

    await cache.get("a", loadA);
    await cache.get("b", loadB);
    await cache.get("a", loadA);
    await cache.get("c", loadC);
    await cache.get("b", loadB);
    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).toHaveBeenCalledTimes(2);
    expect(loadC).toHaveBeenCalledTimes(1);
  });

  it("can be registered directly as a bounded route module", async () => {
    const app = new Hono();
    registerPublicGardenImpactRoutes(app, { deps: deps() });
    expect((await app.request(route)).status).toBe(200);
  });
});
