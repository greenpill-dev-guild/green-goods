import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
