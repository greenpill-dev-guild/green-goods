#!/usr/bin/env node

/**
 * Start or stop PM2-backed development stacks.
 *
 * Usage:
 *   node scripts/dev/stack.js                 # default: local app services
 *   node scripts/dev/stack.js full            # local services + docs, Storybook, browser
 *   node scripts/dev/stack.js web             # client, admin, docs, storybook, browser
 *   node scripts/dev/stack.js status          # inspect port/service ownership
 *   node scripts/dev/stack.js stop            # stop services owned by GREEN_GOODS_DEV_OWNER
 *   node scripts/dev/stack.js client admin    # custom subset (any app name from ecosystem.config.cjs)
 */

import net from "node:net";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { assertDockerReady, dockerEnvironment } from "../lib/dev-shared.js";
import {
  claimSurface,
  inspectSurface,
  isProcessAlive,
  readLeaseStore,
  releaseOwnerClaims,
  releaseSurface,
  withStartupLock,
} from "./surface-leases.mjs";

const require = createRequire(import.meta.url);
const pm2 = require("pm2");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const PRODUCTION_INDEXER_URL = "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";
const PRODUCTION_AGENT_URL = "https://agent.greengoods.app";
const LOCAL_INDEXER_URL = "http://localhost:3006/v1/graphql";
const ARBITRUM_PUBLIC_RPC_URL = "https://arb1.arbitrum.io/rpc";

const groups = {
  local: ["admin", "client", "agent", "indexer"],
  fork: ["anvil-arbitrum", "admin", "client", "agent", "indexer"],
  web: ["docs", "admin", "client", "storybook", "browser"],
  full: ["docs", "admin", "client", "agent", "indexer", "storybook", "browser"],
  prod: ["docs", "admin", "client", "storybook", "browser"],
  "prod-mirror": ["docs", "admin", "client", "indexer", "storybook", "browser"],
};

const validNames = new Set([...Object.values(groups).flat(), "tunnel"]);

// Apps that bind to a TCP port we can probe for readiness. Other apps (tunnel,
// browser) finish their work without listening on a deterministic port.
const portsByApp = {
  "anvil-arbitrum": [3009],
  client: [3001],
  admin: [3002],
  docs: [3003],
  storybook: [3004],
  agent: [3005],
  indexer: [3006, 3007, 3008],
};

const forbiddenPortsByGroup = {
  local: [3009],
  full: [3009],
  web: [3009],
  prod: [3005, 3006, 3007, 3008, 3009],
  "prod-mirror": [3005, 3009],
};

export function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    return { mode: "help" };
  }

  if (args.length === 0) {
    return { mode: "group", group: "local", names: groups.local };
  }

  if (args.length === 1 && args[0] === "stop") {
    return { mode: "stop" };
  }

  if (args.length === 1 && args[0] === "status") {
    return { mode: "status" };
  }

  if (args.length === 1 && groups[args[0]]) {
    return { mode: "group", group: args[0], names: groups[args[0]] };
  }

  const unknown = args.filter((name) => !validNames.has(name));
  if (unknown.length > 0) {
    return { mode: "error", message: `Unknown app(s): ${unknown.join(", ")}` };
  }

  return { mode: "custom", names: args };
}

function usage(stream = process.stdout) {
  stream.write(
    [
      "Usage: node scripts/dev/stack.js [<group>|<app>...|status|stop]",
      "",
      "Groups:",
      ...Object.entries(groups).map(([name, apps]) => `  ${name.padEnd(11)} ${apps.join(", ")}`),
      "",
      `Apps: ${[...validNames].join(", ")}`,
      "",
      "Set GREEN_GOODS_DEV_OWNER to a stable agent/session ID when detached stop authority is needed.",
      "",
    ].join("\n")
  );
}

function connect() {
  return new Promise((resolve, reject) => {
    pm2.connect((error) => (error ? reject(error) : resolve()));
  });
}

function disconnect() {
  try {
    pm2.disconnect();
  } catch {
    // PM2 disconnect is best-effort during shutdown.
  }
}

