import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fixtureGitEnvironment } from "../lib/dev-shared.js";
import { ADMIN_HUB_TESTS, SHARED_LIVE_TESTS, resolvePackageCommand as resolve, executePackageCommand } from "./package-commands.mjs";
import {
  TEST_LEASE_TIMEOUT_EXIT_CODE,
  TestLeaseTimeoutError,
  acquireTestLease,
  resolveTestLeaseDirectory,
  resolveTestLeaseSettings,
  runsInContinuousIntegration,
} from "./test-lease.mjs";

test("package test selections retain their actual scope", () => {
  const admin = resolve("admin", "test", ["--suite", "hub"]);
  assert.equal(ADMIN_HUB_TESTS.length, 13);
  assert.deepEqual(admin.steps[0].args.slice(3), ADMIN_HUB_TESTS);
  assert.equal(admin.steps[0].env.APP_ENV, "test");
  assert.ok(resolve("shared", "test").steps[0].args.includes("src/**/*.live.test.ts"));
  assert.equal(resolve("shared", "test", ["--scope", "all-configured", "--coverage"]).steps[0].args.includes("--exclude"), false);
  const live = resolve("shared", "test", ["--scope", "live"]);
  assert.deepEqual(live.steps[0].args.slice(3), SHARED_LIVE_TESTS);
  assert.equal(live.steps[0].env.RUN_LIVE_RPC_TESTS, "true");
  assert.deepEqual(resolve("client", "test", ["--coverage"]).steps[0].args.slice(1), ["vitest", "run", "--coverage"]);
});

test("Shared CI shards forward through the test wrapper without changing nightly coverage", () => {
  const unsharded = resolve("shared", "test").steps[0].args;
  for (const shard of ["1/2", "2/2"]) {
    const args = resolve("shared", "test", ["--shard", shard]).steps[0].args;
    assert.deepEqual(args, [...unsharded, "--shard", shard]);
  }
  assert.ok(!resolve("shared", "test", ["--scope", "all-configured", "--coverage"]).steps[0].args.includes("--shard"));
  for (const args of [["--shard", "0/2"], ["--shard", "1/3"], ["--shard", "1/2", "--coverage"], ["--shard", "1/2", "--scope", "live"], ["--shard", "1/2", "--testNamePattern", "only"], ["--shard", "1/2", "--exclude", "src/foo.test.ts"]]) {
    assert.throws(() => resolve("shared", "test", args));
  }
  assert.throws(() => resolve("client", "test", ["--shard", "1/2"]));
});

test("agent default and explicit paths preserve Node and SQLite lanes", () => {
  const all = resolve("agent", "test");
  assert.equal(all.steps.length, 2);
  assert.equal(all.steps[0].executable, "node");
  assert.equal(all.steps[1].executable, "bun");
  assert.equal(all.steps[1].env.AGENT_SQLITE_INTEGRATION, "true");
  const sqlite = resolve("agent", "test", ["src/__tests__/storage.sqlite.test.ts"]);
  assert.equal(sqlite.steps.length, 1);
  assert.deepEqual(sqlite.steps[0], all.steps[1]);
  assert.equal(resolve("agent", "test", ["--scope", "unit", "--coverage"]).steps[0].args[0], "scripts/run-coverage.mjs");
});

test("indexer preserves codegen, full assertion, coverage reporter and integration timeout", () => {
  const full = resolve("indexer", "test");
  assert.deepEqual(full.steps[0].args.slice(1), ["envio", "codegen"]);
  assert.equal(full.steps[1].env.GG_RUN_FULL_INDEXER_TEST_SUITE, "1");
  const covered = resolve("indexer", "test", ["--scope", "handlers", "--coverage", "--reporter", "text", "--reporter", "json"]);
  assert.equal(covered.steps.length, 1);
  assert.deepEqual(covered.steps[0].args.slice(1, 6), ["c8", "--reporter", "text", "--reporter", "json"]);
  assert.deepEqual(covered.steps[0].env, {});
  const events = resolve("indexer", "test", ["--scope", "contract-events"]);
  assert.ok(events.steps[0].args.includes("480000"));
  assert.equal(events.steps[0].env.GG_RUN_LOCAL_CONTRACT_EVENT_INTEGRATION, "1");
});

