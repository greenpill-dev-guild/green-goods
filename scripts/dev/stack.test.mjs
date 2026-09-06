import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { applyGroupEnvironment, compatibilityKey, findOrphanedApps, parseArgs, reportReadiness, runStartupSmoke } from "./stack.js";
import { fileURLToPath } from "node:url";

const checkout = fileURLToPath(new URL("../..", import.meta.url));
const orphanClaim = {
  port: 3001, service: "client", compatibilityKey: "client:local-live", ownerId: "old-qa", ownerPid: 101,
};
const orphanProcess = {
  name: "client", pid: 202,
  pm2_env: { GREEN_GOODS_DEV_OWNER: "old-qa", pm_cwd: checkout },
};

test("a dead launcher can recover its still-running PM2 service", () => {
  assert.deepEqual(findOrphanedApps([{ name: "client" }], { 3001: orphanClaim },
    [orphanProcess], () => false), [{ name: "client", ownerId: "old-qa", ports: [3001] }]);
});

test("recovery leaves live launchers and unverified listeners untouched", () => {
  assert.deepEqual(findOrphanedApps([{ name: "client" }], { 3001: orphanClaim },
    [orphanProcess], () => true), []);
  assert.deepEqual(findOrphanedApps([{ name: "client" }], { 3001: orphanClaim },
    [], () => false), []);
});

test("recovery refuses mismatched PM2 owners, checkouts, and duplicate names", () => {
  for (const processes of [
    [{ ...orphanProcess, pm2_env: { ...orphanProcess.pm2_env, GREEN_GOODS_DEV_OWNER: "another-owner" } }],
    [{ ...orphanProcess, pm2_env: { ...orphanProcess.pm2_env, pm_cwd: "/another/checkout" } }],
    [orphanProcess, orphanProcess],
  ]) {
    assert.throws(() => findOrphanedApps([{ name: "client" }], { 3001: orphanClaim },
      processes, () => false), /Cannot verify/);
  }
});

test("indexer recovery requires consistent ownership across all three ports", () => {
  const claims = Object.fromEntries([3006, 3007, 3008].map(port => [port, {
    ...orphanClaim, port, service: "indexer", compatibilityKey: "indexer:local-live",
  }]));
  const processes = [{ ...orphanProcess, name: "indexer" }];
  assert.equal(findOrphanedApps([{ name: "indexer" }], claims, processes, () => false).length, 1);
  claims[3008].ownerId = "another-owner";
  assert.throws(() => findOrphanedApps([{ name: "indexer" }], claims, processes, () => false), /Cannot verify/);
});

test("default launch starts local app services and keeps extras opt-in", () => {
  const parse = (...args) => parseArgs(["node", "stack.js", ...args]);
  assert.deepEqual(parse().names, ["admin", "client", "agent", "indexer"]);
  assert.deepEqual(parse("fork").names, ["anvil-arbitrum", "admin", "client", "agent", "indexer"]);
  assert.ok(!parse("full").names.includes("anvil-arbitrum"));
  assert.equal(parse().group, "local");
  assert.ok(parse("full").names.includes("storybook"));
  assert.ok(parse("full").names.includes("docs"));
  assert.ok(!parse("full").names.includes("tunnel"));
  assert.ok(!parse("web").names.includes("tunnel"));
  assert.equal(parse("unknown").mode, "error");
});

test("an indexer that exited before log subscription fails readiness immediately", async () => {
  let probes = 0;
  const ready = await reportReadiness([{ name: "indexer" }], {
    processes: async () => [{ name: "indexer", pm2_env: { status: "stopped" } }],
    probe: async () => { probes++; return false; },
  });
  assert.equal(ready, false);
  assert.equal(probes, 0);
});

test("readiness ignores an exited helper and checks every indexer port", async () => {
  const ports = [];
  const ready = await reportReadiness([{ name: "indexer" }, { name: "browser" }], {
    processes: async () => [{ name: "browser", pm2_env: { status: "stopped" } }],
    probe: async (port) => { ports.push(port); return true; },
  });
  assert.equal(ready, true);
  assert.deepEqual(ports, [3006, 3007, 3008]);
});

test("readiness rejects a partially started indexer at the deadline", async () => {
  assert.equal(await reportReadiness([{ name: "indexer" }], {
    probe: async (port) => port === 3008,
    timeoutMs: 0,
  }), false);
});

