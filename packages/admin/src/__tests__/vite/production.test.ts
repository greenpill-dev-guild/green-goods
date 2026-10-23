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