function deleteApps(names) {
  const uniqueNames = [...new Set(names)];
  return Promise.all(
    uniqueNames.map(
      (name) =>
        new Promise((resolve) => {
          pm2.delete(name, (error) => resolve({ name, error: error || null }));
        })
    )
  );
}

function listPm2Apps() {
  return new Promise((resolve, reject) => {
    pm2.list((error, processes) => (error ? reject(error) : resolve(processes || [])));
  });
}

function pm2Owner(processDescription) {
  return processDescription?.pm2_env?.GREEN_GOODS_DEV_OWNER || "";
}

async function assertAppsReplaceable(names, ownerId) {
  const requested = new Set(names);
  const conflicts = (await listPm2Apps()).filter(
    (processDescription) =>
      requested.has(processDescription.name) && pm2Owner(processDescription) !== ownerId
  );

  if (conflicts.length === 0) return;
  throw new Error(
    `PM2 app ownership conflict: ${conflicts
      .map((processDescription) =>
        `${processDescription.name} (${pm2Owner(processDescription) || "legacy/unknown owner"})`
      )
      .join(", ")}. Reuse the live surface or stop it from its owning session.`
  );
}

async function deleteOwnedApps(names, ownerId) {
  const requested = new Set(names);
  const ownedNames = (await listPm2Apps())
    .filter(
      (processDescription) =>
        requested.has(processDescription.name) && pm2Owner(processDescription) === ownerId
    )
    .map((processDescription) => processDescription.name);
  // Keep PM2 ownership records until Docker teardown succeeds. If Docker is
  // temporarily unavailable, the next launch can still verify and recover them.
  // Compose's foreground process alone does not guarantee PostgreSQL stops.
  if (ownedNames.includes("indexer")) stopIndexerContainers();
  const results = await deleteApps(ownedNames);
  const failures = results.filter((result) => result.error);
  if (failures.length > 0) {
    throw new Error(
      `Failed to stop owned PM2 app(s): ${failures.map((result) => result.name).join(", ")}`
    );
  }
  return results.map((result) => result.name);
}

function stopIndexerContainers() {
  const cwd = path.join(projectRoot, "packages/indexer");
  const env = dockerEnvironment();
  const compose = ["compose", "-f", path.join(cwd, "docker-compose.indexer.yaml")];
  const run = (args) => execFileSync("docker", args, {
    cwd, env, encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"],
  });
  const ids = run([...compose, "ps", "--all", "--quiet"]).trim().split(/\s+/).filter(Boolean);
  if (ids.length === 0) return;
  const labels = run(["inspect", "--format", "{{json .Config.Labels}}", ...ids])
    .trim().split("\n").map((line) => JSON.parse(line));
  if (labels.some((label) => label["com.docker.compose.project.working_dir"] !== cwd)) {
    throw new Error("Refusing to stop indexer containers belonging to another checkout.");
  }
  run([...compose, "down"]);
}

export function findOrphanedApps(apps, claims, processes, processAlive = isProcessAlive) {
  // Profile compatibility controls reuse; recovery only stops verified dead owners.
  const orphaned = [];
  for (const app of apps) {
    const ports = portsByApp[app.name] || [];
    const appClaims = ports.map((port) => claims[port]).filter(Boolean);
    if (appClaims.length === 0 || appClaims.some((claim) => processAlive(claim.ownerPid))) continue;
    const matching = processes.filter((entry) => entry.name === app.name);
    if (matching.length === 0) continue; // Ordinary claims still reject an unknown live listener.
    const entry = matching[0];
    const ownerId = appClaims[0].ownerId;
    if (matching.length !== 1 || appClaims.length !== ports.length ||
      appClaims.some((claim) => claim.ownerId !== ownerId || claim.service !== app.name) ||
      pm2Owner(entry) !== ownerId || path.resolve(entry.pm2_env?.pm_cwd || "/") !== projectRoot) {
      throw new Error(`Cannot verify orphaned ${app.name} ownership; leaving its processes untouched.`);
    }
    orphaned.push({ name: app.name, ownerId, ports });
  }
  return orphaned;
}

