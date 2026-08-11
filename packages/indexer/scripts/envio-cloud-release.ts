#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

export type CloudAction = "plan" | "preflight" | "verify" | "deploy" | "promote" | "rollback";

export interface CloudReleaseOptions {
  action: CloudAction;
  organisation: string;
  indexer: string;
  commit: string;
  previousProductionCommit: string;
  expectedBranch: string;
  expectedRootDir: string;
  expectedConfigFile: string;
  waitTillSynced: boolean;
}

interface CloudJsonResponse {
  ok?: boolean;
  data?: unknown;
  error?: string;
  [key: string]: unknown;
}

const MUTATING_ACTIONS = new Set<CloudAction>(["deploy", "promote", "rollback"]);
const DEFAULT_ROOT_DIR = "packages/indexer";
const DEFAULT_CONFIG_FILE = "config.yaml";

export function showHelp(): void {
  console.log(`Envio Cloud release wrapper

Usage:
  bun run cloud:release -- <action> --org <organisation> --indexer <name> \\
    --commit <40-char-sha> --previous-production-commit <40-char-sha> --expected-branch <branch>

Actions:
  plan       Print the exact read-only and separately gated mutation plan; never calls Envio Cloud
  preflight  Read live indexer settings and commits; require auto-deploy=false and exact Git settings
  verify     Read deployment status, info, and GraphQL endpoint; never promotes a deployment
  deploy     Phase B only: preflight, then deploy exactly one inactive commit
  promote    Phase B only: verify, then promote exactly one synced commit to production
  rollback   Phase B only: verify, then promote the named prior production commit

Options:
  --org <value>                   Exact Envio Cloud organisation
  --indexer <value>               Exact Envio Cloud indexer
  --commit <sha>                  Exact 40-character Git commit
  --previous-production-commit <sha> Exact 40-character rollback checkpoint
  --expected-branch <value>       Exact configured deployment branch
  --expected-root-dir <value>     Defaults to packages/indexer
  --expected-config-file <value>  Defaults to config.yaml
  --wait-till-synced              Verify waits for a fully synced deployment

Safety:
  This wrapper never installs envio-cloud and never falls back to npx. The separately installed
  alpha CLI must already be available as envio-cloud (or through ENVIO_CLOUD_BIN).

  deploy, promote, and rollback require a stage-specific Phase B authorization value in
  GREEN_GOODS_ENVIO_PHASE_B_AUTHORIZATION. Run plan to print the exact required value. Deploying
  never implies production promotion; rollback is a distinct promotion of a named prior commit.
`);
}

function requiredValue(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`Missing required ${flag}`);
  return value;
}

function optionalValue(args: string[], flag: string, fallback: string): string {
  const index = args.indexOf(flag);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
  return value;
}

function requireIdentifier(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)) {
    throw new Error(`${label} contains unsupported characters`);
  }
}

function requireRelativePath(value: string, label: string): void {
  if (
    value.startsWith("/") ||
    value.split("/").includes("..") ||
    value.trim() !== value ||
    value.length === 0
  ) {
    throw new Error(`${label} must be an exact repository-relative path`);
  }
}

function validateFlagShape(args: string[]): void {
  const valueFlags = new Set([
    "--org",
    "--indexer",
    "--commit",
    "--previous-production-commit",
    "--expected-branch",
    "--expected-root-dir",
    "--expected-config-file",
  ]);
  const booleanFlags = new Set(["--wait-till-synced"]);
  const seen = new Set<string>();
  for (let index = 1; index < args.length; index++) {
    const flag = args[index];
    if (!flag) throw new Error("Unexpected empty option");
    if (!valueFlags.has(flag) && !booleanFlags.has(flag))
      throw new Error(`Unknown option: ${flag}`);
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (valueFlags.has(flag)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    }
  }
}

