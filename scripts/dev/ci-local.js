#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { availableParallelism, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  reexecUnderCompatibleNodeIfNeeded,
  reexecUnderSystemNodeIfNeeded,
  resolveVitestMaxWorkers,
} from "../lib/dev-shared.js";
import {
  buildReceiptInputs,
  fingerprintReceiptInputs,
  resolveGitInputs,
  selectValidation,
  summarizeBudget,
} from "../quality/select-validation.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "../..");
const defaultReceiptPath = resolve(projectRoot, ".cache/validation/passing-receipts.json");

const ABI_EXPORT_SOURCES = {
  "ActionRegistry.json": "Action.sol/ActionRegistry.json",
  "GardenAccount.json": "Garden.sol/GardenAccount.json",
  "GardenToken.json": "Garden.sol/GardenToken.json",
  "GreenGoodsENS.json": "ENS.sol/GreenGoodsENS.json",
  "IHats.json": "IHats.sol/IHats.json",
  "MockEAS.json": "EAS.sol/MockEAS.json",
};

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[0;31m",
  green: "\x1b[0;32m",
  yellow: "\x1b[1;33m",
  blue: "\x1b[0;34m",
};

const ciEnv = {
  CI: "true",
  ENCRYPTION_SECRET: "test-secret-for-ci-encryption-32chars",
  TELEGRAM_BOT_TOKEN: "test-bot-token",
  VITE_RPC_URL_11155111: "http://localhost:3009",
  VITE_USE_HASH_ROUTER: "false",
  VITE_CHAIN_ID: "11155111",
  VITE_WALLETCONNECT_PROJECT_ID: "test",
  VITE_PIMLICO_API_KEY: "test",
  VITE_ENVIO_INDEXER_URL: "http://localhost:3006/v1/graphql",
};