async function recoverOrphanedApps(apps) {
  const orphaned = findOrphanedApps(apps, readLeaseStore().claims, await listPm2Apps());
  for (const app of orphaned) {
    console.log(`[stack] recovering ${app.name} left by exited launcher ${app.ownerId}.`);
    await deleteOwnedApps([app.name], app.ownerId);
    for (const port of app.ports) {
      if (await portIsLive(port)) {
        throw new Error(`${app.name}:${port} is still occupied after stopping its verified PM2 service; leaving the listener untouched.`);
      }
    }
    await releaseClaims(app.ports, app.ownerId);
  }
}

function startApps(apps) {
  return new Promise((resolve, reject) => {
    pm2.start(apps, (error) => (error ? reject(error) : resolve()));
  });
}

function launchBus() {
  return new Promise((resolve, reject) => {
    pm2.launchBus((error, bus) => (error ? reject(error) : resolve(bus)));
  });
}

function writeLog(packet, stream) {
  const name = packet?.process?.name || "pm2";
  const data = `${packet?.data || ""}`.trimEnd();
  if (!data) return;
  stream.write(`[${name}] ${data}\n`);
}

function probePort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };
    socket.once("connect", () => {
      cleanup();
      resolve(true);
    });
    socket.once("error", () => {
      cleanup();
      resolve(false);
    });
    socket.setTimeout(2000, () => {
      cleanup();
      resolve(false);
    });
  });
}

async function portIsLive(port) {
  const checks = await Promise.all(
    ["127.0.0.1", "::1"].map((host) => probePort(port, host))
  );
  return checks.some(Boolean);
}

function ownerIdForLaunch() {
  const explicit = (process.env.GREEN_GOODS_DEV_OWNER || "").trim();
  return explicit || `stack:${process.pid}:${randomUUID().slice(0, 8)}`;
}

export function compatibilityKey(group, appName) {
  // The old :local key described a fork. Never reuse those processes for live writes.
  const profile = ["prod", "prod-mirror", "fork"].includes(group) ? group : "local-live";
  return `${appName}:${profile}`;
}

function surfaceEntries() {
  return Object.entries(portsByApp)
    .flatMap(([service, ports]) => ports.map((port) => ({ service, port })))
    .sort((left, right) => left.port - right.port);
}

function claimDescription(claim) {
  if (!claim) return "external/unknown listener";
  return `${claim.service} (${claim.compatibilityKey}) owned by ${claim.ownerId} pid ${claim.ownerPid}`;
}

async function printSurfaceStatus() {
  console.log("Green Goods dev-surface ownership");
  for (const { service, port } of surfaceEntries()) {
    const live = await portIsLive(port);
    const inspection = inspectSurface({ port, portLive: live });
    console.log(
      `- ${port} ${service}: ${inspection.state}${
        inspection.claim ? `; ${claimDescription(inspection.claim)}` : ""
      }`
    );
  }
}

async function assertForbiddenPortsFree(group) {
  for (const port of forbiddenPortsByGroup[group] || []) {
    const live = await portIsLive(port);
    const inspection = inspectSurface({ port, portLive: live });
    if (!live && ["free", "stale"].includes(inspection.state)) continue;
    throw new Error(
      `${group} profile requires port ${port} to stay free, but it is ${inspection.state}: ${claimDescription(inspection.claim)}.`
    );
  }
}

async function releaseClaims(ports, ownerId) {
  for (const port of [...new Set(ports)]) {
    const result = releaseSurface({ port, ownerId });
    if (result.status === "not-owner") {
      console.error(
        `[stack] did not release port ${port}; it belongs to ${result.claim.ownerId}.`
      );
    }
  }
}

