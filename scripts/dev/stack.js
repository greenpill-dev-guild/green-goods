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

const groups = {
  // `browser` waits on ports and opens tabs (PWA + website + admin + docs +
  // storybook). `tunnel` is a best-effort cloudflared launcher for both the
  // client and admin Vite servers — admin has a real mobile review surface, so
  // it ships in `web` alongside the client. Both apps are no-ops if their
  // prerequisites (Brave / cloudflared) aren't installed.
  web: ["docs", "admin", "client", "storybook", "browser", "tunnel"],
  full: allApps.map((app) => app.name),
};

// Apps that bind to a TCP port we can probe for readiness. Other apps (agent,
// tunnel, browser) finish their work without listening on a deterministic port.
const portByApp = {
  client: 3001,
  admin: 3002,
  docs: 3003,
  storybook: 3004,
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
      `  web   ${groups.web.join(", ")}`,
      `  full  ${groups.full.join(", ")}`,
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

async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePort(port)) return true;
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
    return;
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
    return;
  }

  console.log(
    `[stack] ${ready.length}/${results.length} services ready in ${elapsed}s — failed: ${failed
      .map((item) => `${item.name}:${item.port}`)
      .join(", ")}`
  );
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

  const apps = allApps.filter((app) => parsed.names.includes(app.name));
  if (apps.length === 0) {
    throw new Error(`No PM2 apps matched: ${parsed.names.join(", ")}`);
  }

  await connect();
  await deleteApps(apps.map((app) => app.name));
  await startApps(apps);

  const label = parsed.mode === "group" ? `${parsed.group} stack` : "custom stack";
  console.log(`Started Green Goods ${label}: ${apps.map((app) => app.name).join(", ")}`);
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
  reportReadiness(apps).catch((error) => {
    console.error(`[stack] readiness probe failed: ${error.message}`);
  });

  await new Promise(() => {});
}

main().catch((error) => {
  disconnect();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
