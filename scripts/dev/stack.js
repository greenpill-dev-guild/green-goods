#!/usr/bin/env node

/**
 * Start or stop PM2-backed development stacks.
 *
 * Groups:
 * - web: client, admin, docs, storybook
 * - full: every app in ecosystem.config.cjs
 */

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pm2 = require("pm2");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const ecosystem = require(path.join(projectRoot, "ecosystem.config.cjs"));

const mode = process.argv[2] || "full";
const allApps = ecosystem.apps || [];
const groups = {
  web: ["docs", "admin", "client", "storybook"],
  full: allApps.map((app) => app.name),
};

function usage() {
  console.log("Usage: node scripts/dev-stack.js <web|full|stop>");
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

function deleteAll() {
  return new Promise((resolve) => {
    pm2.delete("all", () => resolve());
  });
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

async function stopAndExit(exitCode = 0) {
  await deleteAll();
  disconnect();
  process.exit(exitCode);
}

async function main() {
  process.chdir(projectRoot);

  if (mode === "stop") {
    await connect();
    await deleteAll();
    disconnect();
    console.log("Stopped Green Goods dev services.");
    return;
  }

  const group = groups[mode];
  if (!group) {
    usage();
    process.exitCode = 1;
    return;
  }

  const apps = allApps.filter((app) => group.includes(app.name));
  if (apps.length === 0) {
    throw new Error(`No PM2 apps matched ${mode}`);
  }

  await connect();
  await deleteAll();
  await startApps(apps);

  console.log(`Started Green Goods ${mode} stack: ${apps.map((app) => app.name).join(", ")}`);
  console.log("Press Ctrl+C to stop services.\n");

  const bus = await launchBus();
  bus.on("log:out", (packet) => writeLog(packet, process.stdout));
  bus.on("log:err", (packet) => writeLog(packet, process.stderr));
  bus.on("process:event", (packet) => {
    if (!packet?.event || !packet?.process?.name) return;
    console.log(`[pm2] ${packet.process.name} ${packet.event}`);
  });

  process.on("SIGINT", () => {
    stopAndExit(0);
  });
  process.on("SIGTERM", () => {
    stopAndExit(0);
  });

  await new Promise(() => {});
}

main().catch((error) => {
  disconnect();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