test("local startup checks data readiness and preserves a failed smoke result", async () => {
  const calls = [];
  const ready = await runStartupSmoke("local", (_binary, args) => {
    calls.push(args);
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("exit", 1, null));
    return child;
  });
  assert.equal(ready, false);
  assert.match(calls[0][0], /smoke-full\.js$/);
  assert.deepEqual(calls[0].slice(1), ["--core"]);
});

test("a smoke process that cannot start never reports QA readiness", async () => {
  assert.equal(await runStartupSmoke("local", () => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("error", new Error("spawn failed")));
    return child;
  }), false);
});


test("live profiles override stale fork settings and use the local agent and indexer", () => {
  for (const group of ["local", "full", "web", ""]) {
    for (const name of ["client", "admin", "agent"]) {
      const { env } = applyGroupEnvironment({ name, env: {
        VITE_DEV_CHAIN_MODE: "arbitrum_fork", VITE_CHAIN_ID: "31337",
        VITE_LOCAL_FORK_RPC_URL: "http://127.0.0.1:3009", VITE_ENABLE_ANVIL_WALLETS: "true",
        ARBITRUM_RPC_URL: "http://127.0.0.1:3009",
        VITE_API_BASE_URL: "https://agent.greengoods.app", VITE_ENVIO_INDEXER_URL: "https://hosted.example/graphql",
      } }, group);
      assert.equal(env.VITE_DEV_CHAIN_MODE, "");
      assert.equal(env.VITE_CHAIN_ID, "42161");
      assert.equal(env.VITE_LOCAL_FORK_RPC_URL, "");
      assert.equal(env.VITE_ENABLE_ANVIL_WALLETS, "false");
      assert.equal(env.ARBITRUM_RPC_URL, "https://arb1.arbitrum.io/rpc");
      assert.equal(env.VITE_API_BASE_URL, "http://127.0.0.1:3005");
      assert.equal(env.VITE_ENVIO_INDEXER_URL, "http://localhost:3006/v1/graphql");
    }
  }
});

test("fork must be explicit and cannot reuse live or legacy local services", () => {
  const { env } = applyGroupEnvironment({ name: "client" }, "fork");
  assert.equal(env.VITE_DEV_CHAIN_MODE, "arbitrum_fork");
  assert.equal(env.VITE_LOCAL_FORK_RPC_URL, "http://127.0.0.1:3009");
  assert.equal(env.VITE_ENABLE_ANVIL_WALLETS, "true");
  assert.notEqual(compatibilityKey("local", "client"), "client:local");
  assert.notEqual(compatibilityKey("local", "client"), compatibilityKey("fork", "client"));
});

test("optional hosted profiles retain their agent and indexer routing", () => {
  const hosted = applyGroupEnvironment({ name: "client" }, "prod").env;
  const mirror = applyGroupEnvironment({ name: "client" }, "prod-mirror").env;
  assert.equal(hosted.VITE_API_BASE_URL, "https://agent.greengoods.app");
  assert.equal(mirror.VITE_API_BASE_URL, hosted.VITE_API_BASE_URL);
  assert.equal(mirror.VITE_ENVIO_INDEXER_URL, "http://localhost:3006/v1/graphql");
  assert.notEqual(hosted.VITE_ENVIO_INDEXER_URL, mirror.VITE_ENVIO_INDEXER_URL);
});

test("fork startup explicitly requests fork-only smoke checks", async () => {
  const calls = [];
  await runStartupSmoke("fork", (_binary, args) => {
    calls.push(args);
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("exit", 0, null));
    return child;
  });
  assert.deepEqual(calls[0].slice(1), ["--core", "--fork"]);
});


test("restarting live dev recovers the old fork stack, including Anvil", () => {
  const ports = { admin: [3002], client: [3001], agent: [3005], indexer: [3006, 3007, 3008], "anvil-arbitrum": [3009] };
  const apps = Object.keys(ports).map(name => ({ name }));
  const claims = Object.fromEntries(apps.flatMap(({ name }) => ports[name].map(port => [port, {
    ...orphanClaim, port, service: name, compatibilityKey: `${name}:local`,
  }])));
  const processes = apps.map(({ name }) => ({ ...orphanProcess, name }));
  assert.deepEqual(findOrphanedApps(apps, claims, processes, () => false),
    apps.map(({ name }) => ({ name, ownerId: "old-qa", ports: ports[name] })));
  assert.deepEqual(findOrphanedApps(apps, claims, processes, () => true), []);
});
