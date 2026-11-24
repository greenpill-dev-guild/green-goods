import { PUBLIC_AGENT_ROUTES } from "@green-goods/shared/public-contracts";
import { describe, expect, it, vi } from "vitest";
import { InMemoryPublicRateLimiter, PUBLIC_RATE_LIMIT_POLICIES } from "../api/public-protection";
import { createServer } from "../api/server";
import {
  createOpenfortRecovery,
  type OpenfortRecovery,
  readOpenfortRecoveryConfig,
} from "../services/openfort-recovery";

const BETA = "https://beta.greengoods.app";
const CONFIG = {
  publishableKey: "pk_test_publishable",
  shieldPublishableKey: "shield_publishable",
  shieldSecretKey: "shield_secret_value",
  shieldEncryptionShare: "encryption_share_value",
};

type Call = { url: string; init: RequestInit };

/** Openfort's session check and Shield's session mint, answering like the live services. */
function fakeOpenfort(options: { liveToken?: string; shieldStatus?: number } = {}) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const headers = new Headers(init.headers);
    if (url === "https://api.openfort.io/iam/v2/auth/get-session") {
      const live =
        headers.get("authorization") === `Bearer ${options.liveToken ?? "live-token"}` &&
        headers.get("x-project-key") === CONFIG.publishableKey;
      // Openfort answers 200 with a null body for a token it does not accept.
      return Response.json(live ? { session: { id: "ses_1" }, user: { id: "usr_alice" } } : null);
    }
    if (url === "https://shield.openfort.io/project/encryption-session") {
      if (options.shieldStatus) return new Response("refused", { status: options.shieldStatus });
      return Response.json({ session_id: `encryption-session-${calls.length}` });
    }
    return new Response("not found", { status: 404 });
  });
  return {
    calls,
    recovery: createOpenfortRecovery({ ...CONFIG, fetch: fetchImpl as unknown as typeof fetch }),
  };
}

function createApp(openfortRecovery?: OpenfortRecovery) {
  return createServer({
    isAIReady: () => true,
    allowedOrigins: new Set([BETA]),
    publicRateLimiter: new InMemoryPublicRateLimiter(),
    openfortRecovery,
  });
}

function requestSession(
  app: ReturnType<typeof createServer>,
  { origin = BETA, token = "live-token" }: { origin?: string; token?: string | null } = {}
) {
  return app.request(PUBLIC_AGENT_ROUTES.openfortRecoverySession, {
    method: "POST",
    headers: { origin, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
}

describe("Openfort recovery sessions", () => {
  it("mints one session for a live Openfort session without returning any project secret", async () => {
    const { calls, recovery } = fakeOpenfort();
    const response = await requestSession(createApp(recovery));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(BETA);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ ok: true, session: "encryption-session-2" });
    for (const secret of [CONFIG.shieldSecretKey, CONFIG.shieldEncryptionShare]) {
      expect(text).not.toContain(secret);
    }

    const shield = calls.find((call) => call.url.endsWith("/project/encryption-session"));
    const shieldHeaders = new Headers(shield?.init.headers);
    expect(shield?.init.method).toBe("POST");
    expect(shieldHeaders.get("x-api-key")).toBe(CONFIG.shieldPublishableKey);
    expect(shieldHeaders.get("x-api-secret")).toBe(CONFIG.shieldSecretKey);
    expect(JSON.parse(String(shield?.init.body))).toEqual({
      encryption_part: CONFIG.shieldEncryptionShare,
    });
  });

  it("asks Shield for nothing unless Openfort accepts the caller's session", async () => {
    const { calls, recovery } = fakeOpenfort();
    const app = createApp(recovery);

    const missing = await requestSession(app, { token: null });
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ ok: false, errorCode: "session_required" });

    const stale = await requestSession(app, { token: "expired-token" });
    expect(stale.status).toBe(401);
    expect(await stale.json()).toMatchObject({ ok: false, errorCode: "session_invalid" });

    expect(calls.some((call) => new URL(call.url).hostname === "shield.openfort.io")).toBe(false);
  });

  it("refuses an origin it does not serve before asking Openfort", async () => {
    const { calls, recovery } = fakeOpenfort();
    const response = await requestSession(createApp(recovery), {
      origin: "https://elsewhere.example",
    });
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("says recovery is unavailable when it is not configured or Shield refuses", async () => {
    const off = await requestSession(createApp(undefined));
    expect(off.status).toBe(503);
    expect(await off.json()).toMatchObject({ ok: false, errorCode: "provider_unavailable" });

    const { recovery } = fakeOpenfort({ shieldStatus: 500 });
    const refused = await requestSession(createApp(recovery));
    expect(refused.status).toBe(503);
    const text = await refused.text();
    expect(JSON.parse(text)).toMatchObject({ ok: false, errorCode: "provider_unavailable" });
    expect(text).not.toContain(CONFIG.shieldSecretKey);
  });

  it("limits sessions per Openfort account", async () => {
    const { recovery } = fakeOpenfort();
    const app = createApp(recovery);
    const limit = PUBLIC_RATE_LIMIT_POLICIES.openfort_recovery_account.limit;
    for (let i = 0; i < limit; i += 1) {
      expect((await requestSession(app)).status).toBe(200);
    }
    const over = await requestSession(app);
    expect(over.status).toBe(429);
    expect(await over.json()).toMatchObject({ ok: false, errorCode: "rate_limited" });
  });
});

describe("readOpenfortRecoveryConfig", () => {
  it("turns recovery on only with all four values and names what is missing", () => {
    const full = {
      VITE_OPENFORT_PUBLISHABLE_KEY: CONFIG.publishableKey,
      VITE_OPENFORT_SHIELD_PUBLISHABLE_KEY: CONFIG.shieldPublishableKey,
      OPENFORT_SHIELD_SECRET_KEY: CONFIG.shieldSecretKey,
      OPENFORT_SHIELD_ENCRYPTION_SHARE: CONFIG.shieldEncryptionShare,
    };
    expect(readOpenfortRecoveryConfig(full)).toEqual({ config: CONFIG, missing: [] });
    expect(readOpenfortRecoveryConfig({ ...full, OPENFORT_SHIELD_SECRET_KEY: " " })).toEqual({
      missing: ["OPENFORT_SHIELD_SECRET_KEY"],
    });
    expect(readOpenfortRecoveryConfig({}).missing).toHaveLength(4);
  });
});
