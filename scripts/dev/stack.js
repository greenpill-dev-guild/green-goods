#!/usr/bin/env node

/**
 * Start or stop PM2-backed development stacks.
 *
 * Usage:
 *   node scripts/dev/stack.js                 # default: full
 *   node scripts/dev/stack.js full            # every app in ecosystem.config.cjs
 *   node scripts/dev/stack.js web             # client, admin, docs, storybook, browser
 *   node scripts/dev/stack.js status          # inspect port/service ownership
 *   node scripts/dev/stack.js stop            # stop services owned by GREEN_GOODS_DEV_OWNER
 *   node scripts/dev/stack.js client admin    # custom subset (any app name from ecosystem.config.cjs)
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  claimSurface,
  inspectSurface,
  releaseOwnerClaims,
  releaseSurface,
} from "./surface-leases.mjs";

const require = createRequire(import.meta.url);
const pm2 = require("pm2");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const ecosystem = require(path.join(projectRoot, "ecosystem.config.cjs"));
const rootEnv = parseRootEnv();

const allApps = ecosystem.apps || [];
const validNames = new Set(allApps.map((app) => app.name));

const PRODUCTION_INDEXER_URL = "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";
const PRODUCTION_AGENT_URL = "https://agent.greengoods.app";
const LOCAL_INDEXER_URL = "http://localhost:3006/v1/graphql";
const ARBITRUM_PUBLIC_RPC_URL = "https://arb1.arbitrum.io/rpc";

function parseRootEnv() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return {};

  const env = {};
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function envValue(key, fallback = "") {
  return process.env[key] || rootEnv[key] || fallback;
}

const groups = {
  // `browser` waits on ports and opens tabs (PWA + website + admin + docs +
  // storybook). `tunnel` is a best-effort cloudflared launcher for both the
  // client and admin Vite servers — admin has a real mobile review surface, so
  // it ships in `web` alongside the client. Both apps are no-ops if their
  // prerequisites (Brave / cloudflared) aren't installed.
  web: ["docs", "admin", "client", "storybook", "browser", "tunnel"],
  full: allApps.map((app) => app.name),
  prod: ["docs", "admin", "client", "storybook", "browser"],
  "prod-mirror": ["docs", "admin", "client", "indexer", "storybook", "browser"],
};

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
  prod: [3005, 3006, 3007, 3008, 3009],
  "prod-mirror": [3005, 3009],
};

function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    return { mode: "help" };
  }

  if (args.length === 0) {
    return { mode: "group", group: "full", names: groups.full };
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
      `Apps: ${allApps.map((app) => app.name).join(", ")}`,
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
  const results = await deleteApps(ownedNames);
  const failures = results.filter((result) => result.error);
  if (failures.length > 0) {
    throw new Error(
      `Failed to stop owned PM2 app(s): ${failures.map((result) => result.name).join(", ")}`
    );
  }
  return results.map((result) => result.name);
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

async function waitForPort(port, timeoutMs, hosts = ["127.0.0.1", "::1"]) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const checks = await Promise.all(hosts.map((host) => probePort(port, host)));
    if (checks.some(Boolean)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
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

function compatibilityKey(group, appName) {
  const profile = group === "prod" || group === "prod-mirror" ? group : "local";
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

async function reportReadiness(apps) {
  const probed = apps
    .flatMap((app) =>
      (portsByApp[app.name] || []).map((port) => ({ name: app.name, port }))
    );

  if (probed.length === 0) {
    console.log("[stack] no port-binding apps in this group; skipping readiness probe.");
    return true;
  }

  const start = Date.now();
  // Indexer Docker rebuilds can take a while on cold start; give it more time.
  const timeoutMs = probed.some((item) => item.name === "indexer") ? 180_000 : 90_000;
  const results = await Promise.all(
    probed.map(async (item) => ({
      ...item,
      ready: await waitForPort(item.port, timeoutMs),
    }))
  );
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const ready = results.filter((item) => item.ready);
  const failed = results.filter((item) => !item.ready);

  if (failed.length === 0) {
    console.log(`[stack] all ${ready.length} services ready in ${elapsed}s.`);
    return true;
  }

  console.log(
    `[stack] ${ready.length}/${results.length} services ready in ${elapsed}s — failed: ${failed
      .map((item) => `${item.name}:${item.port}`)
      .join(", ")}`
  );
  return false;
}

function productionProfileEnv(group, appName) {
  if (group !== "prod" && group !== "prod-mirror") return {};

  if (group === "prod-mirror" && appName === "indexer") {
    return {
      NODE_ENV: "development",
      GREEN_GOODS_STACK_PROFILE: group,
      GREEN_GOODS_DEV_CHAIN_MODE: "",
      ARBITRUM_RPC_URL: envValue("ARBITRUM_RPC_URL", ARBITRUM_PUBLIC_RPC_URL),
    };
  }

  return {
    APP_ENV: "development",
    NODE_ENV: "development",
    GREEN_GOODS_STACK_PROFILE: group,
    VITE_CHAIN_ID: "42161",
    VITE_DEV_CHAIN_MODE: "",
    VITE_LOCAL_FORK_RPC_URL: "",
    VITE_ENABLE_ANVIL_WALLETS: "false",
    VITE_ENVIO_INDEXER_URL:
      group === "prod-mirror" ? LOCAL_INDEXER_URL : PRODUCTION_INDEXER_URL,
    VITE_API_BASE_URL: PRODUCTION_AGENT_URL,
  };
}

function applyGroupEnvironment(app, group) {
  const env = productionProfileEnv(group, app.name);
  if (Object.keys(env).length === 0) return app;
  return {
    ...app,
    env: {
      ...(app.env || {}),
      ...env,
    },
  };
}

function printProductionModeNotice(group) {
  if (group !== "prod" && group !== "prod-mirror") return;

  const indexerMode =
    group === "prod-mirror"
      ? "local live-indexer mirror on localhost:3006"
      : "hosted production indexer";

  console.log("");
  console.log("[stack] Production-backed Green Goods dev mode is active.");
  console.log(`[stack] Chain: Arbitrum One (42161); indexer: ${indexerMode}.`);
  console.log(`[stack] Agent API: ${PRODUCTION_AGENT_URL}.`);
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

function runProductionSmoke(group) {
  const smokeMode = smokeModeForGroup(group);
  if (!smokeMode) return Promise.resolve();

  const scriptPath = path.join(projectRoot, "scripts/dev/smoke-prod.js");
  return new Promise((resolve) => {
    console.log(`[stack] running production smoke (${smokeMode})...`);
    const child = spawn(process.execPath, [scriptPath, "--mode", smokeMode], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...productionProfileEnv(group, "smoke"),
      },
      stdio: "inherit",
    });

    child.on("error", (error) => {
      console.error(`[stack] production smoke failed to start: ${error.message}`);
      resolve();
    });
    child.on("exit", (code, signal) => {
      if (code === 0) {
        console.log("[stack] production smoke passed.");
      } else {
        console.error(
          `[stack] production smoke failed (${signal ? `signal ${signal}` : `exit ${code}`}); stack remains running.`
        );
      }
      resolve();
    });
  });
}

async function stopAndExit(names, ownerId, claimedPorts, exitCode = 0) {
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

  const ownerId = ownerIdForLaunch();
  const { appsToStart, reusedApps, skippedHelpers, claimedPorts } = await claimApps(
    apps,
    group,
    ownerId
  );
  const ownedApps = appsToStart.map((app) => ({
    ...app,
    env: {
      ...(app.env || {}),
      GREEN_GOODS_DEV_OWNER: ownerId,
    },
  }));

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
    if (ready) await runProductionSmoke(group);
    return;
  }

  await connect();
  try {
    await assertAppsReplaceable(
      ownedApps.map((app) => app.name),
      ownerId
    );
    await deleteOwnedApps(
      ownedApps.map((app) => app.name),
      ownerId
    );
    await startApps(ownedApps);
  } catch (error) {
    await releaseClaims(claimedPorts, ownerId);
    disconnect();
    throw error;
  }

  const label = parsed.mode === "group" ? `${parsed.group} stack` : "custom stack";
  console.log(`Started Green Goods ${label}: ${ownedApps.map((app) => app.name).join(", ")}`);
  console.log(`[stack] lease owner: ${ownerId}`);
  printProductionModeNotice(group);
  console.log("Press Ctrl+C to stop services.\n");

  const bus = await launchBus();
  bus.on("log:out", (packet) => writeLog(packet, process.stdout));
  bus.on("log:err", (packet) => writeLog(packet, process.stderr));
  bus.on("process:event", (packet) => {
    if (!packet?.event || !packet?.process?.name) return;
    console.log(`[pm2] ${packet.process.name} ${packet.event}`);
  });

  process.on("SIGINT", () => {
    stopAndExit(
      ownedApps.map((app) => app.name),
      ownerId,
      claimedPorts,
      0
    );
  });
  process.on("SIGTERM", () => {
    stopAndExit(
      ownedApps.map((app) => app.name),
      ownerId,
      claimedPorts,
      0
    );
  });

  // Run readiness probe in the background so logs flow uninterrupted.
  reportReadiness(apps).then(async (ready) => {
    if (ready) await runProductionSmoke(group);
  }).catch((error) => {
    console.error(`[stack] readiness probe failed: ${error.message}`);
  });

  await new Promise(() => {});
}

main().catch((error) => {
  disconnect();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