export function parseArguments(argv) {
  const options = {
    intent: "ship",
    checkpointScope: "workspace",
    changedPaths: [],
    testPaths: {},
    checkIds: [],
    capabilities: {},
    skipContracts: false,
    skipIndexer: false,
    skipBuild: false,
    skipDocs: false,
    skipLighthouse: false,
    onlyLint: false,
    generateIndexer: false,
    lighthouse: false,
    failFast: true,
    planJson: false,
    cancelled: false,
    reusePassingReceipts: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };

    switch (arg) {
      case "--skip-contracts":
        options.skipContracts = true;
        break;
      case "--skip-indexer":
        options.skipIndexer = true;
        break;
      case "--skip-build":
        options.skipBuild = true;
        break;
      case "--skip-docs":
        options.skipDocs = true;
        break;
      case "--skip-lighthouse":
        options.skipLighthouse = true;
        break;
      case "--only-lint":
        options.onlyLint = true;
        options.intent = "diagnose";
        options.checkIds.push("format", "lint");
        break;
      case "--quick":
        options.intent = "checkpoint";
        break;
      case "--generate-indexer":
        options.generateIndexer = true;
        break;
      case "--lighthouse":
        options.lighthouse = true;
        options.checkIds.push("lighthouse-client", "lighthouse-admin");
        break;
      case "--no-fail-fast":
        options.failFast = false;
        break;
      case "--plan-json":
        options.planJson = true;
        break;
      case "--cancelled":
        options.cancelled = true;
        break;
      case "--reuse-passing-receipts":
        options.reusePassingReceipts = true;
        break;
      case "--intent":
        options.intent = next();
        break;
      case "--checkpoint-scope":
        options.checkpointScope = next();
        break;
      case "--base":
        options.base = next();
        break;
      case "--head":
        options.head = next();
        break;
      case "--changed":
        options.changedPaths.push(...next().split(",").filter(Boolean));
        break;
      case "--risk":
        options.risk = next();
        break;
      case "--test-path": {
        const value = next();
        const separator = value.indexOf(":");
        if (separator < 1) throw new Error("--test-path must use surface:path");
        const surface = value.slice(0, separator);
        (options.testPaths[surface] ??= []).push(value.slice(separator + 1));
        break;
      }
      case "--check":
        options.checkIds.push(next());
        break;
      case "--capability": {
        const [name, value] = next().split("=", 2);
        if (!name || !["true", "false"].includes(value)) {
          throw new Error("--capability must use name=true or name=false");
        }
        options.capabilities[name] = value === "true";
        break;
      }
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (
    options.intent === "checkpoint" &&
    options.checkpointScope === "lane" &&
    options.changedPaths.length === 0 &&
    !options.cancelled
  ) {
    throw new Error("Lane checkpoint requires --changed");
  }
  return options;
}

function showHelp() {
  console.log(`Usage: node scripts/dev/ci-local.js [options]

Selector options:
  --intent <intent>       diagnose|qa|review|checkpoint|readiness|push|ship|merge|release
  --checkpoint-scope <s>  lane|workspace; lane requires explicit --changed paths
  --base <revision>       Base revision (default: origin/develop)
  --head <revision>       Head revision (default: HEAD)
  --changed <paths>       Comma-separated changed paths; repeatable
  --risk <risk>           routine|sensitive|critical
  --test-path <pkg:path>  Direct behavior proof for push, e.g. shared:src/utils/date.test.ts
  --check <check-id>      Add an explicit acceptance check; repeatable
  --capability k=true     Declare an environment capability; repeatable
  --plan-json             Print the exact plan as JSON without running it
  --cancelled             Emit a terminal cancelled plan
  --reuse-passing-receipts Reuse exact-fingerprint passes from .cache/validation

Execution options:
  --quick                 Change-aware cross-package checkpoint
  --only-lint             Run only explicitly requested format and lint evidence
  --no-fail-fast          Continue independent checks after a failure
  --lighthouse            Add advisory Lighthouse checks

Compatibility filters (mandatory critical checks ignore these flags):
  --skip-contracts        Skip non-mandatory contract checks
  --skip-indexer          Skip non-mandatory indexer checks
  --skip-build            Skip non-mandatory build checks
  --skip-docs             Skip non-mandatory docs checks
  --skip-lighthouse       Skip Lighthouse checks
  --generate-indexer      Retained compatibility flag; package commands own codegen
  --help, -h              Show this help`);
}

async function commandExists(command) {
  return new Promise((resolvePromise) => {
    const check = process.platform === "win32" ? `where ${command}` : `command -v ${command}`;
    const child = spawn(check, { shell: true, stdio: "ignore" });
    child.once("close", (code) => resolvePromise(code === 0));
    child.once("error", () => resolvePromise(false));
  });
}

async function commandOutput(command) {
  return new Promise((resolvePromise) => {
    const child = spawn(`${command} --version`, { shell: true, stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.once("close", (code) => resolvePromise(code === 0 ? output.trim() : null));
    child.once("error", () => resolvePromise(null));
  });
}

function portAvailable({ host, port, timeoutMs = 250 }) {
  return new Promise((resolvePromise) => {
    let settled = false;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(available);
    };
    const socket = createConnection({ host, port });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function arbitrumForkAvailable({
  rpcUrl = process.env.ARBITRUM_RPC_URL,
  probe = portAvailable,
} = {}) {
  if (typeof rpcUrl === "string" && rpcUrl.trim() !== "") return true;
  return probe({ host: "127.0.0.1", port: 3009 });
}

export function capabilityRecoveryHint(capability) {
  if (capability !== "arbitrumFork") return null;
  return "Start the local fork with `bun run dev:contracts:arbitrum-fork`.";
}

async function detectEnvironment(options) {
  const dependencies = [
    "node_modules/.bun",
    "node_modules/@biomejs/biome/package.json",
    "node_modules/typescript/package.json",
    "node_modules/vitest/package.json",
  ].every((path) => existsSync(resolve(projectRoot, path)));
  const bunVersion = await commandOutput("bun");
  const foundryOutput = await commandOutput("forge");
  const foundryVersion = foundryOutput?.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  return {
    profile: "local-ci",
    toolchain: {
      node: process.version.replace(/^v/, ""),
      ...(bunVersion ? { bun: bunVersion } : {}),
      ...(foundryVersion ? { foundry: foundryVersion } : {}),
    },
    capabilities: {
      dependencies,
      foundry: await commandExists("forge"),
      docker: await commandExists("docker"),
      indexerCodegen: dependencies,
      arbitrumFork: await arbitrumForkAvailable(),
      authenticatedBrave: false,
      browser: false,
      ...options.capabilities,
    },
  };
}

export function applyCompatibilityFilters(plan, options) {
  const skipped = [];
  const keep = (check) => {
    let requestedSkip = false;
    if (options.onlyLint && !["format", "lint"].includes(check.id)) requestedSkip = true;
    if (
      options.skipContracts &&
      (check.id.startsWith("contracts-") || check.id === "abi-artifacts")
    ) {
      requestedSkip = true;
    }
    if (options.skipIndexer && check.id.startsWith("indexer-")) requestedSkip = true;
    if (
      options.skipBuild &&
      (check.id.endsWith("-build") || check.id.startsWith("lighthouse-"))
    ) {
      requestedSkip = true;
    }
    if (options.skipDocs && check.id.startsWith("docs-")) requestedSkip = true;
    if (options.skipLighthouse && check.id.startsWith("lighthouse-")) requestedSkip = true;
    if (!requestedSkip || check.mandatory) return true;
    skipped.push({ id: check.id, reason: "compatibility-filter" });
    return false;
  };
  const checks = plan.checks.filter(keep);
  // Recompute rather than inheriting plan.status: when the only blocked checks
  // are the ones a compatibility filter just dropped, the remaining plan is
  // runnable and must not keep reporting blocked.
  const stillBlocked =
    checks.some((check) => check.state === "blocked") || plan.environmentBlockers?.length > 0;
  const status = stillBlocked ? "blocked" : plan.status === "blocked" ? "ready" : plan.status;
  const budget = summarizeBudget(plan.effectiveIntent, checks, plan.risk);
  return { ...plan, checks, status, budget, skipped };
}

export function isSupportedCiNodeVersion(version) {
  const major = Number.parseInt(version.split(".")[0], 10);
  return Number.isInteger(major) && major >= 22;
}

export function buildLocalValidationPlan(options, gitInputs, environment) {
  const plan = selectValidation({
    intent: options.intent,
    checkpointScope: options.checkpointScope,
    base: gitInputs.base,
    head: gitInputs.head,
    workingCopyFingerprint: gitInputs.workingCopyFingerprint,
    changedPaths: gitInputs.changedPaths,
    risk: options.risk,
    cancelled: options.cancelled,
    testPaths: options.testPaths,
    checkIds: options.checkIds,
    environment,
  });
  return applyCompatibilityFilters(plan, options);
}

function envForCheck(check) {
  const common = { CI: ciEnv.CI };
  if (check.id.startsWith("agent-")) {
    return {
      ...common,
      ENCRYPTION_SECRET: ciEnv.ENCRYPTION_SECRET,
      TELEGRAM_BOT_TOKEN: ciEnv.TELEGRAM_BOT_TOKEN,
      VITE_RPC_URL_11155111: ciEnv.VITE_RPC_URL_11155111,
    };
  }
  if (["client-build", "admin-build"].includes(check.id)) return { ...common, ...ciEnv };
  return common;
}

export function resolveVitestBatchEnvironment(
  batch,
  {
    cpus = availableParallelism(),
    totalMemoryBytes = totalmem(),
    ci = Boolean(process.env.CI),
    explicitMaxWorkers = process.env.VITEST_MAX_WORKERS,
  } = {},
) {
  if (batch.length < 2 || !batch.every((check) => check.id.endsWith("-test"))) return {};
  if (explicitMaxWorkers) return { VITEST_MAX_WORKERS: explicitMaxWorkers };

  const maxWorkers = resolveVitestMaxWorkers({
    cpus,
    totalMemoryBytes,
    ci,
    share: batch.length,
  });
  return maxWorkers === undefined ? {} : { VITEST_MAX_WORKERS: String(maxWorkers) };
}

function elapsedSeconds(start) {
  return Number(((Date.now() - start) / 1000).toFixed(3));
}

async function runAbiArtifactCheck() {
  const contractsTs = resolve(projectRoot, "packages/shared/src/utils/blockchain/contracts.ts");
  if (!existsSync(contractsTs)) return { ok: true, exitCode: 0, details: [] };

  const content = readFileSync(contractsTs, "utf8");
  const importPattern = /from\s+["']@green-goods\/contracts\/abis\/(.+?\.json)["']/g;
  const problems = [];
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    const abiFileName = match[1];
    const artifactPath = resolve(projectRoot, `packages/contracts/abis/${abiFileName}`);
    if (!existsSync(artifactPath)) {
      problems.push(`${abiFileName}: committed ABI is missing`);
      continue;
    }
    const source = ABI_EXPORT_SOURCES[abiFileName];
    if (!source) continue;
    const compiledPath = resolve(
      projectRoot,
      `packages/contracts/.generated/foundry/out/default/${source}`,
    );
    if (!existsSync(compiledPath)) continue;
    try {
      const compiled = JSON.parse(readFileSync(compiledPath, "utf8"));
      const expected = `${JSON.stringify(compiled.abi ?? [], null, 2)}\n`;
      if (readFileSync(artifactPath, "utf8") !== expected) {
        problems.push(`${abiFileName}: committed ABI is stale`);
      }
    } catch (error) {
      problems.push(`${abiFileName}: ${error.message}`);
    }
  }
  return { ok: problems.length === 0, exitCode: problems.length === 0 ? 0 : 1, details: problems };
}

export async function runCommandCheck(
  check,
  { signal, captureOutput = false, environment = {} } = {},
) {
  const start = Date.now();
  if (check.builtin === "abiArtifacts") {
    const result = await runAbiArtifactCheck();
    return { ...result, durationSeconds: elapsedSeconds(start) };
  }
  if (!check.command) {
    return {
      ok: false,
      blocked: true,
      exitCode: 2,
      durationSeconds: elapsedSeconds(start),
      details: ["manual proof required"],
    };
  }

  return new Promise((resolvePromise) => {
    if (signal?.aborted) {
      resolvePromise({ ok: false, cancelled: true, exitCode: 130, durationSeconds: 0 });
      return;
    }
    const child = spawn(check.command, {
      cwd: resolve(projectRoot, check.cwd ?? "."),
      shell: true,
      // A check running on its own streams live. Checks running concurrently
      // capture instead, so their logs replay in plan order rather than
      // interleaving into noise.
      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
      env: { ...process.env, ...envForCheck(check), ...environment },
      detached: process.platform !== "win32",
    });
    let output = "";
    if (captureOutput) {
      const collect = (chunk) => {
        output += chunk.toString();
      };
      child.stdout?.on("data", collect);
      child.stderr?.on("data", collect);
    }
    let cancelled = false;
    let forceKillTimer = null;
    const abort = () => {
      cancelled = true;
      if (process.platform === "win32") {
        child.kill("SIGTERM");
      } else if (child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          return;
        }
        forceKillTimer = setTimeout(() => {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            // The process group already exited after SIGTERM.
          }
        }, 2_000);
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.once("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolvePromise({
        ok: !cancelled && code === 0,
        cancelled,
        exitCode: cancelled ? 130 : (code ?? 1),
        durationSeconds: elapsedSeconds(start),
        ...(captureOutput ? { output } : {}),
      });
    });
    child.once("error", (error) => {
      signal?.removeEventListener("abort", abort);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolvePromise({
        ok: false,
        cancelled,
        exitCode: cancelled ? 130 : 1,
        durationSeconds: elapsedSeconds(start),
        details: [error.message],
      });
    });
  });
}

export async function executePlan(plan, options = {}) {
  const failFast = options.failFast !== false;
  const runCheck = options.runCheck ?? runCommandCheck;
  const externalSignal = options.signal;
  const results = [];
  const blocked = [];
  const receiptStore = options.receiptStore ?? new Map();
  const reusePassingReceipts = options.reusePassingReceipts === true;
  const concurrency = options.concurrency !== false;
  const resolveBatchEnvironment =
    options.resolveBatchEnvironment ?? resolveVitestBatchEnvironment;

  if (plan.status === "cancelled" || externalSignal?.aborted) {
    return { status: "cancelled", exitCode: 130, results, blocked };
  }
  if (plan.status === "needs-focus") {
    return { status: "needs-focus", exitCode: 2, results, blocked };
  }

  const deadlineController = plan.budget?.enforced ? new AbortController() : null;
  const signal = deadlineController
    ? externalSignal
      ? AbortSignal.any([externalSignal, deadlineController.signal])
      : deadlineController.signal
    : externalSignal;
  let budgetExpired = false;
  const deadlineTimer = deadlineController
    ? setTimeout(() => {
        budgetExpired = true;
        deadlineController.abort();
      }, plan.budget.hardLimitSeconds * 1000)
    : null;
  const finish = (result) => {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    return result;
  };

  const recordPass = (receiptInputs) => {
    if (!reusePassingReceipts || plan.risk === "critical") return;
    receiptStore.set(receiptInputs.fingerprint, {
      status: "passed",
      passedAt: new Date().toISOString(),
      receiptInputs,
    });
  };
  const reusableReceipt = (check) => {
    const receiptInputs = buildReceiptInputs(plan, check);
    const cached = reusePassingReceipts ? receiptStore.get(receiptInputs.fingerprint) : null;
    const reusable =
      plan.risk !== "critical" &&
      cached?.status === "passed" &&
      cached.receiptInputs?.fingerprint === receiptInputs.fingerprint;
    return { receiptInputs, reusable };
  };
  const runnableNow = (check) =>
    check.state !== "blocked" && !(check.manual && !check.command) && !reusableReceipt(check).reusable;

  let index = 0;
  while (index < plan.checks.length) {
    if (signal?.aborted) {
      return finish(
        budgetExpired
          ? { status: "budget-exceeded", exitCode: 124, results, blocked }
          : { status: "cancelled", exitCode: 130, results, blocked },
      );
    }
    const check = plan.checks[index];

    if (check.state === "blocked") {
      blocked.push({ id: check.id, blockedBy: [...check.blockedBy] });
      index += 1;
      continue;
    }
    if (check.manual && !check.command) {
      blocked.push({ id: check.id, blockedBy: ["manual-proof-required"] });
      index += 1;
      continue;
    }

    const { receiptInputs, reusable } = reusableReceipt(check);
    if (reusable) {
      const evidence = {
        id: check.id,
        ok: true,
        reused: true,
        exitCode: 0,
        durationSeconds: 0,
        receiptInputs,
      };
      results.push(evidence);
      options.onCheckReuse?.(check, evidence);
      index += 1;
      continue;
    }

    // Independent package suites declare a concurrency group in the policy and
    // run together, mirroring the grouping the root `test` script already uses.
    // Only checks adjacent in plan order join a batch, so execution order and
    // the stop rule stay exactly as the plan printed them.
    const batch = [check];
    if (concurrency && check.concurrencyGroup) {
      for (let look = index + 1; look < plan.checks.length; look += 1) {
        const next = plan.checks[look];
        if (next.concurrencyGroup !== check.concurrencyGroup) break;
        if (!runnableNow(next)) break;
        batch.push(next);
      }
    }

    if (batch.length === 1) {
      options.onCheckStart?.(check);
      const result = await runCheck(check, { signal });
      const evidence = { id: check.id, ...result, receiptInputs };
      results.push(evidence);
      options.onCheckComplete?.(check, evidence);

      if (result.cancelled || signal?.aborted) {
        return finish(
          budgetExpired
            ? { status: "budget-exceeded", exitCode: 124, results, blocked }
            : { status: "cancelled", exitCode: 130, results, blocked },
        );
      }
      if (!result.ok && failFast) {
        return finish({ status: "failed", exitCode: result.exitCode || 1, results, blocked });
      }
      if (result.ok) recordPass(receiptInputs);
      index += 1;
      continue;
    }

    options.onBatchStart?.(batch);
    const environment = resolveBatchEnvironment(batch);
    const settled = await Promise.all(
      batch.map((member) =>
        runCheck(member, { signal, captureOutput: true, environment }),
      ),
    );
    for (const [position, member] of batch.entries()) {
      const evidence = {
        id: member.id,
        ...settled[position],
        receiptInputs: buildReceiptInputs(plan, member),
      };
      results.push(evidence);
      options.onCheckComplete?.(member, evidence);
    }

    // The whole batch is already in flight, so let every member report before
    // stopping. Fail-fast still prevents anything after the batch from starting.
    if (settled.some((result) => result.cancelled) || signal?.aborted) {
      return finish(
        budgetExpired
          ? { status: "budget-exceeded", exitCode: 124, results, blocked }
          : { status: "cancelled", exitCode: 130, results, blocked },
      );
    }
    const failure = settled.find((result) => !result.ok);
    if (failure && failFast) {
      return finish({ status: "failed", exitCode: failure.exitCode || 1, results, blocked });
    }
    for (const [position, member] of batch.entries()) {
      if (settled[position].ok) recordPass(buildReceiptInputs(plan, member));
    }
    index += batch.length;
  }

  if (results.some((result) => !result.ok)) {
    return finish({ status: "failed", exitCode: 1, results, blocked });
  }
  if (blocked.length > 0 || plan.status === "blocked") {
    return finish({ status: "blocked", exitCode: 2, results, blocked });
  }
  return finish({ status: "passed", exitCode: 0, results, blocked });
}

export function loadPassingReceiptStore(path = defaultReceiptPath) {
  if (!existsSync(path)) return new Map();
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (parsed.version !== 1 || !parsed.receipts || typeof parsed.receipts !== "object") {
    throw new Error(`Invalid passing receipt store: ${path}`);
  }
  const store = new Map();
  for (const [fingerprint, record] of Object.entries(parsed.receipts)) {
    if (
      record?.status === "passed" &&
      record.receiptInputs?.fingerprint === fingerprint &&
      fingerprintReceiptInputs(record.receiptInputs) === fingerprint &&
      record.receiptInputs?.cacheReuse?.failuresCacheable === false
    ) {
      store.set(fingerprint, record);
    }
  }
  return store;
}

export function savePassingReceiptStore(store, path = defaultReceiptPath) {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  const receipts = Object.fromEntries([...store.entries()].sort(([left], [right]) => left.localeCompare(right)));
  writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, receipts }, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporaryPath, path);
}