test("indexer development and Docker actions preserve exact process boundaries", () => {
  const dev = resolve("indexer", "dev", ["--restart"]);
  assert.equal(dev.steps[0].executable, "bun");
  assert.deepEqual(dev.steps[0].args.slice(-3), ["envio", "dev", "--restart"]);
  assert.deepEqual(resolve("indexer", "docker", ["up", "--detach"]).steps[0].args, ["compose", "-f", "docker-compose.indexer.yaml", "up", "--build", "-d"]);
  assert.deepEqual(resolve("indexer", "docker", ["logs"]).steps[0].args.slice(-3), ["logs", "-f", "indexer"]);
  assert.deepEqual(resolve("indexer", "docker", ["down"]).steps[0].args.slice(-1), ["down"]);
  assert.throws(() => resolve("indexer", "docker", []));
  assert.throws(() => resolve("indexer", "docker", ["reset"]));
  assert.throws(() => resolve("indexer", "docker", ["logs", "--detach"]));
});

test("typecheck full keeps frontend solution projects and shared compiler flags", () => {
  assert.ok(resolve("admin", "typecheck", ["--scope", "full"]).steps[0].args.includes("packages/admin/tsconfig.json"));
  assert.ok(resolve("client", "typecheck", ["--scope", "full"]).steps[0].args.includes("-b"));
  const full = resolve("shared", "typecheck", ["--scope", "full"]);
  assert.equal(full.steps.length, 2);
  assert.ok(full.steps[0].args.includes("--composite"));
  assert.ok(full.steps[1].args.includes("tsconfig.test.json"));
});

test("format read/write selection preserves package roots", () => {
  for (const pkg of ["root", "shared", "client", "admin", "agent"]) {
    assert.deepEqual(resolve(pkg, "format").steps[0].args, ["format", "--write", pkg === "agent" ? "src" : "."]);
    assert.deepEqual(resolve(pkg, "format", ["--check"]).steps[0].args, ["format", pkg === "agent" ? "src" : "."]);
  }
});

test("invalid scope and options fail before any subprocess", () => {
  for (const [pkg, action, args] of [["shared", "test", ["--coverage"]], ["agent", "test", ["--coverage"]], ["indexer", "test", ["--coverage"]], ["indexer", "test", ["--scope", "handlers", "--shard", "1/2"]], ["client", "test", ["--ui"]], ["admin", "test", ["--suite", "hub", "extra.ts"]], ["admin", "test", ["--wat"]], ["shared", "typecheck", ["--scope", "none"]], ["client", "typecheck", ["--scope", "--help"]], ["root", "format", ["--check", "--check"]]]) assert.throws(() => resolve(pkg, action, args));
});

test("package executor stops after failure and preserves process boundaries", async () => {
  const calls = [];
  const signalHost = new EventEmitter();
  const code = await executePackageCommand(resolve("agent", "test"), { signals: signalHost, environment: {}, acquire: async () => ({ status: "acquired", slot: 0, release() {} }), resources: { cpus: 4, totalMemoryBytes: 8 * 1024 ** 3 }, spawnImpl(command, args, options) { calls.push({ command, args, options }); const child = new EventEmitter(); queueMicrotask(() => child.emit("close", 9, null)); return child; } });
  assert.equal(code, 9);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.shell, false);
  assert.match(calls[0].options.cwd, /packages\/agent$/);
  assert.equal(signalHost.listenerCount("SIGINT"), 0);
});

test("package-wide test runs take the machine test lease; focused, watch and live runs do not", () => {
  for (const [pkg, args] of [["shared", []], ["shared", ["--coverage", "--scope", "all-configured"]], ["shared", ["--shard", "1/2"]], ["client", []], ["admin", []], ["agent", []], ["indexer", []], ["shared", ["--project", "node"]]]) {
    assert.equal(resolve(pkg, "test", args).lease.required, true, `${pkg} ${args.join(" ")}`);
  }
  for (const [pkg, args] of [["shared", ["src/utils/date.test.ts"]], ["shared", ["--watch"]], ["shared", ["--scope", "live"]], ["admin", ["--suite", "hub"]], ["admin", ["--ui"]], ["agent", ["src/__tests__/storage.sqlite.test.ts"]], ["indexer", ["--scope", "handlers", "test/garden.test.ts"]]]) {
    assert.equal(resolve(pkg, "test", args).lease.required, false, `${pkg} ${args.join(" ")}`);
  }
  assert.equal(resolve("shared", "typecheck").lease, null);
  assert.equal(resolve("shared", "test", ["--maxWorkers", "2"]).lease.pinnedWorkers, true);
  assert.equal(resolve("shared", "test").lease.pinnedWorkers, false);
});

