#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const CONTRACTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NODE_WRAPPER = "../../scripts/dev/node-cli.js";
const GAS_EXCLUSION = "^(testSettlementFunding_proposedFundedBatchAcknowledgmentFitsTheFixedSourceGasBudget|testSettlementFunding_nextFundedBatchSizeDoesNotFitTheFixedSourceGasBudget|testSettlementFunding_hardMaxFundedBatchAcknowledgmentDoesNotFitTheFixedSourceGasBudget)\\(\\)$";
const PROTOCOL_EXCLUSION = ".*[cC]elo.*|.*[uU]nlock.*";
const LITE_EXCLUSION = "test/integration/Garden*|test/unit/GardenAccount*|test/unit/GardenToken*|test/E2E*|test/Fuzz*|test/Gas*|test/Storage*|test/Upgrade*|test/fork/e2e/*|test/fork/eas/*|test/fork/gardens/*";
const forgeOptions = {
  "match-path": "string", "match-contract": "string", "match-test": "string",
  "no-match-path": "string", "no-match-contract": "string", "no-match-test": "string",
  threads: "string", "gas-report": "boolean", list: "boolean", json: "boolean", isolate: "boolean",
  v: "boolean", vv: "boolean", vvv: "boolean", vvvv: "boolean", vvvvv: "boolean",
};

export const COMMAND_HELP = {
  build: "build [--mode auto|fast|full|changed|target|fresh|core] [Solidity paths for target]",
  test: "test [--suite all|solidity|script|release-gas] [--profile standard|deep|fast|lite|gas|match] [test path / Forge filters]",
  fork: "test:fork [--suite all|protocol|garden-account-release|garden-roles] [--ci (protocol only)] [Forge filters for all/protocol]",
  audit: "test:audit <realism|tooling|coverage|full> [--mode advisory|enforce-must-fix|enforce-should-fix] [--report-md path] [--report-json path]",
  format: "format [--check]",
  lint: "lint [--check|--fix]",
  clean: "clean <artifacts|test-cache>",
};

function parse(argv, options) {
  // Bun's conventional forwarding separator is not an application argument.
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const parsed = parseArgs({ args, options: Object.fromEntries(Object.entries(options).map(([name, type]) => [name, { type }])), allowPositionals: true, strict: true, tokens: true });
  const seen = new Set();
  for (const token of parsed.tokens) {
    if (token.kind !== "option") continue;
    if (seen.has(token.name)) throw new Error(`Repeated option: --${token.name}`);
    seen.add(token.name);
    if (token.value !== undefined && (!token.value.trim() || token.value.startsWith("--"))) throw new Error(`Missing value for --${token.name}`);
  }
  return parsed;
}

function choose(value, choices, label) {
  if (!choices.includes(value)) throw new Error(`Invalid ${label}: ${value}; expected ${choices.join("| ")}`);
  return value;
}
function noPositionals(positionals) {
  if (positionals.length) throw new Error(`Unexpected argument: ${positionals[0]}`);
}
function step(command, args, env = {}) { return { command, args, env }; }
function node(args) { return step(process.execPath, [NODE_WRAPPER, ...args]); }
function bun(file, args = []) { return step("bun", [file, ...args]); }
function scriptTests(paths = []) {
  return [node(["node", "--test", ...readdirSync(path.join(CONTRACTS_ROOT, "script/cli")).filter(name => name.endsWith(".node-check.mjs")).sort().map(name => `script/cli/${name}`), "script/utils/package-commands.node-check.mjs"]), node(["vitest", "run", "--dir", "script", ...paths])];
}
function solidity(profile, values, positionals) {
  choose(profile, ["standard", "deep", "fast", "lite", "gas", "match"], "Solidity profile");
  const args = ["test"];
  const env = {};
  if (profile === "match") {
    if (positionals.length !== 1) throw new Error("The match profile requires exactly one test path");
    args.push("--match-path", positionals[0]);
  } else {
    noPositionals(positionals);
    if (profile === "gas") args.push("--gas-report", "--no-match-contract", "E2E");
    else {
      env.FOUNDRY_PROFILE = profile === "deep" ? "ci" : "test";
      if (profile === "lite") args.push("--no-match-path", LITE_EXCLUSION);
      else {
        args.push("--no-match-contract", profile === "fast" ? "E2E|Fork" : "E2E");
        if (profile !== "fast") args.push("--no-match-path", "test/fork/**");
      }
      args.push("--no-match-test", GAS_EXCLUSION);
    }
  }
  args.push(...forgeArguments(values, args));
  return step("forge", args, env);
}
function forgeArguments(values, existing = []) {
  const args = [];
  for (const [name, type] of Object.entries(forgeOptions)) {
    if (values[name] === undefined) continue;
    const flag = /^v+$/.test(name) ? `-${name}` : `--${name}`;
    if (existing.includes(flag)) throw new Error(`${flag} conflicts with the selected profile`);
    if (name === "threads" && !/^[1-9]\d*$/.test(values[name])) throw new Error("--threads requires a positive integer");
    args.push(flag);
    if (type === "string") args.push(values[name]);
  }
  if (Object.keys(values).filter(name => /^v+$/.test(name)).length > 1) throw new Error("Conflicting verbosity selections");
  return args;
}

