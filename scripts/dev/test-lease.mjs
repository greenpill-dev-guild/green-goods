import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { isProcessAlive } from "./surface-leases.mjs";

// Package-wide test runs from several sessions or worktrees slow each other more than running
// them one after another, so a full run takes a machine-wide slot here and the next one waits.
// Slots live in the git common directory, which every worktree of this repository shares.
export const TEST_LEASE_DIRECTORY = "green-goods-test-lease";
export const TEST_LEASE_SLOTS_VARIABLE = "GREEN_GOODS_TEST_LEASE_SLOTS";
export const TEST_LEASE_TIMEOUT_VARIABLE = "GREEN_GOODS_TEST_LEASE_TIMEOUT_SECONDS";
export const LOCAL_GATE_VARIABLE = "GREEN_GOODS_LOCAL_GATE";
// EX_TEMPFAIL: the suite never ran, so this is neither a pass nor a test failure.
export const TEST_LEASE_TIMEOUT_EXIT_CODE = 75;

const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_POLL_MS = 1_000;
const DEFAULT_STATUS_INTERVAL_MS = 30_000;
// Recovery holds its lock for a few file operations; one older than this was left by a crash.
const ABANDONED_RECOVERY_LOCK_MS = 30_000;

export class TestLeaseTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "TestLeaseTimeoutError";
  }
}

