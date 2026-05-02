#!/usr/bin/env node

/**
 * E2E test runner.
 *
 * Boots the web stack (`docs` + `admin` + `client` + `storybook` only — not the
 * indexer/agent/browser launcher that `dev:full` adds), waits for client and
 * admin to respond, runs Playwright, and stops the stack on exit.
 *
 * Usage:
 *   node scripts/dev/test-e2e.js          # all Playwright tests
 *   node scripts/dev/test-e2e.js smoke    # smoke specs only
 */

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForService, reexecUnderSystemNodeIfNeeded } from "../lib/dev-shared.js";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "../..");

reexecUnderSystemNodeIfNeeded({
  scriptPath: __filename,
  sentinel: "GREEN_GOODS_E2E_NODE_REEXEC",
  cwd: projectRoot,
});

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};

const log = {
  info: (msg) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg) => console.log(`${c.green}✓${c.reset}  ${msg}`),
  warning: (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  error: (msg) => console.log(`${c.red}✗${c.reset}  ${msg}`),
  step: (msg) => console.log(`${c.blue}▶${c.reset}  ${msg}`),
};

let devProcess = null;

function stopStack() {
  try {
    execSync("bun run dev:stop", { stdio: "ignore" });
  } catch {
    // dev:stop is idempotent; PM2 may already be down
  }
}

function cleanup() {
  log.info("Cleaning up...");
  if (devProcess && !devProcess.killed) {
    try {
      devProcess.kill("SIGTERM");
    } catch {
      // best-effort
    }
  }
  stopStack();
  log.success("Cleanup complete");
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  console.log("\n");
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

async function waitFor(name, urls, deadlineMs) {
  log.step(`Waiting for ${name}...`);
  const result = await waitForService({ urls, deadlineMs });
  if (result.ok) {
    log.success(`${name} is ready (${result.url})`);
    return true;
  }
  console.log("");
  return false;
}

async function main() {
  const testMode = process.argv[2] || "all";

  console.log("");
  log.step("Starting E2E tests...");
  console.log("");

  log.step("Starting web stack (client + admin + docs + storybook)...");
  const logFile = "/tmp/green-goods-dev.log";
  const logStream = fs.createWriteStream(logFile, { flags: "w" });

  devProcess = spawn("bun", ["run", "dev:web"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  devProcess.stdout.pipe(logStream);
  devProcess.stderr.pipe(logStream);

  // 90s deadline covers a cold mkcert + vite first-build + dependency
  // re-optimization restart on a slow machine.
  const deadline = Date.now() + 90_000;
  const clientReady = await waitFor(
    "Client",
    ["https://localhost:3001", "http://localhost:3001"],
    deadline,
  );
  if (!clientReady) {
    log.error(`Client failed to start. Check logs at: ${logFile}`);
    process.exit(1);
  }

  const adminReady = await waitFor(
    "Admin",
    ["https://localhost:3002", "http://localhost:3002"],
    deadline,
  );
  if (!adminReady) {
    log.error(`Admin failed to start. Check logs at: ${logFile}`);
    process.exit(1);
  }

  console.log("");
  log.step("Running Playwright tests...");
  console.log("");

  const testArgs =
    testMode === "smoke"
      ? [
          "test",
          "tests/specs/client.smoke.spec.ts",
          "tests/specs/admin.smoke.spec.ts",
          "--project=chromium",
        ]
      : ["test"];

  try {
    execSync(`npx playwright ${testArgs.join(" ")}`, {
      stdio: "inherit",
      env: {
        ...process.env,
        SKIP_WEBSERVER: "true",
        SKIP_HEALTH_CHECK: "true",
      },
    });
    console.log("");
    log.success("All tests passed!");
    process.exit(0);
  } catch (err) {
    console.log("");
    log.error(`Some tests failed (exit code: ${err.status || 1})`);
    process.exit(err.status || 1);
  }
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
