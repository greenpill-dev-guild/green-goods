import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR, type Resolution } from "../cli/operations.mjs";
import { CONTRACTS_ROOT } from "./paths";
import { voucherDigest } from "./voucher-release";
import { sourceSafeSigningFixture } from "./source-upgrade-safe-signing.fixtures";
import { runSourceUpgradeCreateSession } from "./source-upgrade-create-session";

const fixture = vi.hoisted(() => ({ revision: "a".repeat(40), prefix: `source-session-fixture-${process.pid}` }));
vi.mock("./release-inputs", async (original) => ({
  ...(await original<typeof import("./release-inputs")>()),
  releaseRevision: () => fixture.revision,
}));
vi.mock("./source-upgrade-execution-store", () => ({
  SOURCE_EXECUTION_FILES: {
    journal: `${fixture.prefix}.json`,
    lock: `${fixture.prefix}.lock.json`,
    recoveryLock: `${fixture.prefix}.recovery.json`,
  },
}));
vi.mock("./cast-env", async (original) => ({
  ...(await original<typeof import("./cast-env")>()),
  execCastCaptured: () => OPERATOR,
}));

describe("source CREATE password session", () => {
  const directory = path.join(CONTRACTS_ROOT, ".generated/source-upgrades");
  const journalPath = path.join(directory, `${fixture.prefix}.json`);
  let input: Parameters<typeof runSourceUpgradeCreateSession>[0];
  const envelope = { fixture: "public orchestration fixture" };
  const calls: Array<{ mode: string; step: number; nonce: number; env: NodeJS.ProcessEnv }> = [];
  const writeProgress = (count: number, pending = false) =>
    fs.writeFileSync(
      journalPath,
      JSON.stringify({
        planHash: voucherDigest(input.plan),
        envelopeHash: voucherDigest(envelope),
        completed: Array.from({ length: count }, (_, i) => ({
          step: i + 1,
          transactionHash: "0x" + String(i + 1).padStart(64, "0"),
        })),
        ...(pending ? { pending: { step: count + 1 } } : {}),
      }),
    );
  const execute = vi.fn(async (resolution: Resolution, options: { env: NodeJS.ProcessEnv }) => {
    const args = resolution.args as string[];
    const step = Number(args[args.indexOf("--step") + 1]);
    calls.push({
      mode: args.includes("--adopt") ? "adopt" : "broadcast",
      step,
      nonce: Number(args[args.indexOf("--expected-nonce") + 1]),
      env: options.env,
    });
    writeProgress(step);
    return { code: 0 };
  });
  const unlock = vi.fn(async (run: (environment: NodeJS.ProcessEnv, signal: AbortSignal) => Promise<void>) =>
    run({ ETH_PASSWORD: "fixture-private-path" }, new AbortController().signal),
  );
  beforeEach(async () => {
    fixture.revision = "a".repeat(40);
    calls.length = 0;
    execute.mockClear();
    unlock.mockClear();
    const f = await sourceSafeSigningFixture();
    f.context.plan.deployments = Array.from({ length: 23 }, (_, i) => ({
      ...f.context.plan.deployments[0],
      nonce: 1039 + i,
    }));
    fs.mkdirSync(directory, { recursive: true });
    const relative = `.generated/source-upgrades/${fixture.prefix}`;
    input = {
      plan: f.context.plan,
      revision: fixture.revision,
      manifestPath: path.join(CONTRACTS_ROOT, "config/source-upgrade-release.json"),
      options: {
        plan: `${relative}.plan.json`,
        rehearsal: `${relative}.simulation.json`,
        envelope: `${relative}.execution.json`,
        "resume-plan": true,
      },
    };
    fs.writeFileSync(path.join(directory, `${fixture.prefix}.plan.json`), JSON.stringify(input.plan));
    fs.writeFileSync(path.join(directory, `${fixture.prefix}.execution.json`), JSON.stringify(envelope));
  });
  afterEach(() => {
    for (const file of fs.readdirSync(directory))
      if (file.startsWith(fixture.prefix)) fs.rmSync(path.join(directory, file));
  });

  it("unlocks once and runs exactly 23 sequential zero-policy-override CREATE wrappers", async () => {
    expect(await runSourceUpgradeCreateSession(input, { execute, unlock })).toEqual({
      state: "source-creates-verified",
      completed: 23,
      safeExecutionIncluded: false,
    });
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(calls.map(({ mode, step, nonce }) => [mode, step, nonce])).toEqual(
      Array.from({ length: 23 }, (_, i) => ["broadcast", i + 1, 1039 + i]),
    );
    expect(calls.every((call) => call.env.ETH_PASSWORD === "fixture-private-path")).toBe(true);
    for (const [resolution] of execute.mock.calls) {
      expect(resolution.args).toContain("--resume-plan");
      expect(resolution.args).not.toContain("--password");
      expect(resolution.args).not.toContain("--private-key");
    }
  });
  it("canonically adopts the saved prefix without a password before resuming", async () => {
    writeProgress(20);
    await runSourceUpgradeCreateSession(input, { execute, unlock });
    expect(calls.map(({ mode, step }) => [mode, step])).toEqual([
      ["adopt", 20],
      ["broadcast", 21],
      ["broadcast", 22],
      ["broadcast", 23],
    ]);
    expect(calls[0].env.ETH_PASSWORD).toBeUndefined();
  });
  it("reverifies a complete lane without unlocking or sending again", async () => {
    writeProgress(23);
    await runSourceUpgradeCreateSession(input, { execute, unlock });
    expect(calls.map(({ mode, step }) => [mode, step])).toEqual([["adopt", 23]]);
    expect(unlock).not.toHaveBeenCalled();
  });
  it("stops after the first failed boundary", async () => {
    execute.mockImplementationOnce(async () => ({ code: 1 }));
    await expect(runSourceUpgradeCreateSession(input, { execute, unlock })).rejects.toThrow("stopped at boundary 1");
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("rejects ambiguous pending state and execution locks before the password prompt", async () => {
    writeProgress(1, true);
    await expect(runSourceUpgradeCreateSession(input, { execute, unlock })).rejects.toThrow("unambiguous");
    fs.rmSync(journalPath);
    fs.writeFileSync(path.join(directory, `${fixture.prefix}.lock.json`), "{}");
    await expect(runSourceUpgradeCreateSession(input, { execute, unlock })).rejects.toThrow("execution lock");
    expect(unlock).not.toHaveBeenCalled();
  });
  it("stops if the checkout changes while the password is entered", async () => {
    const change = async (run: (environment: NodeJS.ProcessEnv, signal: AbortSignal) => Promise<void>) => {
      fixture.revision = "b".repeat(40);
      await run({ ETH_PASSWORD: "fixture-private-path" }, new AbortController().signal);
    };
    await expect(runSourceUpgradeCreateSession(input, { execute, unlock: change })).rejects.toThrow("revision changed");
    expect(execute).not.toHaveBeenCalled();
  });
  it("does not start another CREATE after session cancellation", async () => {
    const controller = new AbortController();
    execute.mockImplementationOnce(async () => {
      writeProgress(1);
      controller.abort(new Error("operator canceled"));
      return { code: 0 };
    });
    const cancelableUnlock = async (run: (environment: NodeJS.ProcessEnv, signal: AbortSignal) => Promise<void>) =>
      run({ ETH_PASSWORD: "fixture-private-path" }, controller.signal);
    await expect(runSourceUpgradeCreateSession(input, { execute, unlock: cancelableUnlock })).rejects.toThrow(
      "operator canceled",
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