async function claimApps(apps, group, ownerId) {
  await assertForbiddenPortsFree(group);

  const appsToStart = [];
  const reusedApps = [];
  const skippedHelpers = [];
  const claimedPorts = [];
  const helperApps = [];

  try {
    for (const app of apps) {
      const ports = portsByApp[app.name] || [];
      if (ports.length === 0) {
        helperApps.push(app);
        continue;
      }

      const results = [];
      for (const port of ports) {
        const result = claimSurface({
          port,
          service: app.name,
          compatibilityKey: compatibilityKey(group, app.name),
          ownerId,
          ownerPid: process.pid,
          portLive: await portIsLive(port),
        });
        results.push({ port, ...result });
        if (result.status === "claimed") {
          claimedPorts.push(port);
          if (result.staleRemoved) {
            console.log(`[stack] replaced stale ${app.name} claim on port ${port}.`);
          }
        }
      }

      const conflict = results.find((result) => result.status === "conflict");
      if (conflict) {
        throw new Error(
          `${app.name}:${conflict.port} lease conflict (${conflict.reason}): ${claimDescription(conflict.claim)}.`
        );
      }

      const reusable = results.every((result) =>
        ["reused", "owned-live"].includes(result.status)
      );
      const startable = results.every((result) => ["claimed", "owned"].includes(result.status));
      if (reusable) {
        reusedApps.push(app);
        continue;
      }
      if (startable) {
        appsToStart.push(app);
        continue;
      }

      throw new Error(
        `${app.name} has a partial surface: ${results
          .map((result) => `${result.port}=${result.status}`)
          .join(", ")}. Refusing to start over a mixed owner state.`
      );
    }

    if (reusedApps.length > 0) {
      skippedHelpers.push(...helperApps);
    } else {
      appsToStart.push(...helperApps);
    }
  } catch (error) {
    await releaseClaims(claimedPorts, ownerId);
    throw error;
  }

  return { appsToStart, reusedApps, skippedHelpers, claimedPorts };
}

