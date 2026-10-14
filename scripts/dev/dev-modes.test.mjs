import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { groups, parseHealthArgs, smokeInvocation } from "../lib/dev-modes.mjs";
import { parseArgs, applyGroupEnvironment } from "./stack.js";

test("root dev forwards modes and services without adding a second local argument", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url)));
  assert.equal(manifest.scripts.dev, "node scripts/dev/stack.js");
  assert.equal(parseArgs(["node", "stack.js", "--", "fork"]).group, "fork");
  assert.deepEqual(parseArgs(["node", "stack.js", "client", "admin"]).names, ["client", "admin"]);
  assert.equal(parseArgs(["node", "stack.js", "status"]).mode, "status");
  assert.equal(parseArgs(["node", "stack.js", "stop"]).mode, "stop");
  assert.equal(parseArgs(["node", "stack.js", "bad-mode"]).mode, "error");
});

test("health and smoke select the same six supported launch modes", () => {
  for (const mode of Object.keys(groups)) {
    assert.equal(parseHealthArgs([mode]).mode, mode);
    assert.ok(smokeInvocation([mode]).script);
  }
  assert.equal(parseHealthArgs([]).mode, "local");
  assert.equal(parseHealthArgs(["fork"]).fork, true);
  assert.equal(parseHealthArgs(["local"]).core, true);
  assert.equal(parseHealthArgs(["full"]).core, false);
  assert.equal(parseHealthArgs(["--", "--profile", "contracts", "--json"]).profile, "contracts");
  assert.throws(() => parseHealthArgs(["prod", "--profile", "full"]), /either/);
  assert.throws(() => parseHealthArgs(["typo"]), /Unknown/);
  assert.throws(() => smokeInvocation(["typo"]), /Unknown/);
  assert.throws(() => smokeInvocation(["prod", "--mode", "mirror"]), /mode/);
  assert.deepEqual(smokeInvocation(["--", "fork", "--json"]).args, ["--core", "--fork", "--json"]);
  assert.deepEqual(smokeInvocation(["prod-mirror", "--timeout", "5"]).args, ["--mode", "mirror", "--timeout", "5"]);
});

test("mode selection preserves the hosted, local-live, and fork boundaries", () => {
  for (const mode of Object.keys(groups)) {
    const { env } = applyGroupEnvironment({ name: "client" }, mode);
    assert.equal(env.VITE_CHAIN_ID, "42161");
    assert.equal(env.VITE_DEV_CHAIN_MODE, mode === "fork" ? "arbitrum_fork" : "");
    assert.equal(env.VITE_API_BASE_URL, ["prod", "prod-mirror"].includes(mode) ? "https://agent.greengoods.app" : "http://127.0.0.1:3005");
  }
});

test("invalid CLI arguments exit before services start", () => {
  for (const script of ["stack.js", "doctor.js", "smoke.js"]) {
    const result = spawnSync(process.execPath, [`scripts/dev/${script}`, "unknown-mode"], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.doesNotMatch(result.stdout, /Started Green Goods|service ports ready/);
  }
});

test("PM2 invokes package development commands without recursing through root", () => {
  const require = createRequire(import.meta.url);
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(new URL("../../ecosystem.config.cjs", import.meta.url), "utf8"), {
    module,
    __dirname: "/fixture",
    process: { env: {} },
    require: (name) => name === "node:fs" ? { existsSync: () => false } : require(name),
  });
  const apps = module.exports.apps;
  for (const name of new Set(Object.values(groups).flat())) {
    const app = apps.find((item) => item.name === name);
    assert.ok(app, `Missing PM2 service ${name}`);
    assert.doesNotMatch(`${app.script} ${app.args}`, /scripts\/dev\/stack\.js/);
    if (/bun run dev\b/.test(app.args ?? "")) {
      assert.match(app.args, /cd (?:packages\/\w+|docs) && bun run dev\b/);
    }
  }
});

test("ownerless explicit stop refuses before connecting to the process manager", () => {
  const result = spawnSync(process.execPath, ["scripts/dev/stack.js", "stop"], {
    encoding: "utf8",
    env: { ...process.env, GREEN_GOODS_DEV_OWNER: "" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing an ownerless stop/);
  assert.doesNotMatch(result.stdout, /Stopped Green Goods/);
});

test("selected smoke help advertises the public interface, not rejected internal selectors", () => {
  for (const mode of Object.keys(groups)) {
    const result = spawnSync(process.execPath, ["scripts/dev/smoke.js", mode, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`Usage: bun run dev:smoke -- ${mode}`));
    assert.doesNotMatch(result.stdout, /--mode|--core|--fork/);
  }
});
