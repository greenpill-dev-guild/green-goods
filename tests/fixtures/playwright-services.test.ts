import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REPORTING_DRIVER_PORT,
  REPORTING_DRIVER_URL,
  resolvePlaywrightApps,
  selectedProjectNames,
  shouldUsePlaywrightIndexer,
} from "./playwright-services";

describe("Playwright service selection", () => {
  it("parses repeated and inline project flags", () => {
    expect(
      selectedProjectNames([
        "node",
        "playwright",
        "test",
        "--project=client-ci",
        "--project",
        "admin-ci",
      ])
    ).toEqual(["client-ci", "admin-ci"]);
  });

  it("starts only the app required by an exact project selection", () => {
    expect(resolvePlaywrightApps({ argv: ["--project=client-ci"] })).toEqual({
      admin: false,
      client: true,
    });
    expect(resolvePlaywrightApps({ argv: ["--project", "admin-ci"] })).toEqual({
      admin: true,
      client: false,
    });
  });

  it("unions multi-project app requirements", () => {
    expect(resolvePlaywrightApps({ argv: ["--project=client-ci", "--project=admin-ci"] })).toEqual({
      admin: true,
      client: true,
    });
    expect(resolvePlaywrightApps({ argv: ["--project=critical-path"] })).toEqual({
      admin: true,
      client: true,
    });
  });

  it("uses PLAYWRIGHT_APP only without CLI projects and keeps unknown selectors safe", () => {
    expect(resolvePlaywrightApps({ argv: [], playwrightApp: "client" })).toEqual({
      admin: false,
      client: true,
    });
    expect(
      resolvePlaywrightApps({
        argv: ["--project=client-*"],
        playwrightApp: "client",
      })
    ).toEqual({ admin: true, client: true });
  });

  it("keeps the indexer explicit in CI and honors skip overrides", () => {
    expect(shouldUsePlaywrightIndexer({ CI: "true" })).toBe(false);
    expect(shouldUsePlaywrightIndexer({ CI: "true", REQUIRE_INDEXER: "true" })).toBe(true);
    expect(
      shouldUsePlaywrightIndexer({
        CI: "true",
        REQUIRE_INDEXER: "true",
        SKIP_INDEXER: "true",
      })
    ).toBe(false);
    expect(shouldUsePlaywrightIndexer({})).toBe(true);
  });
});

// The config is executable: inspect the resolved servers, not its source text.
describe("Playwright test server ownership", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    "true",
    "false",
  ])("pins the test profile with CI=%s and refuses external servers", async (ci) => {
    vi.stubEnv("CI", ci);
    vi.stubEnv("PLAYWRIGHT_APP", "client");
    vi.stubEnv("SKIP_WEBSERVER", "false");
    vi.stubEnv("SKIP_INDEXER", "true");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("VITE_CHAIN_ID", "42161");
    const { default: config } = await import("../../playwright.config");
    const servers = [config.webServer].flat();
    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      command: "bun ../../scripts/dev/node-cli.js vite --mode test",
      cwd: "./packages/client",
      reuseExistingServer: false,
      env: { APP_ENV: "test", NODE_ENV: "test", VITE_CHAIN_ID: "11155111" },
    });
  });
});

describe("production preview profile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("builds fresh production assets with no dev auth or worker and owns its port", async () => {
    vi.stubEnv("PLAYWRIGHT_PWA_PREVIEW", "true");
    vi.stubEnv("PLAYWRIGHT_APP", "client");
    vi.stubEnv("SKIP_WEBSERVER", "false");
    vi.stubEnv("SKIP_INDEXER", "true");
    const { default: config } = await import("../../playwright.config");
    const servers = [config.webServer].flat();
    expect(servers).toHaveLength(1);
    for (const project of config.projects ?? []) {
      if (["passkey-mock", "work-exploration", "pwa-preview"].includes(project.name ?? "")) {
        expect(project.use?.channel).toBe("chromium");
      }
    }
    expect(servers[0]).toMatchObject({
      command: expect.stringContaining("bun run build &&"),
      reuseExistingServer: false,
      env: {
        APP_ENV: "production",
        NODE_ENV: "production",
        VITE_ENABLE_SW_DEV: "false",
        VITE_PASSKEY_SERVER_ENABLED: "true",
        SENTRY_AUTH_TOKEN: "",
        VITE_SENTRY_CLIENT_DSN: "",
        GG_ENABLE_SOURCEMAPS: "false",
      },
    });
  });
});