/** Resolve every argument before loading environment files or starting subprocesses. */
export function resolvePackageCommand(command, argv, env = process.env) {
  if (!Object.hasOwn(COMMAND_HELP, command)) throw new Error(`Unknown package command: ${command}`);
  const optionTypes = { help: "boolean", explain: "boolean" };
  if (command === "build") optionTypes.mode = "string";
  if (command === "format" || command === "lint") optionTypes.check = "boolean";
  if (command === "lint") optionTypes.fix = "boolean";
  if (command === "test" || command === "fork") Object.assign(optionTypes, forgeOptions, { suite: "string" });
  if (command === "test") optionTypes.profile = "string";
  if (command === "fork") optionTypes.ci = "boolean";
  if (command === "audit") Object.assign(optionTypes, { mode: "string", "report-md": "string", "report-json": "string" });
  // Support Forge's conventional short verbosity options without permitting arbitrary passthrough.
  const normalized = argv.map(arg => /^-v{1,5}$/.test(arg) ? `-${arg}` : arg);
  const { values, positionals } = parse(normalized, optionTypes);
  if (values.help) return { help: COMMAND_HELP[command], steps: [] };
  let steps = [];
  let loadRootEnvironment = false;
  if (command === "build") {
    const mode = choose(values.mode ?? env.GG_CONTRACTS_BUILD_MODE ?? "auto", ["auto", "fast", "full", "changed", "target", "fresh", "core"], "build mode");
    if (mode === "target") {
      if (!positionals.length || positionals.some(p => !p.endsWith(".sol") || p.startsWith("-"))) throw new Error("Target mode requires Solidity paths");
      steps = [bun("script/utils/build-target.ts", positionals)];
    } else {
      noPositionals(positionals);
      if (mode === "fresh") steps = [{ clean: "artifacts" }, step("forge", ["build"])];
      else if (mode === "core") steps = [step("forge", ["build", "--skip", "test", "--skip", "script"])];
      else if (mode === "changed") steps = [bun("script/utils/build-changed.ts")];
      else steps = [{ ...bun("script/utils/build-adaptive.ts"), env: { GG_CONTRACTS_BUILD_MODE: mode } }];
    }
  } else if (command === "format" || command === "lint") {
    noPositionals(positionals);
    if (values.check && values.fix) throw new Error("--check and --fix conflict");
    steps = [node(["node", "../../scripts/contracts/check-foundry-version.mjs"]), step("forge", ["fmt", ...(values.check ? ["--check"] : [])])];
    if (command === "lint") steps.push(node(["node", "node_modules/solhint/solhint.js", "--config", "./.solhint.json", "src/**/*.sol", "--ignore-path", ".solhintignore", ...(values.fix ? ["--fix"] : [])]));
  } else if (command === "clean") {
    if (positionals.length !== 1) throw new Error("Choose clean artifacts or clean test-cache");
    steps = [{ clean: choose(positionals[0], ["artifacts", "test-cache"], "cleanup scope") }];
  } else if (command === "test") {
    const suite = choose(values.suite ?? "all", ["all", "solidity", "script", "release-gas"], "test suite");
    if (suite !== "solidity" && (values.profile || Object.keys(forgeOptions).some(name => values[name] !== undefined))) throw new Error("Solidity profile and Forge options require --suite solidity");
    if (suite !== "script" && suite !== "solidity") noPositionals(positionals);
    if (suite === "all") steps = [node(["tsc", "--noEmit", "-p", "tsconfig.json"]), solidity("standard", {}, []), bun("script/utils/run-release-gas-gate.ts"), ...scriptTests()];
    if (suite === "solidity") steps = [solidity(values.profile ?? "standard", values, positionals)];
    if (suite === "script") steps = scriptTests(positionals);
    if (suite === "release-gas") steps = [bun("script/utils/run-release-gas-gate.ts")];
  } else if (command === "fork") {
    noPositionals(positionals);
    const suite = choose(values.suite ?? "all", ["all", "protocol", "garden-account-release", "garden-roles"], "fork suite");
    if (values.ci && suite !== "protocol") throw new Error("--ci requires --suite protocol");
    if (suite.startsWith("garden-")) {
      if (Object.keys(forgeOptions).some(name => values[name] !== undefined)) throw new Error("Release fork proofs do not accept Forge overrides");
      steps = [bun(`script/utils/${suite === "garden-roles" ? "run-garden-roles-proof" : "run-garden-account-release"}.ts`)];
    } else {
      const args = ["test", "--match-path", "test/fork/**"];
      if (suite === "protocol") args.push("--no-match-test", PROTOCOL_EXCLUSION);
      if (values.ci) args.push("--threads", "1");
      args.push(...forgeArguments(values, args));
      if (!Object.keys(values).some(name => /^v+$/.test(name))) args.push("-vvv");
      steps = [step("forge", args, { FOUNDRY_PROFILE: "fork" })];
      loadRootEnvironment = true;
    }
  } else if (command === "audit") {
    if (positionals.length !== 1) throw new Error("Choose an audit subcommand");
    const suite = choose(positionals[0], ["realism", "tooling", "coverage", "full"], "audit subcommand");
    if (!["realism", "full"].includes(suite) && (values.mode || values["report-md"] || values["report-json"])) throw new Error("Report and mode flags require realism or full");
    const realism = () => step("bash", ["../../scripts/contracts/check-test-realism.sh", "--mode", choose(values.mode ?? env.CONTRACT_REALISM_MODE ?? "advisory", ["advisory", "enforce-must-fix", "enforce-should-fix"], "realism mode"), "--report-md", values["report-md"] ?? env.CONTRACT_REALISM_REPORT_MD ?? "../../output/contracts-test-audit/realism-report.md", "--report-json", values["report-json"] ?? env.CONTRACT_REALISM_REPORT_JSON ?? "../../output/contracts-test-audit/realism-report.json"]);
    const tooling = () => step("bash", ["../../scripts/contracts/validate-test-realism-tooling.sh"]);
    const coverage = () => step("bash", ["../../scripts/contracts/run-coverage-audit.sh"], { CONTRACT_COVERAGE_MODE: "true" });
    steps = suite === "full" ? [tooling(), realism(), coverage()] : [({ realism, tooling, coverage })[suite]()];
  }
  return { command, cwd: CONTRACTS_ROOT, steps, loadRootEnvironment, explain: Boolean(values.explain) };
}

