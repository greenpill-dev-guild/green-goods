import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigEnv, UserConfig } from "vite";

vi.mock("vite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vite")>()),
  loadEnv: () => ({ NODE_ENV: "development", SKIP_MKCERT: "true" }),
}));
vi.mock("../../../../../scripts/lib/env-parity.mjs", () => ({
  assertEnvParity: vi.fn(),
  assertSentryDsnResolvable: vi.fn(),
  dropVercelFrameworkVariables: vi.fn(),
}));
import adminConfig from "../../../vite.config";

beforeEach(() => vi.spyOn(process, "chdir").mockImplementation(() => {}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("admin build runtime", () => {
  it.each([
    ["build", "production", true],
    ["build", "staging", true],
    ["serve", "development", false],
    ["serve", "production", false],
  ] as const)("%s in %s mode enforces production runtime only for builds", async (command, mode, building) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SENTRY_AUTH_TOKEN", "");
    expect(typeof adminConfig).toBe("function");
    const config = await (adminConfig as (env: ConfigEnv) => Promise<UserConfig>)({
      command,
      mode,
    });
    expect(process.env.NODE_ENV).toBe(building ? "production" : "development");
    expect(config.oxc).toMatchObject({ jsx: { development: !building } });
    if (building) {
      expect(config.define).toMatchObject({
        "process.env.NODE_ENV": '"production"',
        "import.meta.env.DEV": "false",
        "import.meta.env.PROD": "true",
      });
    } else {
      expect(config.define).not.toHaveProperty("process.env.NODE_ENV");
    }
  });
});

describe("admin telemetry segmentation", () => {
  it("hands the bundle its surface, release and test records, with accounts only as digests", async () => {
    const account = "0x00000000000000000000000000000000000000Aa";
    const garden = "0x00000000000000000000000000000000000000CC";
    vi.stubEnv("SENTRY_AUTH_TOKEN", "");
    vi.stubEnv("VITE_APP_VERSION", "3ee6594ef3e5");
    vi.stubEnv("TELEMETRY_TEST_ACCOUNTS", ` ${account} `);
    vi.stubEnv("TELEMETRY_TEST_GARDENS", `${garden},`);

    const config = await (adminConfig as (env: ConfigEnv) => Promise<UserConfig>)({
      command: "serve",
      mode: "development",
    });

    expect(config.define).toMatchObject({
      "import.meta.env.VITE_APP_SURFACE": '"admin"',
      "import.meta.env.VITE_TELEMETRY_RELEASE": '"green-goods-admin@3ee6594ef3e5"',
      "import.meta.env.VITE_TELEMETRY_TEST_GARDENS": JSON.stringify(garden.toLowerCase()),
      "import.meta.env.VITE_TELEMETRY_TEST_ACCOUNT_DIGESTS": JSON.stringify(
        createHash("sha256").update(account.toLowerCase()).digest("hex")
      ),
    });
    expect(JSON.stringify(config.define)).not.toContain(account.slice(2).toLowerCase());
  });
});
