import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { ADMIN_HUB_TESTS, SHARED_LIVE_TESTS, resolvePackageCommand as resolve, executePackageCommand } from "./package-commands.mjs";

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
  for (const [pkg, action, args] of [["shared", "test", ["--coverage"]], ["agent", "test", ["--coverage"]], ["indexer", "test", ["--coverage"]], ["client", "test", ["--ui"]], ["admin", "test", ["--suite", "hub", "extra.ts"]], ["admin", "test", ["--wat"]], ["shared", "typecheck", ["--scope", "none"]], ["client", "typecheck", ["--scope", "--help"]], ["root", "format", ["--check", "--check"]]]) assert.throws(() => resolve(pkg, action, args));
});

test("package executor stops after failure and preserves process boundaries", async () => {
  const calls = [];
  const signalHost = new EventEmitter();
  const code = await executePackageCommand(resolve("agent", "test"), { signals: signalHost, spawnImpl(command, args, options) { calls.push({ command, args, options }); const child = new EventEmitter(); queueMicrotask(() => child.emit("close", 9, null)); return child; } });
  assert.equal(code, 9);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.shell, false);
  assert.match(calls[0].options.cwd, /packages\/agent$/);
  assert.equal(signalHost.listenerCount("SIGINT"), 0);
});
