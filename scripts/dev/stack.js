#!/usr/bin/env node

/**
 * Start or stop PM2-backed development stacks.
 *
 * Usage:
 *   node scripts/dev/stack.js                 # default: full
 *   node scripts/dev/stack.js full            # every app in ecosystem.config.cjs
 *   node scripts/dev/stack.js web             # client, admin, docs, storybook, browser
 *   node scripts/dev/stack.js stop            # stop all PM2 services
 *   node scripts/dev/stack.js client admin    # custom subset (any app name from ecosystem.config.cjs)
 */

import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pm2 = require("pm2");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const ecosystem = require(path.join(projectRoot, "ecosystem.config.cjs"));

const allApps = ecosystem.apps || [];
const validNames = new Set(allApps.map((app) => app.name));

const PRODUCTION_INDEXER_URL = "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";
const PRODUCTION_AGENT_URL = "https://agent.greengoods.app";
const LOCAL_INDEXER_URL = "http://localhost:3006/v1/graphql";
const ARBITRUM_PUBLIC_RPC_URL = "https://arb1.arbitrum.io/rpc";

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

const exclusiveGroups = new Set(["prod", "prod-mirror"]);

// Apps that bind to a TCP port we can probe for readiness. Other apps (tunnel,
// browser) finish their work without listening on a deterministic port.
const portByApp = {
  "anvil-arbitrum": 3009,
  client: 3001,
  admin: 3002,
  docs: 3003,
  storybook: 3004,
  agent: 3005,
  indexer: 3006,
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
      "Usage: node scripts/dev/stack.js [<group>|<app>...|stop]",
      "",
      "Groups:",
      ...Object.entries(groups).map(([name, apps]) => `  ${name.padEnd(11)} ${apps.join(", ")}`),
      "",
      `Apps: ${allApps.map((app) => app.name).join(", ")}`,
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
          pm2.delete(name, () => resolve());
        })
    )
  );
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

async function reportReadiness(apps) {
  const probed = apps
    .map((app) => ({ name: app.name, port: portByApp[app.name] }))
    .filter((item) => typeof item.port === "number");

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
      ARBITRUM_RPC_URL: process.env.ARBITRUM_RPC_URL || ARBITRUM_PUBLIC_RPC_URL,
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

async function stopAndExit(names, exitCode = 0) {
  await deleteApps(names);
  disconnect();
  process.exit(exitCode);
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

  if (parsed.mode === "stop") {
    await connect();
    await deleteApps(allApps.map((app) => app.name));
    disconnect();
    console.log("Stopped Green Goods dev services.");
    return;
  }

  const group = parsed.mode === "group" ? parsed.group : "";
  const apps = allApps
    .filter((app) => parsed.names.includes(app.name))
    .map((app) => applyGroupEnvironment(app, group));
  if (apps.length === 0) {
    throw new Error(`No PM2 apps matched: ${parsed.names.join(", ")}`);
  }

  await connect();
  const namesToDelete =
    parsed.mode === "group" && exclusiveGroups.has(parsed.group)
      ? allApps.map((app) => app.name)
      : apps.map((app) => app.name);
  await deleteApps(namesToDelete);
  await startApps(apps);

  const label = parsed.mode === "group" ? `${parsed.group} stack` : "custom stack";
  console.log(`Started Green Goods ${label}: ${apps.map((app) => app.name).join(", ")}`);
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
    stopAndExit(apps.map((app) => app.name), 0);
  });
  process.on("SIGTERM", () => {
    stopAndExit(apps.map((app) => app.name), 0);
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