export function cleanArtifacts(scope, cwd) {
  const paths = scope === "test-cache"
    ? [".generated/foundry/out/test", ".generated/foundry/cache/test", "out-test", "cache-test"]
    : [".generated/foundry/out", ".generated/foundry/cache", ...readdirSync(cwd).filter(name => /^(out|cache)(-|$)/.test(name))];
  for (const relative of paths) rmSync(path.join(cwd, relative), { recursive: true, force: true });
}

export async function executePackagePlan(plan, { env = process.env, spawnImpl = spawn, clean = cleanArtifacts } = {}) {
  const environment = { ...env };
  if (plan.loadRootEnvironment) {
    const { config } = await import("dotenv");
    // Preserve root environment override behavior; never read package-level environment files.
    config({ path: path.resolve(plan.cwd, "../../.env"), processEnv: environment, override: true, quiet: true });
  }
  let cancelled = null;
  let activeChild;
  const listeners = Object.fromEntries(["SIGINT", "SIGTERM"].map(signal => [signal, () => { cancelled = signal; activeChild?.kill(signal); }]));
  for (const [signal, listener] of Object.entries(listeners)) process.on(signal, listener);
  try {
    for (const operation of plan.steps) {
      if (cancelled) return { code: cancelled === "SIGINT" ? 130 : 143, signal: cancelled };
      if (operation.clean) { clean(operation.clean, plan.cwd); continue; }
      const result = await new Promise(resolve => {
        activeChild = spawnImpl(operation.command, operation.args, { cwd: plan.cwd, env: { ...environment, ...operation.env }, stdio: "inherit", shell: false });
        activeChild.once("error", error => { process.stderr.write(`${error.message}\n`); resolve({ code: 1 }); });
        activeChild.once("exit", (code, signal) => resolve({ code: code ?? (signal === "SIGINT" ? 130 : 143), signal }));
      });
      activeChild = undefined;
      if (cancelled) return { code: cancelled === "SIGINT" ? 130 : 143, signal: cancelled };
      if (result.code !== 0 || result.signal) return result;
    }
    return { code: 0 };
  } finally {
    for (const [signal, listener] of Object.entries(listeners)) process.off(signal, listener);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const plan = resolvePackageCommand(process.argv[2], process.argv.slice(3));
    if (plan.help) process.stdout.write(`${plan.help}\n`);
    else if (plan.explain) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    else process.exitCode = (await executePackagePlan(plan)).code;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