function leaseFixture(t) {
  const root = mkdtempSync(join(tmpdir(), "test-lease-"));
  t.after(() => {
    chmodSync(root, 0o700);
    rmSync(root, { recursive: true, force: true });
  });
  return { root, directory: join(root, "lease") };
}

const holderRecord = (overrides = {}) => ({ pid: process.pid, cwd: "/work/a", package: "shared", ...overrides });

test("the test lease records its holder in a slot and releases it", async (t) => {
  const { directory } = leaseFixture(t);
  const lease = await acquireTestLease({ directory, holder: holderRecord(), timeoutMs: 1_000, report: () => {} });
  assert.equal(lease.status, "acquired");
  const stored = JSON.parse(readFileSync(join(directory, "slot-0.json"), "utf8"));
  assert.equal(stored.pid, process.pid);
  assert.equal(stored.cwd, "/work/a");
  assert.equal(stored.package, "shared");
  assert.ok(Number.isFinite(stored.startedAt));
  lease.release();
  lease.release();
  assert.equal(existsSync(join(directory, "slot-0.json")), false);
  assert.deepEqual(readdirSync(directory), []);
});

test("a second full run waits for the holder, names it, and starts once it is released", async (t) => {
  const { directory } = leaseFixture(t);
  const first = await acquireTestLease({ directory, holder: holderRecord({ cwd: "/work/first" }), timeoutMs: 1_000, report: () => {} });
  const lines = [];
  let polls = 0;
  const second = await acquireTestLease({
    directory,
    holder: holderRecord({ cwd: "/work/second", package: "client" }),
    timeoutMs: 60_000,
    report: (line) => lines.push(line),
    sleep: async () => {
      polls += 1;
      if (polls === 3) first.release();
    },
  });
  assert.equal(second.status, "acquired");
  assert.equal(polls, 3);
  assert.match(lines[0], new RegExp(`pid ${process.pid}`));
  assert.match(lines[0], /shared test in \/work\/first/);
  assert.match(lines.at(-1), /acquired/);
  assert.equal(JSON.parse(readFileSync(join(directory, "slot-0.json"), "utf8")).cwd, "/work/second");
  second.release();
});

test("extra slots let that many full runs proceed at once", async (t) => {
  const { directory } = leaseFixture(t);
  const leases = [];
  for (const cwd of ["/work/a", "/work/b"]) {
    leases.push(await acquireTestLease({ directory, slots: 2, holder: holderRecord({ cwd }), timeoutMs: 1_000, report: () => {} }));
  }
  assert.deepEqual(leases.map((lease) => lease.slot), [0, 1]);
  for (const lease of leases) lease.release();
});

test("a slot whose holder process is gone is recovered instead of waited on", async (t) => {
  const { directory } = leaseFixture(t);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "slot-0.json"), JSON.stringify({ token: "old", pid: 4_000_000, cwd: "/work/crashed", package: "admin", startedAt: 1 }));
  const lease = await acquireTestLease({
    directory,
    holder: holderRecord(),
    timeoutMs: 1_000,
    processAlive: (pid) => pid === process.pid,
    report: () => {},
    sleep: async () => assert.fail("a stale holder must not make the run wait"),
  });
  assert.equal(lease.status, "acquired");
  assert.equal(JSON.parse(readFileSync(join(directory, "slot-0.json"), "utf8")).cwd, "/work/a");
  lease.release();
});

test("waiting ends with a timeout that names the holder and the overrides", async (t) => {
  const { directory } = leaseFixture(t);
  const holder = await acquireTestLease({ directory, holder: holderRecord({ cwd: "/work/busy" }), timeoutMs: 1_000, report: () => {} });
  let clock = 0;
  await assert.rejects(
    acquireTestLease({
      directory,
      holder: holderRecord({ cwd: "/work/late" }),
      timeoutMs: 5_000,
      pollMs: 1_000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      report: () => {},
    }),
    (error) => {
      assert.ok(error instanceof TestLeaseTimeoutError);
      assert.match(error.message, /after 5s/);
      assert.match(error.message, /shared test in \/work\/busy/);
      assert.match(error.message, /GREEN_GOODS_TEST_LEASE_TIMEOUT_SECONDS/);
      assert.match(error.message, /GREEN_GOODS_TEST_LEASE_SLOTS/);
      return true;
    },
  );
  holder.release();
});