export function parseArgs(args: string[]): CloudReleaseOptions {
  const action = args[0] as CloudAction | undefined;
  if (
    !action ||
    !["plan", "preflight", "verify", "deploy", "promote", "rollback"].includes(action)
  ) {
    throw new Error("Action must be one of plan, preflight, verify, deploy, promote, or rollback");
  }
  validateFlagShape(args);
  const options: CloudReleaseOptions = {
    action,
    organisation: requiredValue(args, "--org"),
    indexer: requiredValue(args, "--indexer"),
    commit: requiredValue(args, "--commit"),
    previousProductionCommit: requiredValue(args, "--previous-production-commit"),
    expectedBranch: requiredValue(args, "--expected-branch"),
    expectedRootDir: optionalValue(args, "--expected-root-dir", DEFAULT_ROOT_DIR),
    expectedConfigFile: optionalValue(args, "--expected-config-file", DEFAULT_CONFIG_FILE),
    waitTillSynced: args.includes("--wait-till-synced"),
  };
  requireIdentifier(options.organisation, "--org");
  requireIdentifier(options.indexer, "--indexer");
  if (!/^[0-9a-f]{40}$/u.test(options.commit))
    throw new Error("--commit must be an exact lowercase 40-character SHA");
  if (!/^[0-9a-f]{40}$/u.test(options.previousProductionCommit)) {
    throw new Error("--previous-production-commit must be an exact lowercase 40-character SHA");
  }
  if (options.previousProductionCommit === options.commit) {
    throw new Error("--previous-production-commit must differ from the candidate --commit");
  }
  requireRelativePath(options.expectedBranch, "--expected-branch");
  requireRelativePath(options.expectedRootDir, "--expected-root-dir");
  requireRelativePath(options.expectedConfigFile, "--expected-config-file");
  return options;
}

function authorizationValue(options: CloudReleaseOptions): string {
  const targetCommit =
    options.action === "rollback" ? options.previousProductionCommit : options.commit;
  return `envio:${options.action}:${options.organisation}/${options.indexer}@${targetCommit}`;
}

export function buildPlan(options: CloudReleaseOptions) {
  const target = [options.indexer, options.commit, options.organisation];
  const rollbackTarget = [options.indexer, options.previousProductionCommit, options.organisation];
  return {
    schemaVersion: 1,
    activationAuthorized: false,
    target: {
      organisation: options.organisation,
      indexer: options.indexer,
      commit: options.commit,
      previousProductionCommit: options.previousProductionCommit,
      branch: options.expectedBranch,
      rootDir: options.expectedRootDir,
      configFile: options.expectedConfigFile,
      autoDeploy: false,
    },
    transactionBoundaries: [
      {
        action: "deploy",
        command: ["deployment", "deploy", ...target, "--yes"],
        requiredAuthorization: `envio:deploy:${options.organisation}/${options.indexer}@${options.commit}`,
        resumableState:
          "prior production deployment remains serving while the new version reindexes",
        nextGate: "read status/info/endpoint and settlement execution-key convergence",
      },
      {
        action: "promote",
        command: ["deployment", "promote", ...target, "--yes"],
        requiredAuthorization: `envio:promote:${options.organisation}/${options.indexer}@${options.commit}`,
        resumableState:
          "named commit owns the production endpoint; prior deployment remains the rollback checkpoint",
        nextGate: "read production endpoint and exact settlement acknowledgment convergence",
      },
      {
        action: "rollback",
        command: ["deployment", "promote", ...rollbackTarget, "--yes"],
        requiredAuthorization: `envio:rollback:${options.organisation}/${options.indexer}@${options.previousProductionCommit}`,
        resumableState: "named prior commit is restored at the production endpoint",
        nextGate: "read endpoint and verify the prior address/start-block configuration",
      },
    ],
    requiredAuthorization: MUTATING_ACTIONS.has(options.action)
      ? authorizationValue(options)
      : null,
  };
}

function normalizeKey(value: string): string {
  return value.replace(/[-_]/gu, "").toLowerCase();
}