// The account-step spec walks the reporting ceremony, so its project owns the Agent's driver too.
describe("passkey project", () => {
  const originalArgv = process.argv;
  afterEach(() => {
    process.argv = originalArgv;
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("owns a reporting driver on the Client's origin and proxies the Client to it alone", async () => {
    process.argv = ["node", "playwright", "test", "--project=passkey-mock"];
    vi.stubEnv("CI", "true");
    vi.stubEnv("SKIP_WEBSERVER", "false");
    vi.stubEnv("SKIP_INDEXER", "true");
    const { default: config } = await import("../../playwright.config");
    const servers = [config.webServer].flat();
    expect(servers).toHaveLength(2);
    const [driver, client] = servers;
    expect(client?.url).toBe("http://localhost:3001");
    expect(driver).toMatchObject({
      command: "bun src/__tests__/reporting/driver/server.ts",
      cwd: "./packages/agent",
      url: `${REPORTING_DRIVER_URL}/__driver/outbox`,
      reuseExistingServer: false,
      env: {
        REPORTING_DRIVER_PORT: String(REPORTING_DRIVER_PORT),
        // The driver refuses a page on any origin but this one.
        REPORTING_DRIVER_ORIGIN: client?.url,
      },
    });
    expect(client).toMatchObject({
      cwd: "./packages/client",
      // An empty Agent address keeps a root .env from putting a running Agent behind the test.
      env: { VITE_PASSKEY_SERVER_ENABLED: "true", REPORTING_AGENT_URL: "", REPORTING_DRIVER_URL },
    });
  });
});

// Fork ownership is separate from the Sepolia test-server profile.
describe("caller-managed fork profile", () => {
  const originalArgv = process.argv;
  afterEach(() => {
    process.argv = originalArgv;
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("does not start or warm a Sepolia server for the fork project", async () => {
    process.argv = ["node", "playwright", "test", "--project=anvil-fork"];
    vi.stubEnv("SKIP_WEBSERVER", "false");
    vi.stubEnv("SKIP_INDEXER", "false");
    vi.stubEnv("RUN_FORK_TESTS", "true");
    const { default: config } = await import("../../playwright.config");
    expect(config.webServer).toBeUndefined();
    expect(config.globalSetup).toBeUndefined();
  });
  it("loads fork config in a worker without runner CLI arguments", async () => {
    process.argv = ["node", "playwright/lib/common/process.js"];
    vi.stubEnv("TEST_WORKER_INDEX", "0");
    vi.stubEnv("RUN_FORK_TESTS", "true");
    vi.stubEnv("SKIP_WEBSERVER", "true");
    const { default: config } = await import("../../playwright.config");
    expect(config.webServer).toBeUndefined();
    expect(config.projects?.some((project) => project.name === "anvil-fork")).toBe(true);
  });
  it("still rejects an unselected fork in the runner", async () => {
    process.argv = ["node", "playwright", "test", "--project=client-ci"];
    vi.stubEnv("RUN_FORK_TESTS", "true");
    await expect(import("../../playwright.config")).rejects.toThrow(/fork.*separately/i);
  });
  it("rejects mixing fork and owned Sepolia projects", async () => {
    process.argv = ["node", "playwright", "test", "--project=anvil-fork", "--project=client-ci"];
    vi.stubEnv("RUN_FORK_TESTS", "true");
    await expect(import("../../playwright.config")).rejects.toThrow(/fork.*separately/i);
  });
});