test("an unwritable lease directory reports unavailable instead of failing", async (t) => {
  const { root } = leaseFixture(t);
  chmodSync(root, 0o500);
  const outcome = await acquireTestLease({ directory: join(root, "lease"), holder: holderRecord(), timeoutMs: 1_000, report: () => {} });
  assert.equal(outcome.status, "unavailable");
  assert.match(outcome.reason, /lease/);
});

test("lease settings read positive overrides and reject malformed ones", () => {
  assert.deepEqual(resolveTestLeaseSettings({}), { slots: 1, timeoutSeconds: 900 });
  assert.deepEqual(resolveTestLeaseSettings({ GREEN_GOODS_TEST_LEASE_SLOTS: "2", GREEN_GOODS_TEST_LEASE_TIMEOUT_SECONDS: "60" }), { slots: 2, timeoutSeconds: 60 });
  for (const value of ["0", "-1", "two", "1.5"]) {
    assert.throws(() => resolveTestLeaseSettings({ GREEN_GOODS_TEST_LEASE_SLOTS: value }), /GREEN_GOODS_TEST_LEASE_SLOTS/);
  }
  assert.equal(runsInContinuousIntegration({ CI: "true" }), true);
  assert.equal(runsInContinuousIntegration({ CI: "true", GREEN_GOODS_LOCAL_GATE: "1" }), false);
  assert.equal(runsInContinuousIntegration({ CI: "false" }), false);
  assert.equal(runsInContinuousIntegration({}), false);
});

test("the lease lives in the git common directory, shared by every worktree", (t) => {
  const { root } = leaseFixture(t);
  const env = fixtureGitEnvironment();
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" });
  const main = join(root, "main");
  mkdirSync(main);
  git(main, "init", "-q");
  git(main, "commit", "-q", "--allow-empty", "-m", "seed");
  git(main, "worktree", "add", "-q", join(root, "linked"));
  const execFile = (command, args, options) => execFileSync(command, args, { ...options, env });
  const fromMain = resolveTestLeaseDirectory({ cwd: main, execFile });
  assert.equal(fromMain, join(realpathSync(main), ".git", "green-goods-test-lease"));
  assert.equal(resolveTestLeaseDirectory({ cwd: join(root, "linked"), execFile }), fromMain);
});

function recordingSpawn(calls, { exitCode = 0 } = {}) {
  return (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.kill = () => {};
    queueMicrotask(() => child.emit("close", exitCode, null));
    return child;
  };
}

const machine = { cpus: 10, totalMemoryBytes: 16 * 1024 ** 3 };