function findKey(value: unknown, wanted: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (normalizeKey(key) === normalizeKey(wanted)) return child;
    const nested = findKey(child, wanted);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function exactSetting(value: unknown, key: string, expected: string | boolean): void {
  const actual = findKey(value, key);
  if (actual !== expected)
    throw new Error(
      `Live Envio setting ${key} mismatch: expected ${String(expected)}, got ${String(actual)}`
    );
}

function cloudBinary(): string {
  return process.env.ENVIO_CLOUD_BIN?.trim() || "envio-cloud";
}

function runCloud(args: string[], emitEvidence = true): CloudJsonResponse {
  const result = spawnSync(cloudBinary(), args, {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw new Error(
      `envio-cloud is unavailable (${result.error.message}); install/authenticate it outside the repository first`
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `envio-cloud ${args.join(" ")} failed (${result.status}): ${result.stderr.trim() || result.stdout.trim()}`
    );
  }
  const output = result.stdout.trim();
  if (!output) {
    const empty = { ok: true };
    if (emitEvidence) console.log(JSON.stringify({ cloudCommand: args, response: empty }, null, 2));
    return empty;
  }
  try {
    const parsed = JSON.parse(output) as CloudJsonResponse;
    if (parsed.ok === false) throw new Error(parsed.error || "Envio Cloud returned ok=false");
    if (emitEvidence)
      console.log(JSON.stringify({ cloudCommand: args, response: parsed }, null, 2));
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error(`envio-cloud did not return JSON for ${args.join(" ")}`);
    throw error;
  }
}

function preflight(options: CloudReleaseOptions): void {
  runCloud(["token", "-o", "json"], false);
  console.log(
    JSON.stringify({ authentication: "verified", credentialMaterialEmitted: false }, null, 2)
  );
  runCloud(["indexer", "get", options.indexer, options.organisation, "-o", "json"]);
  const settings = runCloud([
    "indexer",
    "settings",
    "get",
    options.indexer,
    options.organisation,
    "-o",
    "json",
  ]);
  exactSetting(settings, "branch", options.expectedBranch);
  exactSetting(settings, "rootDir", options.expectedRootDir);
  exactSetting(settings, "configFile", options.expectedConfigFile);
  exactSetting(settings, "autoDeploy", false);
  const commits = runCloud([
    "indexer",
    "commits",
    options.indexer,
    options.organisation,
    "--limit",
    "20",
    "-o",
    "json",
  ]);
  if (!JSON.stringify(commits).toLowerCase().includes(options.commit)) {
    throw new Error(
      `Pinned commit ${options.commit} is not present in the live Envio Cloud commit inventory`
    );
  }
  runCloud([
    "deployment",
    "info",
    options.indexer,
    options.previousProductionCommit,
    options.organisation,
    "-o",
    "json",
  ]);
  runCloud([
    "deployment",
    "endpoint",
    options.indexer,
    options.previousProductionCommit,
    options.organisation,
    "-o",
    "json",
  ]);
}

function verify(options: CloudReleaseOptions): void {
  const statusArgs = [
    "deployment",
    "status",
    options.indexer,
    options.commit,
    options.organisation,
  ];
  if (options.waitTillSynced) statusArgs.push("--watch-till-synced");
  statusArgs.push("-o", "json");
  runCloud(statusArgs);
  runCloud([
    "deployment",
    "info",
    options.indexer,
    options.commit,
    options.organisation,
    "-o",
    "json",
  ]);
  runCloud([
    "deployment",
    "endpoint",
    options.indexer,
    options.commit,
    options.organisation,
    "-o",
    "json",
  ]);
}

function requireAuthorization(options: CloudReleaseOptions): void {
  const expected = authorizationValue(options);
  if (process.env.GREEN_GOODS_ENVIO_PHASE_B_AUTHORIZATION !== expected) {
    throw new Error(
      `Missing exact Phase B authorization; required GREEN_GOODS_ENVIO_PHASE_B_AUTHORIZATION=${expected}`
    );
  }
}

export function run(options: CloudReleaseOptions): void {
  const plan = buildPlan(options);
  console.log(JSON.stringify(plan, null, 2));
  if (options.action === "plan") return;
  if (options.action === "preflight") return preflight(options);
  if (options.action === "verify") return verify(options);

  requireAuthorization(options);
  if (options.action === "deploy") {
    preflight(options);
    runCloud([
      "deployment",
      "deploy",
      options.indexer,
      options.commit,
      options.organisation,
      "--yes",
      "-o",
      "json",
    ]);
    verify(options);
    return;
  }

  preflight(options);
  const targetCommit =
    options.action === "rollback" ? options.previousProductionCommit : options.commit;
  verify({ ...options, commit: targetCommit, waitTillSynced: true });
  runCloud([
    "deployment",
    "promote",
    options.indexer,
    targetCommit,
    options.organisation,
    "--yes",
    "-o",
    "json",
  ]);
  verify({ ...options, commit: targetCommit, waitTillSynced: false });
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      showHelp();
      process.exit(0);
    }
    run(parseArgs(args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