export function resolveTestLeaseSettings(environment = process.env) {
  const positive = (name, fallback) => {
    const raw = environment[name];
    if (raw === undefined || raw === "") return fallback;
    if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer, got ${raw}`);
    return Number(raw);
  };
  return {
    slots: positive(TEST_LEASE_SLOTS_VARIABLE, 1),
    timeoutSeconds: positive(TEST_LEASE_TIMEOUT_VARIABLE, DEFAULT_TIMEOUT_SECONDS),
  };
}

// A CI runner holds one job, so it has nobody to wait for, and GitHub Actions is the only CI that
// runs these suites. CI=true alone is not a runner: the local gate exports it to reproduce CI's
// test environment (and marks itself), and so does a hand-run Coverage Nightly, so both take a slot.
export function runsInContinuousIntegration(environment = process.env) {
  const ci = environment.CI;
  return (
    Boolean(ci) &&
    ci !== "false" &&
    ci !== "0" &&
    environment.GITHUB_ACTIONS === "true" &&
    !environment[LOCAL_GATE_VARIABLE]
  );
}

export function resolveTestLeaseDirectory({ cwd, execFile = execFileSync }) {
  const commonDirectory = String(
    execFile("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  ).trim();
  return path.join(commonDirectory, TEST_LEASE_DIRECTORY);
}

function readHolder(slotPath) {
  try {
    return JSON.parse(fs.readFileSync(slotPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    // Slots appear with their whole record through link(), so an unreadable one is damaged.
    return { unreadable: true };
  }
}

export function describeTestLeaseHolder(holder, now = Date.now()) {
  if (!holder || holder.unreadable) return "an unreadable holder record";
  const seconds = Math.max(0, Math.round((now - holder.startedAt) / 1000));
  return `pid ${holder.pid} (${holder.package} test in ${holder.cwd}, started ${seconds}s ago)`;
}

function recoverAbandonedSlot(directory, slotPath, observed, processAlive) {
  // Two waiters can judge the same holder dead. Only a waiter holding this lock may delete a
  // slot, and it re-reads the slot first, so it can never delete a claim made after its check.
  const lockPath = path.join(directory, "recovery.lock");
  try {
    fs.mkdirSync(lockPath);
  } catch (error) {
    if (error?.code !== "EEXIST") return;
    try {
      if (Date.now() - fs.statSync(lockPath).mtimeMs > ABANDONED_RECOVERY_LOCK_MS) {
        fs.rmdirSync(lockPath);
      }
    } catch {
      // Another waiter removed it first.
    }
    return;
  }
  try {
    const current = readHolder(slotPath);
    if (!current) return;
    const sameHolder = observed.unreadable ? current.unreadable : current.token === observed.token;
    if (sameHolder && (current.unreadable || !processAlive(current.pid))) fs.unlinkSync(slotPath);
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}

function releaseOnce(slotPath, token) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (readHolder(slotPath)?.token === token) fs.rmSync(slotPath, { force: true });
  };
}

function waitFor(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Takes one of `slots` machine-wide test slots, waiting while all are held by live processes.
 * Resolves `{ status: "acquired", slot, release }`, `{ status: "unavailable", reason }` when the
 * directory cannot be written (a sandbox), or `{ status: "cancelled" }` when `signal` aborts.
 * Rejects with TestLeaseTimeoutError once `timeoutMs` passes without a free slot.
 */
export async function acquireTestLease({
  directory,
  slots = 1,
  holder,
  timeoutMs,
  pollMs = DEFAULT_POLL_MS,
  statusIntervalMs = DEFAULT_STATUS_INTERVAL_MS,
  now = Date.now,
  sleep = waitFor,
  processAlive = isProcessAlive,
  report = (line) => process.stderr.write(`${line}\n`),
  signal,
}) {
  const token = randomUUID();
  const record = {
    token,
    pid: holder.pid ?? process.pid,
    cwd: holder.cwd,
    package: holder.package,
    startedAt: now(),
  };
  const claimPath = path.join(directory, `.claim-${token}.tmp`);
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(claimPath, `${JSON.stringify(record)}\n`, { flag: "wx", mode: 0o600 });
  } catch (error) {
    return { status: "unavailable", reason: `cannot write ${directory} (${error?.code ?? error?.message})` };
  }

  const started = now();
  let reportedAt = null;
  let lastHolder = null;
  try {
    for (;;) {
      if (signal?.aborted) return { status: "cancelled" };
      let blocking = null;
      for (let slot = 0; slot < slots; slot += 1) {
        const slotPath = path.join(directory, `slot-${slot}.json`);
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            // link() publishes the complete record atomically and fails if the slot is taken.
            fs.linkSync(claimPath, slotPath);
            if (reportedAt !== null) {
              report(`test lease: acquired slot ${slot + 1}/${slots} after ${Math.round((now() - started) / 1000)}s`);
            }
            return { status: "acquired", slot, release: releaseOnce(slotPath, token) };
          } catch (error) {
            if (error?.code !== "EEXIST") {
              return { status: "unavailable", reason: `cannot claim ${slotPath} (${error?.code ?? error?.message})` };
            }
          }
          const current = readHolder(slotPath);
          if (current) lastHolder = current;
          if (current && !current.unreadable && processAlive(current.pid)) {
            blocking ??= current;
            break;
          }
          if (current) recoverAbandonedSlot(directory, slotPath, current, processAlive);
        }
      }

      blocking ??= lastHolder;
      const elapsed = now() - started;
      if (elapsed >= timeoutMs) {
        throw new TestLeaseTimeoutError(
          `test lease: gave up after ${Math.round(elapsed / 1000)}s waiting for a machine test slot held by ` +
            `${describeTestLeaseHolder(blocking, now())}. Wait for it to finish, or rerun with ` +
            `${TEST_LEASE_TIMEOUT_VARIABLE}=<seconds> or ${TEST_LEASE_SLOTS_VARIABLE}=<slots>.`,
        );
      }
      if (reportedAt === null || now() - reportedAt >= statusIntervalMs) {
        report(
          `test lease: waiting for a machine test slot (${slots} total) held by ` +
            `${describeTestLeaseHolder(blocking, now())}; waited ${Math.round(elapsed / 1000)}s of ` +
            `${Math.round(timeoutMs / 1000)}s.`,
        );
        reportedAt = now();
      }
      await sleep(pollMs, signal);
    }
  } finally {
    fs.rmSync(claimPath, { force: true });
  }
}
