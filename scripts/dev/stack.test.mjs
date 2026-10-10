import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { EventEmitter } from "node:events";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyGroupEnvironment, compatibilityKey, connectionMismatches, findOrphanedApps, launchConnections, parseArgs, productionModeNotice, reportReadiness, runStartupSmoke } from "./stack.js";
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

test("recovery reclaims a detached indexer from a partial stale lease", () => {
  const claims = Object.fromEntries([3006, 3008].map(port => [port, {
    ...orphanClaim, port, service: "indexer", compatibilityKey: "indexer:local-live",
  }]));
  assert.deepEqual(findOrphanedApps([{ name: "indexer" }], claims, [], () => false), [{
    name: "indexer", ownerId: "old-qa", ports: [3006, 3007, 3008], detached: true,
  }]);
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

test("indexer recovery requires consistent ownership across its present claims", () => {
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

test("repository-managed client polling defaults on and honors an explicit override", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "green-goods-ecosystem-"));
  const configPath = path.join(fixture, "ecosystem.config.cjs");
  await copyFile(fileURLToPath(new URL("../../ecosystem.config.cjs", import.meta.url)), configPath);

  const readPolling = (value) => {
    const environment = value === undefined ? {} : { VITE_USE_POLLING: value };
    return execFileSync(
      process.execPath,
      [
        "-e",
        `const config = require(${JSON.stringify(configPath)}); ` +
          `process.stdout.write(config.apps.find((app) => app.name === "client").env.VITE_USE_POLLING);`,
      ],
      { encoding: "utf8", env: environment }
    );
  };

  try {
    assert.equal(readPolling(undefined), "true");
    assert.equal(readPolling("false"), "false");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("disabled local Vite connections replace inherited values with non-local settings", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "green-goods-ecosystem-"));
  const configPath = path.join(fixture, "ecosystem.config.cjs");
  await copyFile(fileURLToPath(new URL("../../ecosystem.config.cjs", import.meta.url)), configPath);

  const output = execFileSync(
    process.execPath,
    [
      "-e",
      `const config = require(${JSON.stringify(configPath)}); ` +
        `process.stdout.write(JSON.stringify(config.apps.find((app) => app.name === "client").env));`,
    ],
    {
      encoding: "utf8",
      env: {
        VITE_DISABLE_LOCAL_CHAIN: "true",
        VITE_DISABLE_LOCAL_AGENT: "true",
        VITE_DEV_CHAIN_MODE: "arbitrum_fork",
        VITE_CHAIN_ID: "31337",
        VITE_LOCAL_FORK_RPC_URL: "http://127.0.0.1:3009",
        VITE_ENABLE_ANVIL_WALLETS: "true",
        VITE_API_BASE_URL: "http://127.0.0.1:3005",
      },
    }
  );

  try {
    const env = JSON.parse(output);
    assert.equal(env.VITE_DEV_CHAIN_MODE, "");
    assert.equal(env.VITE_CHAIN_ID, "11155111");
    assert.equal(env.VITE_LOCAL_FORK_RPC_URL, "");
    assert.equal(env.VITE_ENABLE_ANVIL_WALLETS, "false");
    assert.equal(env.VITE_API_BASE_URL, "https://agent.greengoods.app");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("disabling the local agent ignores a loopback agent URL from the root env file", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "green-goods-ecosystem-"));
  const configPath = path.join(fixture, "ecosystem.config.cjs");
  await copyFile(fileURLToPath(new URL("../../ecosystem.config.cjs", import.meta.url)), configPath);

  // Setup's baseline root env file names the local agent; only a real remote URL replaces it.
  const readAgentUrl = async (rootValue) => {
    await writeFile(path.join(fixture, ".env"), `VITE_API_BASE_URL=${rootValue}\n`);
    return execFileSync(
      process.execPath,
      [
        "-e",
        `const config = require(${JSON.stringify(configPath)}); ` +
          `process.stdout.write(config.apps.find((app) => app.name === "client").env.VITE_API_BASE_URL);`,
      ],
      { encoding: "utf8", env: { VITE_DISABLE_LOCAL_AGENT: "true" } }
    );
  };

  try {
    for (const loopback of [
      "http://127.0.0.1:3005",
      "http://localhost:3005",
      "http://localhost.:3005",
      "http://[::ffff:127.0.0.1]:3005",
      "http://[::]:3005",
    ]) {
      assert.equal(await readAgentUrl(loopback), "https://agent.greengoods.app", loopback);
    }
    assert.equal(await readAgentUrl("https://agent.staging.example"), "https://agent.staging.example");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
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


test("live profiles preserve the configured indexer while overriding stale fork settings", () => {
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
      assert.equal(env.VITE_ENVIO_INDEXER_URL, "https://hosted.example/graphql");
    }
  }
});

test("disabled local Vite connections survive the final stack profile merge", () => {
  for (const group of ["local", "fork", "full", "web", "prod", "prod-mirror", ""]) {
    const { env } = applyGroupEnvironment(
      {
        name: "client",
        env: {
          VITE_DISABLE_LOCAL_CHAIN: "true",
          VITE_DISABLE_LOCAL_AGENT: "true",
          VITE_DEV_CHAIN_MODE: "",
          VITE_CHAIN_ID: "11155111",
          VITE_LOCAL_FORK_RPC_URL: "",
          VITE_ENABLE_ANVIL_WALLETS: "false",
          VITE_API_BASE_URL: "https://agent.greengoods.app",
        },
      },
      group
    );
    assert.equal(env.VITE_DEV_CHAIN_MODE, "");
    assert.equal(env.VITE_CHAIN_ID, "11155111");
    assert.equal(env.VITE_LOCAL_FORK_RPC_URL, "");
    assert.equal(env.VITE_ENABLE_ANVIL_WALLETS, "false");
    assert.equal(env.VITE_API_BASE_URL, "https://agent.greengoods.app");
  }
});

test("fork keeps its local indexer even when a hosted indexer is configured", () => {
  const { env } = applyGroupEnvironment(
    { name: "client", env: { VITE_ENVIO_INDEXER_URL: "https://hosted.example/v1/graphql" } },
    "fork"
  );
  assert.equal(env.VITE_ENVIO_INDEXER_URL, "http://localhost:3006/v1/graphql");
});

const launchClient = (env, group = "local") => [applyGroupEnvironment({ name: "client", env }, group)];

test("the startup notice reports the connections the apps received", () => {
  assert.deepEqual(productionModeNotice("prod").slice(1, 4), [
    "[stack] Production-backed Green Goods dev mode is active.",
    "[stack] Chain: Arbitrum One (42161); indexer: hosted production indexer.",
    "[stack] Agent API: https://agent.greengoods.app.",
  ]);

  const local = launchConnections(launchClient({ VITE_ENVIO_INDEXER_URL: "http://localhost:3006/v1/graphql" }), "local");
  assert.deepEqual(local.customKeys, []);
  assert.equal(
    productionModeNotice("local", local)[2],
    "[stack] Chain: Arbitrum One (42161); indexer: local live-indexer mirror on localhost:3006."
  );

  const hosted = launchConnections(launchClient({ VITE_ENVIO_INDEXER_URL: "https://hosted.example/v1/graphql?key=private" }), "local");
  assert.deepEqual(hosted.customKeys, ["VITE_ENVIO_INDEXER_URL"]);
  const hostedNotice = productionModeNotice("local", hosted).join("\n");
  assert.match(hostedNotice, /indexer: configured indexer at https:\/\/hosted\.example\./);
  assert.doesNotMatch(hostedNotice, /key=private|localhost:3006/);

  const sepolia = launchConnections(launchClient({
    VITE_DISABLE_LOCAL_CHAIN: "true", VITE_DISABLE_LOCAL_AGENT: "true",
    VITE_DEV_CHAIN_MODE: "", VITE_CHAIN_ID: "11155111", VITE_LOCAL_FORK_RPC_URL: "",
    VITE_ENABLE_ANVIL_WALLETS: "false", VITE_ENVIO_INDEXER_URL: "http://localhost:3006/v1/graphql",
    VITE_API_BASE_URL: "https://agent.greengoods.app",
  }), "local");
  assert.deepEqual(sepolia.customKeys, ["VITE_CHAIN_ID", "VITE_API_BASE_URL"]);
  assert.deepEqual(productionModeNotice("local", sepolia).slice(1, 5), [
    "[stack] Green Goods dev mode is active.",
    "[stack] Chain: chain 11155111; indexer: local live-indexer mirror on localhost:3006.",
    "[stack] Agent API: https://agent.greengoods.app.",
    "[stack] Connected wallet transactions are real onchain writes and can spend funds.",
  ]);
});

test("custom connections skip the startup smoke instead of certifying other services", async () => {
  const connections = launchConnections(launchClient({ VITE_ENVIO_INDEXER_URL: "https://hosted.example/v1/graphql" }), "local");
  let spawned = false;
  const ready = await runStartupSmoke("local", () => { spawned = true; }, connections);
  assert.equal(ready, false);
  assert.equal(spawned, false);
});

test("reuse is refused when a live service was started with different connections", () => {
  const [requested] = launchClient({ VITE_ENVIO_INDEXER_URL: "https://hosted.example/v1/graphql" });
  const running = (env) => [{ name: "client", pm2_env: { ...requested.env, ...env } }];
  assert.deepEqual(connectionMismatches([requested], running({})), []);
  assert.deepEqual(
    connectionMismatches([requested], running({
      VITE_ENVIO_INDEXER_URL: "http://localhost:3006/v1/graphql",
      VITE_API_BASE_URL: "https://agent.greengoods.app",
    })),
    ["client (VITE_ENVIO_INDEXER_URL, VITE_API_BASE_URL)"]
  );
  // Without a running process to compare, reuse is left to the lease contract.
  assert.deepEqual(connectionMismatches([requested], []), []);
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
