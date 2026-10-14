import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { resolvePackageCommand as resolve, executePackagePlan } from "./package-commands.mjs";
import { SHARDS, SHARD_ORDER } from "./fork-shards.mjs";

test("contract build modes retain their distinct delegates and cleanup", () => {
  for (const mode of ["auto", "fast", "full"]) assert.deepEqual(resolve("build", ["--mode", mode], {}).steps[0].env, { GG_CONTRACTS_BUILD_MODE: mode });
  assert.match(resolve("build", ["--mode", "changed"]).steps[0].args[0], /build-changed/);
  assert.deepEqual(resolve("build", ["--mode", "target", "src/Garden.sol"]).steps[0].args, ["script/utils/build-target.ts", "src/Garden.sol"]);
  assert.deepEqual(resolve("build", ["--mode", "fresh"]).steps, [{ clean: "artifacts" }, { command: "forge", args: ["build"], env: {} }]);
  assert.deepEqual(resolve("build", ["--mode", "core"]).steps[0].args, ["build", "--skip", "test", "--skip", "script"]);
});

test("ordinary test gate retains typecheck, Solidity, production gas, Node and Vitest", () => {
  const steps = resolve("test", []).steps;
  assert.equal(steps.length, 5);
  assert.ok(steps[0].args.includes("tsc"));
  assert.equal(steps[1].env.FOUNDRY_PROFILE, "test");
  assert.ok(steps[1].args.includes("test/fork/**"));
  assert.match(steps[2].args[0], /run-release-gas-gate/);
  assert.ok(steps[3].args.some((arg) => arg.endsWith("operations.node-check.mjs")));
  assert.ok(steps[4].args.includes("vitest"));
});

test("Solidity profiles retain separate membership and compiler settings", () => {
  const select = (profile) => resolve("test", ["--suite", "solidity", "--profile", profile]).steps[0];
  assert.equal(select("deep").env.FOUNDRY_PROFILE, "ci");
  assert.ok(select("fast").args.includes("E2E|Fork"));
  assert.equal(select("fast").args.includes("test/fork/**"), false);
  assert.ok(select("lite").args.some((arg) => arg.includes("test/unit/GardenAccount*")));
  assert.deepEqual(select("gas").args, ["test", "--gas-report", "--no-match-contract", "E2E"]);
  assert.deepEqual(resolve("test", ["--suite", "solidity", "--profile", "match", "test/unit/X.t.sol"]).steps[0].args, ["test", "--match-path", "test/unit/X.t.sol"]);
});

test("fork release selections preserve preparation and generic scope preserves environment", () => {
  assert.equal(resolve("fork", []).loadRootEnvironment, true);
  const protocol = resolve("fork", ["--suite", "protocol", "--ci"]).steps[0];
  assert.ok(protocol.args.includes(".*[cC]elo.*|.*[uU]nlock.*"));
  assert.equal(protocol.args[protocol.args.indexOf("--threads") + 1], "1");
  for (const suite of ["garden-account-release", "garden-roles"]) {
    const selected = resolve("fork", ["--suite", suite]);
    assert.equal(selected.loadRootEnvironment, false);
    assert.match(selected.steps[0].args[0], /run-garden/);
    assert.ok(SHARD_ORDER.includes(suite));
    assert.ok(SHARDS[suite].runner);
  }
  assert.match(SHARDS.arbitrum.glob, /ArbitrumAssessmentReleaseSequence/);
});

test("invalid selectors fail before operational execution", () => {
  for (const [command, args] of [["build", ["--mode", "target"]], ["build", ["oops"]], ["test", ["--profile", "deep"]], ["test", ["--suite", "bad"]], ["fork", ["--suite", "garden-roles", "--threads", "2"]], ["fork", ["--ci"]], ["lint", ["--check", "--fix"]], ["clean", []], ["audit", ["coverage", "--mode", "advisory"]]]) assert.throws(() => resolve(command, args));
});

test("executor preserves argv, cwd, env and stops on first failure", async () => {
  const calls = [];
  const result = await executePackagePlan({ cwd: "/tmp", steps: [{ command: "first", args: ["a b"], env: { SAFE: "value" } }, { command: "never", args: [] }] }, { env: { INHERITED: "yes" }, spawnImpl(command, args, options) { calls.push({ command, args, options }); const child = new EventEmitter(); queueMicrotask(() => child.emit("exit", 7, null)); return child; } });
  assert.equal(result.code, 7);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ["a b"]);
  assert.equal(calls[0].options.cwd, "/tmp");
  assert.equal(calls[0].options.shell, false);
  assert.deepEqual(calls[0].options.env, { INHERITED: "yes", SAFE: "value" });
});