export async function reportReadiness(apps, {
  processes,
  probe = portIsLive,
  // A cold Docker install/export can exceed three minutes; exited processes
  // still fail on the next poll instead of consuming this build allowance.
  timeoutMs = apps.some((app) => app.name === "indexer") ? 600_000 : 90_000,
  pollMs = 500,
} = {}) {
  const pending = apps.flatMap((app) =>
    (portsByApp[app.name] || []).map((port) => ({ name: app.name, port }))
  );
  const total = pending.length;
  const start = Date.now();
  const ready = [];
  while (pending.length > 0) {
    // Inspect once per poll, including apps that exited before the PM2 bus attached.
    const states = processes ? await processes() : [];
    const failed = states.filter((app) =>
      apps.some((requested) => requested.name === app.name && portsByApp[app.name]) &&
      ["stopped", "errored"].includes(app.pm2_env?.status)
    );
    if (failed.length > 0) {
      console.error(`[stack] startup failed: ${failed.map((app) => app.name).join(", ")} exited.`);
      for (const app of failed) {
        if (app.pm2_env?.pm_err_log_path) console.error(`[stack] ${app.name} error log: ${app.pm2_env.pm_err_log_path}`);
      }
      return false;
    }
    const checks = await Promise.all(pending.map(async (item) => ({ ...item, live: await probe(item.port) })));
    for (let index = checks.length - 1; index >= 0; index--) {
      if (checks[index].live) ready.push(...pending.splice(index, 1));
    }
    if (pending.length === 0) break;
    if (Date.now() - start >= timeoutMs) {
      console.error(`[stack] startup timed out: ${pending.map((item) => `${item.name}:${item.port}`).join(", ")}.`);
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  console.log(`[stack] all ${total} service ports ready in ${((Date.now() - start) / 1000).toFixed(1)}s.`);
  for (const item of ready.sort((a, b) => a.port - b.port)) {
    const url = { 3001: "https://localhost:3001", 3002: "https://localhost:3002", 3003: "http://localhost:3003", 3004: "http://localhost:3004" }[item.port];
    if (url) console.log(`[stack] ${item.name}: ${url}`);
  }
  return true;
}

function productionProfileEnv(group) {
  const fork = group === "fork";
  const hostedAgent = group === "prod" || group === "prod-mirror";
  return {
    APP_ENV: "development",
    NODE_ENV: "development",
    GREEN_GOODS_STACK_PROFILE: group || "local",
    GREEN_GOODS_DEV_CHAIN_MODE: "",
    VITE_CHAIN_ID: "42161",
    VITE_DEV_CHAIN_MODE: fork ? "arbitrum_fork" : "",
    VITE_LOCAL_FORK_RPC_URL: fork ? "http://127.0.0.1:3009" : "",
    ARBITRUM_RPC_URL: fork ? "http://127.0.0.1:3009" : ARBITRUM_PUBLIC_RPC_URL,
    VITE_ENABLE_ANVIL_WALLETS: String(fork),
    VITE_ENVIO_INDEXER_URL: group === "prod" ? PRODUCTION_INDEXER_URL : LOCAL_INDEXER_URL,
    VITE_API_BASE_URL: hostedAgent ? PRODUCTION_AGENT_URL : "http://127.0.0.1:3005",
  };
}

export function applyGroupEnvironment(app, group) {
  const env = productionProfileEnv(group);
  return {
    ...app,
    env: {
      ...(app.env || {}),
      ...env,
    },
  };
}

function printProductionModeNotice(group) {
  if (group === "fork") return;

  const indexerMode =
    group === "prod" ? "hosted production indexer" : "local live-indexer mirror on localhost:3006";

  console.log("");
  console.log("[stack] Production-backed Green Goods dev mode is active.");
  console.log(`[stack] Chain: Arbitrum One (42161); indexer: ${indexerMode}.`);
  console.log(`[stack] Agent API: ${productionProfileEnv(group).VITE_API_BASE_URL}.`);
  console.log(
    "[stack] Connected wallet transactions are real Arbitrum writes and can spend funds."
  );
  console.log("[stack] The automatic smoke is read-only and never submits transactions.");
  console.log("");
}

function smokeModeForGroup(group) {
  if (group === "prod") return "prod";
  if (group === "prod-mirror") return "mirror";
  return "";
}

export function runStartupSmoke(group, spawnProcess = spawn) {
  const smokeMode = smokeModeForGroup(group);
  const isLocal = ["local", "full", "fork"].includes(group);
  if (!smokeMode && !isLocal) return Promise.resolve(true);

  const scriptPath = path.join(projectRoot, isLocal ? "scripts/dev/smoke-full.js" : "scripts/dev/smoke-prod.js");
  const args = isLocal
    ? [...(group === "full" ? [] : ["--core"]), ...(group === "fork" ? ["--fork"] : [])]
    : ["--mode", smokeMode];
  const label = isLocal ? "local QA" : "production";
  return new Promise((resolve) => {
    console.log(`[stack] checking ${label} readiness, including Arbitrum indexer progress...`);
    const child = spawnProcess(process.execPath, [scriptPath, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...productionProfileEnv(group),
      },
      stdio: "inherit",
    });

    child.on("error", (error) => {
      console.error(`[stack] ${label} smoke failed to start: ${error.message}`);
      resolve(false);
    });
    child.on("exit", (code, signal) => {
      if (code === 0) {
        console.log(`[stack] ${label} smoke passed; environment ready for QA.`);
      } else {
        console.error(
          `[stack] NOT READY FOR QA: ${label} smoke failed (${signal ? `signal ${signal}` : `exit ${code}`}); services remain running so indexing can continue.${isLocal ? " Rerun bun run dev:smoke after resolving the reported failures." : ""}`
        );
      }
      resolve(code === 0);
    });
  });
}

let shutdownStarted = false;
async function stopAndExit(names, ownerId, claimedPorts, exitCode = 0) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  try {
    await deleteOwnedApps(names, ownerId);
    await releaseClaims(claimedPorts, ownerId);
    disconnect();
    process.exit(exitCode);
  } catch (error) {
    disconnect();
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function main() {
  process.chdir(projectRoot);

  const parsed = parseArgs(process.argv);

  if (parsed.mode === "help") {
    usage();
    return;
  }

  if (parsed.mode === "error") {
    console.error(parsed.message);
    usage(process.stderr);
    process.exitCode = 1;
    return;
  }

  if (parsed.mode === "status") {
    await printSurfaceStatus();
    return;
  }

  // Load credentials only when launching/stopping, never on import, help, or status.
  const allApps = require(path.join(projectRoot, "ecosystem.config.cjs")).apps || [];

  if (parsed.mode === "stop") {
    const ownerId = (process.env.GREEN_GOODS_DEV_OWNER || "").trim();
    if (!ownerId) {
      throw new Error(
        "Refusing an ownerless stop. Use Ctrl+C in the launching terminal, or rerun with the same GREEN_GOODS_DEV_OWNER used to start the stack."
      );
    }
    await connect();
    await deleteOwnedApps(
      allApps.map((app) => app.name),
      ownerId
    );
    const released = releaseOwnerClaims({ ownerId });
    disconnect();
    console.log(
      `Stopped Green Goods dev services owned by ${ownerId}; released ${released.length} claim(s).`
    );
    return;
  }

  const group = parsed.mode === "group" ? parsed.group : "";
  const apps = allApps
    .filter((app) => parsed.names.includes(app.name))
    .map((app) => applyGroupEnvironment(app, group));
  if (apps.length === 0) {
    throw new Error(`No PM2 apps matched: ${parsed.names.join(", ")}`);
  }

  const dockerEnv = dockerEnvironment();
  if (apps.some((app) => app.name === "indexer")) assertDockerReady(dockerEnv);

  const ownerId = ownerIdForLaunch();
  await connect();
  const { ownedApps, reusedApps, skippedHelpers, claimedPorts } = await withStartupLock(async () => {
    // Retire verified orphans from the previous profile, including its Anvil process.
    await recoverOrphanedApps(allApps);
    const claims = await claimApps(apps, group, ownerId);
    const ownedApps = claims.appsToStart.map((app) => ({
      ...app,
      env: { ...dockerEnv, ...(app.env || {}), GREEN_GOODS_DEV_OWNER: ownerId },
    }));
    try {
      await assertAppsReplaceable(ownedApps.map((app) => app.name), ownerId);
      await deleteOwnedApps(ownedApps.map((app) => app.name), ownerId);
      if (ownedApps.length > 0) await startApps(ownedApps);
    } catch (error) {
      await deleteOwnedApps(ownedApps.map((app) => app.name), ownerId);
      await releaseClaims(claims.claimedPorts, ownerId);
      throw error;
    }
    return { ...claims, ownedApps };
  });

  if (reusedApps.length > 0) {
    console.log(
      `[stack] reusing compatible live services: ${reusedApps.map((app) => app.name).join(", ")}`
    );
  }
  if (skippedHelpers.length > 0) {
    console.log(
      `[stack] skipping unowned helpers while reusing services: ${skippedHelpers.map((app) => app.name).join(", ")}`
    );
  }

  if (ownedApps.length === 0) {
    console.log(`[stack] all requested services are already live; owner remains unchanged.`);
    const ready = await reportReadiness(apps);
    if (ready) await runStartupSmoke(group);
    disconnect();
    return;
  }

  const label = parsed.mode === "group" ? `${parsed.group} stack` : "custom stack";
  console.log(`Started Green Goods ${label}: ${ownedApps.map((app) => app.name).join(", ")}`);
  console.log(`[stack] lease owner: ${ownerId}`);
  printProductionModeNotice(group);
  console.log("Press Ctrl+C to stop services.\n");

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => stopAndExit(ownedApps.map((app) => app.name), ownerId, claimedPorts));
  }

  const bus = await launchBus();
  bus.on("log:out", (packet) => writeLog(packet, process.stdout));
  bus.on("log:err", (packet) => writeLog(packet, process.stderr));
  bus.on("process:event", (packet) => {
    if (!packet?.event || !packet?.process?.name) return;
    console.log(`[pm2] ${packet.process.name} ${packet.event}`);
  });

  // Run readiness probe in the background so logs flow uninterrupted.
  reportReadiness(apps, { processes: listPm2Apps }).then(async (ready) => {
    if (ready) await runStartupSmoke(group);
    else await stopAndExit(ownedApps.map((app) => app.name), ownerId, claimedPorts, 1);
  }).catch(async (error) => {
    console.error(`[stack] readiness probe failed: ${error.message}`);
    await stopAndExit(ownedApps.map((app) => app.name), ownerId, claimedPorts, 1);
  });

  await new Promise(() => {});
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main().catch((error) => {
  disconnect();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
