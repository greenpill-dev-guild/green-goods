import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { enrichEventProperties } from "../../../modules/app/posthog";
import { setTelemetryAccount } from "../../../modules/app/telemetry-context";

const TEST_ACCOUNT = "0x00000000000000000000000000000000000000Aa";
const REAL_ACCOUNT = "0x00000000000000000000000000000000000000bb";
const TEST_GARDEN = "0x00000000000000000000000000000000000000cc";
const REAL_GARDEN = "0x00000000000000000000000000000000000000dd";

// What the build hands the bundle: gardens as addresses, accounts as digests of the lowercase
// address (scripts/lib/telemetry-build.mjs).
function stubBuild(surface: "app" | "admin", records: { accounts?: string[]; gardens?: string[] }) {
  vi.stubEnv("VITE_APP_SURFACE", surface);
  vi.stubEnv("VITE_SENTRY_ENVIRONMENT", "production");
  vi.stubEnv("VITE_TELEMETRY_RELEASE", `green-goods-${surface}@3ee6594ef3e5`);
  vi.stubEnv("VITE_TELEMETRY_TEST_GARDENS", (records.gardens ?? []).join(","));
  vi.stubEnv(
    "VITE_TELEMETRY_TEST_ACCOUNT_DIGESTS",
    (records.accounts ?? [])
      .map((account) => createHash("sha256").update(account.toLowerCase()).digest("hex"))
      .join(",")
  );
}

// A tester in a real garden, a gardener in a test garden, a real gardener, a visitor who is not
// signed in, and a signed-in event that names no garden.
const FIXTURES = [
  { account: TEST_ACCOUNT, properties: { gardenAddress: REAL_GARDEN } },
  { account: REAL_ACCOUNT, properties: { garden_address: TEST_GARDEN } },
  { account: REAL_ACCOUNT, properties: { gardenId: REAL_GARDEN } },
  { account: null, properties: { gardenAddress: REAL_GARDEN } },
  { account: REAL_ACCOUNT, properties: {} },
];

async function enrichFixtures() {
  const events = [];
  for (const fixture of FIXTURES) {
    await setTelemetryAccount(fixture.account);
    events.push(enrichEventProperties("work_submission_started", fixture.properties));
  }
  return events;
}

// The shared test setup stubs `crypto`; the digest check needs the real Web Crypto browsers have.
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await setTelemetryAccount(null);
  vi.unstubAllGlobals();
});

describe("telemetry segmentation on App and Hub events", () => {
  it.each([
    "app",
    "admin",
  ] as const)("%s events say where they came from and separate our own traffic", async (surface) => {
    stubBuild(surface, { accounts: [TEST_ACCOUNT], gardens: [TEST_GARDEN] });

    const events = await enrichFixtures();

    expect(events[0]).toMatchObject({
      environment: "production",
      app_surface: surface,
      release: `green-goods-${surface}@3ee6594ef3e5`,
    });
    expect(events.map((event) => [event.is_test_account, event.is_test_garden])).toEqual([
      [true, false],
      [false, true],
      [false, false],
      ["unknown", false],
      [false, "unknown"],
    ]);
    // Raw 5; a dashboard of real people drops what is marked a test and keeps unknown visible.
    const real = events.filter(
      (event) => event.is_test_account !== true && event.is_test_garden !== true
    );
    expect(real).toHaveLength(3);
    // The bundle never holds the test account itself.
    expect(JSON.stringify(import.meta.env.VITE_TELEMETRY_TEST_ACCOUNT_DIGESTS)).not.toContain(
      TEST_ACCOUNT.slice(2).toLowerCase()
    );
  });

  it("says unknown, not false, when the deployment lists no test traffic", async () => {
    stubBuild("app", {});

    const events = await enrichFixtures();

    expect(new Set(events.map((event) => event.is_test_account))).toEqual(new Set(["unknown"]));
    expect(new Set(events.map((event) => event.is_test_garden))).toEqual(new Set(["unknown"]));
  });

  it("reads unknown surface, environment and release outside an App or Hub build", () => {
    expect(enrichEventProperties("page_view")).toMatchObject({
      environment: "unknown",
      app_surface: "unknown",
      release: "unknown",
    });
  });

  it("keeps the flag of the latest sign-in when an earlier check finishes after it", async () => {
    stubBuild("app", { accounts: [TEST_ACCOUNT] });

    const earlier = setTelemetryAccount(TEST_ACCOUNT);
    const later = setTelemetryAccount(REAL_ACCOUNT);
    await Promise.all([earlier, later]);

    expect(enrichEventProperties("page_view").is_test_account).toBe(false);
  });
});