test("a leased run holds the slot for every step, gives Vitest the machine share, and releases", async (t) => {
  const { directory } = leaseFixture(t);
  const calls = [];
  const seen = [];
  const code = await executePackageCommand(resolve("agent", "test"), {
    signals: new EventEmitter(),
    environment: {},
    leaseDirectory: directory,
    resources: machine,
    report: () => {},
    spawnImpl: (command, args, options) => {
      seen.push(readdirSync(directory).includes("slot-0.json"));
      return recordingSpawn(calls)(command, args, options);
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(seen, [true, true]);
  assert.equal(calls[0].options.env.VITEST_MAX_WORKERS, "8");
  assert.equal(existsSync(join(directory, "slot-0.json")), false);
});

test("a leased run keeps an explicit worker choice", async (t) => {
  const { directory } = leaseFixture(t);
  for (const [args, environment, expected] of [[[], { VITEST_MAX_WORKERS: "3" }, "3"], [["--maxWorkers", "2"], {}, undefined]]) {
    const calls = [];
    await executePackageCommand(resolve("shared", "test", args), { signals: new EventEmitter(), environment, leaseDirectory: directory, resources: machine, report: () => {}, spawnImpl: recordingSpawn(calls) });
    assert.equal(calls[0].options.env.VITEST_MAX_WORKERS, expected, JSON.stringify(args));
  }
});

test("an unavailable lease warns once and runs with a conservative worker cap", async (t) => {
  const { root } = leaseFixture(t);
  chmodSync(root, 0o500);
  const calls = [];
  const lines = [];
  const code = await executePackageCommand(resolve("agent", "test"), { signals: new EventEmitter(), environment: {}, leaseDirectory: join(root, "lease"), resources: machine, report: (line) => lines.push(line), spawnImpl: recordingSpawn(calls) });
  assert.equal(code, 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /conservative/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.options.env.VITEST_MAX_WORKERS === "4"));
});

test("CI and focused runs never touch the lease; the local gate still takes it", async (t) => {
  const { directory } = leaseFixture(t);
  const acquire = async () => assert.fail("the lease must not be taken");
  for (const [plan, environment] of [[resolve("shared", "test"), { CI: "true" }], [resolve("shared", "test", ["src/utils/date.test.ts"]), {}]]) {
    const calls = [];
    assert.equal(await executePackageCommand(plan, { signals: new EventEmitter(), environment, acquire, leaseDirectory: directory, resources: machine, spawnImpl: recordingSpawn(calls) }), 0);
    assert.equal(calls[0].options.env.VITEST_MAX_WORKERS, undefined);
  }
  let taken = 0;
  await executePackageCommand(resolve("shared", "test"), {
    signals: new EventEmitter(),
    environment: { CI: "true", GREEN_GOODS_LOCAL_GATE: "1" },
    acquire: async () => {
      taken += 1;
      return { status: "acquired", slot: 0, release: () => {} };
    },
    leaseDirectory: directory,
    resources: machine,
    spawnImpl: recordingSpawn([]),
  });
  assert.equal(taken, 1);
});

test("a lease timeout exits with its own code and never starts the suite", async () => {
  const lines = [];
  const calls = [];
  const code = await executePackageCommand(resolve("shared", "test"), {
    signals: new EventEmitter(),
    environment: {},
    leaseDirectory: "/unused",
    acquire: async () => {
      throw new TestLeaseTimeoutError("test lease: gave up after 900s");
    },
    report: (line) => lines.push(line),
    spawnImpl: recordingSpawn(calls),
  });
  assert.equal(code, TEST_LEASE_TIMEOUT_EXIT_CODE);
  assert.equal(calls.length, 0);
  assert.match(lines.join("\n"), /gave up after 900s/);
});

test("an interrupt releases the lease while the suite runs and while it waits", async (t) => {
  const { directory } = leaseFixture(t);
  const signals = new EventEmitter();
  const running = executePackageCommand(resolve("shared", "test"), {
    signals,
    environment: {},
    leaseDirectory: directory,
    resources: machine,
    report: () => {},
    spawnImpl: () => {
      const child = new EventEmitter();
      child.kill = (signal) => queueMicrotask(() => child.emit("close", null, signal));
      queueMicrotask(() => signals.emit("SIGINT"));
      return child;
    },
  });
  assert.equal(await running, 130);
  assert.equal(existsSync(join(directory, "slot-0.json")), false);

  const holder = await acquireTestLease({ directory, holder: holderRecord({ cwd: "/work/other" }), timeoutMs: 1_000, report: () => {} });
  const waiting = executePackageCommand(resolve("client", "test"), {
    signals,
    environment: {},
    leaseDirectory: directory,
    resources: machine,
    report: () => queueMicrotask(() => signals.emit("SIGTERM")),
    spawnImpl: () => assert.fail("an interrupted wait must not start the suite"),
  });
  assert.equal(await waiting, 143);
  holder.release();
});

test("Turbo passes lease overrides, the local-gate marker and an explicit worker choice to package suites", () => {
  const turbo = JSON.parse(readFileSync(new URL("../../turbo.json", import.meta.url), "utf8"));
  const passThrough = turbo.globalPassThroughEnv ?? [];
  for (const variable of ["GREEN_GOODS_TEST_LEASE_SLOTS", "GREEN_GOODS_TEST_LEASE_TIMEOUT_SECONDS", "GREEN_GOODS_LOCAL_GATE", "VITEST_MAX_WORKERS"]) {
    assert.ok(passThrough.some((entry) => entry === variable || (entry.endsWith("*") && variable.startsWith(entry.slice(0, -1)))), variable);
  }
});
