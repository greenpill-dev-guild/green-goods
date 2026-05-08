#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reexecUnderSystemNodeIfNeeded } from "../lib/dev-shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const sharedDir = path.resolve(projectRoot, "packages/shared");
const nodeCli = path.resolve(projectRoot, "scripts/dev/node-cli.js");

reexecUnderSystemNodeIfNeeded({
  scriptPath: __filename,
  sentinel: "GREEN_GOODS_STORYBOOK_VITEST_CI_REEXEC",
  cwd: projectRoot,
});

const ansiPattern =
  /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g;
const successGraceMs = Number(process.env.STORYBOOK_VITEST_SUCCESS_GRACE_MS || 15_000);
const overallTimeoutMs = Number(process.env.STORYBOOK_VITEST_CI_TIMEOUT_MS || 10 * 60_000);

function runPrepareStep() {
  const result = spawnSync("bun", ["run", "storybook:prepare-design-assets"], {
    cwd: sharedDir,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function stripAnsi(value) {
  return value.replace(ansiPattern, "");
}

function killProcessGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      process.stderr.write(
        `Failed to send ${signal} to Storybook Vitest process group: ${error.message}\n`,
      );
    }
  }
}

runPrepareStep();

const child = spawn(
  process.execPath,
  [nodeCli, "vitest", "run", "--config", "vitest.storybook.config.ts", "--project=storybook"],
  {
    cwd: sharedDir,
    detached: process.platform !== "win32",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let sawPassingFiles = false;
let sawPassingTests = false;
let successTimer;
let forceKillTimer;
let settled = false;
let outputTail = "";

function successDetected() {
  return sawPassingFiles && sawPassingTests;
}

function finish(exitCode) {
  if (settled) return;
  settled = true;
  clearTimeout(successTimer);
  clearTimeout(forceKillTimer);
  clearTimeout(overallTimer);
  process.exit(exitCode);
}

function scheduleSuccessExit() {
  if (successTimer || !successDetected()) return;

  successTimer = setTimeout(() => {
    process.stderr.write(
      `Storybook Vitest reported a passing summary but did not exit after ${successGraceMs}ms; terminating leftover browser/test processes.\n`,
    );
    killProcessGroup(child, "SIGTERM");
    forceKillTimer = setTimeout(() => killProcessGroup(child, "SIGKILL"), 5_000);
    finish(0);
  }, successGraceMs);
}

function handleOutput(chunk, stream) {
  stream.write(chunk);
  const text = outputTail + stripAnsi(chunk.toString());
  outputTail = text.slice(-4096);

  if (/Test Files\s+\d+\s+passed/.test(text) && !/\d+\s+failed/.test(text)) {
    sawPassingFiles = true;
  }

  if (/Tests\s+\d+\s+passed/.test(text) && !/\d+\s+failed/.test(text)) {
    sawPassingTests = true;
  }

  scheduleSuccessExit();
}

const overallTimer = setTimeout(() => {
  process.stderr.write(
    `Storybook Vitest CI exceeded ${overallTimeoutMs}ms without a passing summary.\n`,
  );
  killProcessGroup(child, "SIGTERM");
  forceKillTimer = setTimeout(() => killProcessGroup(child, "SIGKILL"), 5_000);
  finish(1);
}, overallTimeoutMs);

child.stdout.on("data", (chunk) => handleOutput(chunk, process.stdout));
child.stderr.on("data", (chunk) => handleOutput(chunk, process.stderr));

child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  finish(1);
});

child.on("exit", (status, signal) => {
  if (status === 0) {
    finish(0);
    return;
  }

  if (successDetected() && signal) {
    finish(0);
    return;
  }

  process.exitCode = status ?? (signal ? 1 : 0);
  finish(process.exitCode);
});
