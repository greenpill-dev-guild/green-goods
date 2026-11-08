import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { VOUCHER_AWARDS_ROUTE } from "@green-goods/shared/public-contracts";
import { registerVoucherAwardRoutes } from "../api/routes/voucher-awards";
import { InMemoryPublicRateLimiter } from "../api/public-protection";
import { VoucherAwardError } from "../services/voucher-awards";
import { VoucherAwardStoreConflict } from "../services/db/voucher-awards";

function fixture() {
  const service = {
    request: vi.fn(async () => ({ ok: true as const, records: [], limit: 200 as const })),
  };
  const app = new Hono();
  registerVoucherAwardRoutes(app, {
    deps: {
      isAIReady: () => true,
      voucherAwards: service,
      allowedOrigins: new Set(["https://greengoods.app"]),
      publicRateLimiter: new InMemoryPublicRateLimiter(),
    },
    auth: async (_, next) => next(),
  });
  const request = (origin = "https://greengoods.app", body = "{}") =>
    app.request(VOUCHER_AWARDS_ROUTE, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body,
    });
  return { service, request };
}
describe("award HTTP boundary", () => {
  it("rejects disallowed origins and malformed or oversized input before the service", async () => {
    const f = fixture();
    expect((await f.request("https://other.example")).status).toBe(403);
    expect((await f.request(undefined, "{")).status).toBe(400);
    expect((await f.request(undefined, JSON.stringify({ data: "a".repeat(25_000) }))).status).toBe(
      413
    );
    expect(f.service.request).not.toHaveBeenCalled();
  });
  it.each([
    ["invalid_request", 400],
    ["signature_invalid", 401],
    ["not_authorized", 403],
    ["not_found", 404],
  ] as const)("preserves the domain %s status without private details", async (code, status) => {
    const f = fixture();
    f.service.request.mockRejectedValue(new VoucherAwardError(code, status));
    const response = await f.request();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ ok: false, errorCode: code });
  });
  it("returns a conflict for a competing durable claim and unavailable for an RPC outage", async () => {
    const f = fixture();
    f.service.request.mockRejectedValueOnce(new VoucherAwardStoreConflict("safe_nonce_claimed"));
    expect((await f.request()).status).toBe(409);
    f.service.request.mockRejectedValue(new Error("private provider details"));
    const response = await f.request();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider");
  });
  it("rate limits authenticated command attempts and never caches private receipts", async () => {
    const f = fixture();
    const first = await f.request();
    expect(first.headers.get("cache-control")).toContain("no-store");
    for (let i = 0; i < 59; i++) await f.request();
    expect((await f.request()).status).toBe(429);
    expect(f.service.request).toHaveBeenCalledTimes(60);
  });
});
