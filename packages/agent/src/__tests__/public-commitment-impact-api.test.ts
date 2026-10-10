import {
  buildPublicCommitmentImpactPath,
  type PublicCommitmentImpactRecord,
} from "@green-goods/shared/public-contracts";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "../api/server";
import { InMemoryPublicRateLimiter } from "../api/public-protection";

const route = buildPublicCommitmentImpactPath(42161);
function record(): PublicCommitmentImpactRecord {
  return {
    commitmentsMade: 27n,
    commitmentsFulfilled: 12n,
    confirmedDisbursementTotal: 8000000000000000000n,
    confirmedDisbursementUsdCents: 1234n,
    partialData: false,
    unavailableSources: {
      commitmentPools: false,
      confirmedSettlement: false,
      fundingValuation: false,
    },
  };
}
function deps(loader = vi.fn(async () => record())) {
  return {
    isAIReady: () => true,
    publicCommitmentImpactLoader: loader,
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    fundingSweepIntervalMs: 0,
    chatMessageSweepIntervalMs: 0,
    gardenJoinRequestSweepIntervalMs: 0,
  };
}

describe("public commitment impact API", () => {
  it("shares an address-free snapshot across origins and serializes large amounts exactly", async () => {
    const loader = vi.fn(async () => record());
    const app = createServer(deps(loader));
    const first = await app.request(route, { headers: { origin: "https://partner.example" } });
    const second = await app.request(route, { headers: { origin: "https://another.example" } });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      version: 1,
      chainId: 42161,
      commitmentsMade: "27",
      commitmentsFulfilled: "12",
      confirmedDisbursementTotal: "8000000000000000000",
      confirmedDisbursementUsdCents: "1234",
      partialData: false,
      unavailableSources: record().unavailableSources,
    });
    expect(second.status).toBe(200);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith(42161);
    expect(first.headers.get("access-control-allow-origin")).toBe("*");
    expect(first.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=300");
  });

  it("coalesces concurrent visitors and retries after a failed load", async () => {
    let resolve: ((value: PublicCommitmentImpactRecord) => void) | undefined;
    const loader = vi
      .fn<() => Promise<PublicCommitmentImpactRecord>>()
      .mockRejectedValueOnce(new Error("private provider details"))
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
    const app = createServer(deps(loader));
    const failed = await app.request(route);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private provider details");
    expect(failed.headers.get("cache-control")).toBe("no-store");
    const first = app.request(route);
    const second = app.request(route);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    resolve?.(record());
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("refreshes complete snapshots after five minutes and keeps chains separate", async () => {
    let now = 0;
    const loader = vi.fn(async () => record());
    const app = createServer({ ...deps(loader), now: () => now });
    await app.request(route);
    now = 299999;
    await app.request(route);
    await app.request(buildPublicCommitmentImpactPath(11155111));
    expect(loader).toHaveBeenCalledTimes(2);
    now = 300000;
    await app.request(route);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it("preserves independent counts during price failure and retries partial snapshots after 30 seconds", async () => {
    let now = 0;
    const loader = vi.fn(async () => ({
      ...record(),
      confirmedDisbursementUsdCents: null,
      partialData: true,
      unavailableSources: { ...record().unavailableSources, fundingValuation: true },
    }));
    const app = createServer({ ...deps(loader), now: () => now });
    const first = await app.request(route);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      commitmentsMade: "27",
      confirmedDisbursementUsdCents: null,
    });
    expect(first.headers.get("cache-control")).toBe("no-store");
    now = 29999;
    await app.request(route);
    expect(loader).toHaveBeenCalledTimes(1);
    now = 30000;
    await app.request(route);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it.each([
    "1",
    "0",
    "-42161",
    "042161",
    "abc",
    "99999999999999999999",
  ])("rejects unsupported chain %s without loading history", async (chainId) => {
    const loader = vi.fn(async () => record());
    const response = await createServer(deps(loader)).request(
      `/public/commitments/${chainId}/impact`
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(loader).not.toHaveBeenCalled();
  });

  it("does not cache or publish contradictory loader values", async () => {
    const loader = vi.fn(async () => ({ ...record(), commitmentsMade: -1n }));
    const app = createServer(deps(loader));
    expect((await app.request(route)).status).toBe(503);
    expect((await app.request(route)).status).toBe(503);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("limits one IP across caller-controlled origins and allows public preflight", async () => {
    const loader = vi.fn(async () => record());
    const app = createServer({ ...deps(loader), trustedProxy: { allowTestSocketIp: true } });
    for (let i = 0; i < 120; i++) {
      expect(
        (
          await app.request(route, {
            headers: {
              origin: `https://partner-${i}.example`,
              "x-gg-test-socket-ip": "198.51.100.10",
            },
          })
        ).status
      ).toBe(200);
    }
    expect(
      (await app.request(route, { headers: { "x-gg-test-socket-ip": "198.51.100.10" } })).status
    ).toBe(429);
    const preflight = await app.request(route, {
      method: "OPTIONS",
      headers: { origin: "https://partner.example" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
