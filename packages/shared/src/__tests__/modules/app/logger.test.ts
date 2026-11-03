// TEST-QUALITY: allow-small-test-file - The production JSON line is the logger's only logic, and development-mode tests never reach it; these cases pin how it writes a bigint and a cycle.
import { getContractError, parseAbi, UserRejectedRequestError } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../../modules/app/logger";

const VAULT = "0x1111111111111111111111111111111111111111";
const RECEIVER = "0x2222222222222222222222222222222222222222";

describe("logger in a production build", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("writes a bigint as its decimal string instead of throwing", () => {
    vi.stubEnv("DEV", false);
    const write = vi.spyOn(console, "error").mockImplementation(() => {});
    // viem keeps a failed call's args on the error it throws, as a wallet-rejected deposit shows.
    const error = getContractError(new UserRejectedRequestError(new Error("User rejected")), {
      abi: parseAbi(["function deposit(uint256 assets, address receiver) returns (uint256)"]),
      address: VAULT,
      args: [10n ** 18n, RECEIVER],
      functionName: "deposit",
    });

    expect(() => logger.error("Deposit failed", { error })).not.toThrow();
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toMatchObject({
      level: "error",
      message: "Deposit failed",
      error: { functionName: "deposit", args: ["1000000000000000000", RECEIVER] },
    });
  });

  it("marks a reference back to an enclosing object as circular and repeats a shared one", () => {
    vi.stubEnv("DEV", false);
    const write = vi.spyOn(console, "warn").mockImplementation(() => {});
    const vault = { address: VAULT };
    const job: Record<string, unknown> = { from: vault, to: vault };
    job.self = job;

    expect(() => logger.warn("Job stalled", { job })).not.toThrow();
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toMatchObject({
      level: "warn",
      message: "Job stalled",
      job: { from: { address: VAULT }, to: { address: VAULT }, self: "[Circular]" },
    });
  });
});