function printPlan(plan) {
  console.log(
    `${colors.blue}Validation plan${colors.reset}: ${plan.effectiveIntent} · ${plan.risk} · ${plan.changedPaths.length} changed path(s)`,
  );
  console.log(
    `${colors.blue}Budget${colors.reset}: ${plan.budget.estimatedWallSeconds}s estimated wall` +
      ` (${plan.budget.automatedSeconds}s summed)` +
      (plan.budget.hardLimitSeconds === null
        ? " / uncapped"
        : ` / ${plan.budget.hardLimitSeconds}s hard limit`),
  );
  for (const check of plan.checks) {
    const flags = [
      check.mandatory ? "mandatory" : null,
      check.state === "blocked" ? `blocked:${check.blockedBy.join(",")}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`  - ${check.id}${flags ? ` (${flags})` : ""}`);
  }
  for (const skipped of plan.skipped ?? []) {
    console.log(`  - ${skipped.id} (skipped by compatibility filter)`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    showHelp();
    return;
  }

  const gitInputs = options.cancelled
    ? {
        base: options.base ?? null,
        head: options.head ?? null,
        changedPaths: options.changedPaths,
        workingCopyFingerprint: null,
      }
    : resolveGitInputs(options);
  const environment = options.cancelled
    ? { profile: "cancelled", toolchain: {}, capabilities: {} }
    : await detectEnvironment(options);
  const plan = buildLocalValidationPlan(options, gitInputs, environment);

  if (options.planJson) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  printPlan(plan);
  if (options.generateIndexer) {
    console.log(
      `${colors.yellow}Note:${colors.reset} --generate-indexer is retained for compatibility; selected Indexer package commands own code generation.`,
    );
  }

  const abortController = new AbortController();
  const cancel = () => abortController.abort("user-cancelled");
  process.once("SIGINT", cancel);
  const receiptStore = options.reusePassingReceipts ? loadPassingReceiptStore() : new Map();
  const execution = await executePlan(plan, {
    failFast: options.failFast,
    signal: abortController.signal,
    reusePassingReceipts: options.reusePassingReceipts,
    receiptStore,
    onCheckStart(check) {
      console.log(`\n${colors.blue}Running ${check.id}:${colors.reset} ${check.command ?? check.builtin}`);
    },
    onBatchStart(batch) {
      console.log(
        `\n${colors.blue}Running ${batch.length} checks concurrently:${colors.reset} ${batch
          .map((check) => check.id)
          .join(", ")}`,
      );
      for (const check of batch) console.log(`  ${check.id}: ${check.command ?? check.builtin}`);
    },
    onCheckComplete(check, result) {
      const color = result.ok ? colors.green : colors.red;
      if (result.output) {
        console.log(`\n${colors.blue}── ${check.id} output ──${colors.reset}`);
        process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
      }
      console.log(
        `${color}${result.ok ? "✓" : "✗"} ${check.id} (${result.durationSeconds ?? 0}s)${colors.reset}`,
      );
      for (const detail of result.details ?? []) console.log(`  ${detail}`);
    },
    onCheckReuse(check) {
      console.log(`\n${colors.green}↻ ${check.id} reused exact passing receipt${colors.reset}`);
    },
  });
  process.removeListener("SIGINT", cancel);
  if (options.reusePassingReceipts) savePassingReceiptStore(receiptStore);

  if (execution.status === "blocked") {
    console.log(`\n${colors.yellow}Validation blocked:${colors.reset}`);
    for (const entry of execution.blocked) {
      console.log(`  - ${entry.id}: ${entry.blockedBy.join(", ")}`);
      for (const capability of entry.blockedBy) {
        const hint = capabilityRecoveryHint(capability);
        if (hint) console.log(`    ${hint}`);
      }
    }
  } else if (execution.status === "cancelled") {
    console.log(`\n${colors.yellow}Validation cancelled; no additional checks will run.${colors.reset}`);
  } else if (execution.status === "needs-focus") {
    console.log(`\n${colors.yellow}Validation needs focused proof; no checks were started.${colors.reset}`);
    for (const instruction of plan.remediation ?? []) console.log(`  - ${instruction}`);
  } else if (execution.status === "budget-exceeded") {
    console.log(
      `\n${colors.red}Validation exceeded its ${plan.budget.hardLimitSeconds}s local budget; remaining noncritical checks were stopped.${colors.reset}`,
    );
  } else if (execution.status === "passed") {
    console.log(`\n${colors.green}Selected validation plan passed.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}Validation failed; dependent checks stopped.${colors.reset}`);
  }
  process.exitCode = execution.exitCode;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  reexecUnderSystemNodeIfNeeded({
    scriptPath: fileURLToPath(import.meta.url),
    sentinel: "GREEN_GOODS_CI_LOCAL_NODE_REEXEC",
    cwd: projectRoot,
  });
  reexecUnderCompatibleNodeIfNeeded({
    scriptPath: fileURLToPath(import.meta.url),
    sentinel: "GREEN_GOODS_CI_LOCAL_COMPAT_REEXEC",
    cwd: projectRoot,
    isSupported: isSupportedCiNodeVersion,
  });
  main().catch((error) => {
    console.error(`${colors.red}${error.message}${colors.reset}`);
    process.exitCode = 1;
  });
}
