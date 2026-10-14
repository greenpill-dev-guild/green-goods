import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../../lib/env";

const ENV_KEYS = [
  "VITE_ALCHEMY_API_KEY",
  "VITE_CHAIN_ID",
  "VITE_DEV_CHAIN_MODE",
  "VITE_ERC7677_PROXY_URL",
  "VITE_GARDENS_SUBGRAPH_KEY",
  "VITE_LOCAL_FORK_RPC_URL",
  "VITE_PIMLICO_API_KEY",
  "VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID",
  "VITE_PIMLICO_SPONSORSHIP_POLICY_ID",
  "VITE_WALLETCONNECT_PROJECT_ID",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ENV", () => {
  it("reads each key from the variable of the same name", () => {
    for (const key of ENV_KEYS) vi.stubEnv(key, `value of ${key}`);

    expect(ENV_KEYS.map((key) => ENV[key])).toEqual(ENV_KEYS.map((key) => `value of ${key}`));
  });

  it("reads the variable at access time, not at import", () => {
    vi.stubEnv("VITE_CHAIN_ID", "42161");
    expect(ENV.VITE_CHAIN_ID).toBe("42161");

    vi.stubEnv("VITE_CHAIN_ID", "42220");
    expect(ENV.VITE_CHAIN_ID).toBe("42220");
  });

  it("returns undefined for a variable that is not set", () => {
    vi.stubEnv("VITE_ERC7677_PROXY_URL", undefined);

    expect(ENV.VITE_ERC7677_PROXY_URL).toBeUndefined();
  });

  it("returns undefined for a key it does not name", () => {
    vi.stubEnv("VITE_NOT_LISTED", "present");
    const anyKey = ENV as Record<string, unknown>;

    expect(anyKey.VITE_NOT_LISTED).toBeUndefined();
    expect(anyKey.toString).toBeUndefined();
  });
});
