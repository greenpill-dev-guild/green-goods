#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PACKAGES = ["root", "admin", "client", "shared", "agent", "indexer"];
const NODE_CLI = resolve(ROOT, "scripts/dev/node-cli.js");

// The Hub checkpoint is a maintained selection within the ordinary admin suite.
export const ADMIN_HUB_TESTS = [
  "src/__tests__/routing/command-palette-routes.test.tsx",
  "src/__tests__/routing/public-garden-redirect.test.ts",
  "src/__tests__/routing/route-folding.test.ts",
  "src/__tests__/routing/runtime-navigation.test.tsx",
  "src/__tests__/routing/toolbar-visibility.test.tsx",
  "src/__tests__/workspace-state.test.tsx",
  "src/__tests__/components/CanvasLayout.test.tsx",
  "src/__tests__/components/mobile-nav.test.tsx",
  "src/__tests__/components/empty-state.test.tsx",
  "src/__tests__/views/HubDetail.test.tsx",
  "src/components/Layout/commandPalette.results.test.ts",
  "src/views/Actions/actions.workspaceModel.test.ts",
  "src/views/Hub/hub.workbenchModel.test.ts",
];
export const SHARED_LIVE_TESTS = [
  "src/__tests__/integration/arbitrum-yield-data.test.ts",
  "src/__tests__/utils/blockchain/aave.live.test.ts",
];
export const SHARED_DEFAULT_EXCLUSIONS = [
  "src/__tests__/integration/**",
  "src/**/*.live.test.ts",
];

const COMMON = {
  help: { type: "boolean", short: "h" },
  explain: { type: "boolean" },
  json: { type: "boolean" },
};
const TEST_OPTIONS = {
  ...COMMON,
  scope: { type: "string" },
  suite: { type: "string" },
  coverage: { type: "boolean" },
  watch: { type: "boolean" },
  ui: { type: "boolean" },
  reporter: { type: "string", multiple: true },
  testNamePattern: { type: "string", short: "t" },
  project: { type: "string", multiple: true },
  maxWorkers: { type: "string" },
  testTimeout: { type: "string" },
  exclude: { type: "string", multiple: true },
  grep: { type: "string", short: "g" },
};

function parse(args, options) {
  const parsed = parseArgs({ args: args[0] === "--" ? args.slice(1) : args, options,
    strict: true, allowPositionals: true, tokens: true });
  const seen = new Set();
  for (const token of parsed.tokens) {
    if (token.kind !== "option") continue;
    if (seen.has(token.name) && !options[token.name].multiple) {
      throw new Error(`Repeated --${token.name}`);
    }
    if (typeof token.value === "string" && (!token.value || token.value.startsWith("-"))) {
      throw new Error(`Missing value for --${token.name}`);
    }
    seen.add(token.name);
  }
  if (parsed.positionals.some((value) => value.startsWith("-"))) {
    throw new Error("Unexpected option after --");
  }
  if (parsed.values.json && !parsed.values.explain && !parsed.values.help) {
    throw new Error("--json requires --explain or --help");
  }
  return parsed;
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`Unsupported ${label}: ${value}. Choose ${allowed.join(", ")}`);
  return value;
}

export function packageCommandHelp(pkg, action) {
  const prefix = pkg === "root" ? `bun run ${action}` : `bun run --cwd packages/${pkg} ${action}`;
  if (pkg === "indexer" && action === "dev") return `${prefix} [--restart]\nStarts Envio with the root environment. --restart preserves the existing destructive restart behavior.\n`;
  if (pkg === "indexer" && action === "docker") return `${prefix} <up|logs|down> [--detach]\nUp builds the package image; logs follows the indexer service; down preserves the database volume.\n`;
  if (action === "typecheck") return `${prefix} [--scope source|tests|full]\nDefault: source. Full preserves every package TypeScript project.\n`;
  if (action === "format") return `${prefix} [--check] [paths...]\nDefault: write formatting; --check never writes.\n`;
  const scopes = { admin: "all", client: "all", shared: "default|all-configured|live", agent: "all|unit|sqlite", indexer: "full|handlers|contract-events" };
  return `${prefix} [paths...] [--scope ${scopes[pkg]}]${pkg === "admin" ? " [--suite hub]" : ""}\n` +
    (pkg === "indexer" ? "--coverage --scope handlers [--reporter text --reporter json]; --grep <pattern>\n" :
      `--watch${["admin", "agent"].includes(pkg) ? " | --ui" : ""}; --coverage; --testNamePattern <pattern>; --project <name>; --reporter <name>\n`) +
    (pkg === "shared" ? "Coverage requires --scope all-configured. Live selects the two maintained RPC tests.\n" : "") +
    (pkg === "agent" ? "Coverage requires --scope unit and uses the existing Node 22+ coverage runner. Default all runs Node units and Bun SQLite.\n" : "") +
    "--explain [--json] resolves commands without starting tools or loading environment files.\n";
}

export function resolvePackageCommand(pkg, action, args = []) {
  oneOf(pkg, PACKAGES, "package");
  oneOf(action, pkg === "root" ? ["format"] : pkg === "indexer" ? ["test", "dev", "docker"] : ["test", "typecheck", "format"], "command");
  const options = action === "test" ? TEST_OPTIONS : action === "dev" ? { ...COMMON, restart: { type: "boolean" } } : action === "docker" ? { ...COMMON, detach: { type: "boolean" } } : { ...COMMON,
    ...(action === "typecheck" ? { scope: { type: "string" } } : { check: { type: "boolean" } }) };
  const { values, positionals: paths } = parse(args, options);
  const cwd = pkg === "root" ? ROOT : resolve(ROOT, "packages", pkg);
  const steps = [];
  const add = (executable, argv, env = {}, stepCwd = cwd) => steps.push({ executable, args: argv, env, cwd: stepCwd });
  const node = (argv, env = {}, stepCwd = cwd) => add("node", [NODE_CLI, ...argv], env, stepCwd);
  if (action === "dev") {
    if (paths.length) throw new Error("indexer dev does not accept positional arguments");
    if (!values.help) add("bun", ["--env-file=../../.env", NODE_CLI, "envio", "dev", ...(values.restart ? ["--restart"] : [])]);
  } else if (action === "docker") {
    if (values.help && paths.length === 0) return { package: pkg, action, steps, help: true, explain: false, json: Boolean(values.json) };
    if (paths.length !== 1) throw new Error("indexer docker requires exactly one action: up, logs, or down");
    const dockerAction = oneOf(paths[0], ["up", "logs", "down"], "Docker action");
    if (values.detach && dockerAction !== "up") throw new Error("--detach is supported only with indexer docker up");
    if (!values.help) {
      const compose = ["compose", "-f", "docker-compose.indexer.yaml"];
      if (dockerAction === "up") add("docker", [...compose, "up", "--build", ...(values.detach ? ["-d"] : [])]);
      else if (dockerAction === "logs") add("docker", [...compose, "logs", "-f", "indexer"]);
      else add("docker", [...compose, "down"]);
    }
  } else if (action === "format") {
    add("biome", ["format", ...(values.check ? [] : ["--write"]), ...(paths.length ? paths : [pkg === "agent" ? "src" : "."])]);
  } else if (action === "typecheck") {
    if (paths.length) throw new Error("typecheck does not accept positional arguments");
    const scope = oneOf(values.scope ?? "source", ["source", "tests", "full"], "typecheck scope");
    if (["admin", "client"].includes(pkg)) {
      const projectPrefix = pkg === "admin" ? "packages/admin/" : "";
      const stepCwd = pkg === "admin" ? ROOT : cwd;
      node(scope === "full" ? ["tsc", "-b", `${projectPrefix}tsconfig.json`] :
        ["tsc", "--noEmit", "-p", `${projectPrefix}tsconfig.${scope === "source" ? "app" : "test"}.json`], {}, stepCwd);
    } else {
      if (scope !== "tests") node(["tsc", "--noEmit", "-p", "tsconfig.json", ...(pkg === "shared" ? ["--composite", "false", "--incremental", "false"] : [])]);
      if (scope !== "source") node(["tsc", "--noEmit", "-p", "tsconfig.test.json"]);
    }
  } else {
    if (Number(Boolean(values.watch)) + Number(Boolean(values.ui)) + Number(Boolean(values.coverage)) > 1) {
      throw new Error("Choose only one of --watch, --ui, or --coverage");
    }
    if (values.suite && (pkg !== "admin" || values.suite !== "hub")) throw new Error("Only admin --suite hub is supported");
    if (values.suite && paths.length) throw new Error("A named suite cannot be combined with test paths");
    if (values.ui && !["admin", "agent"].includes(pkg)) throw new Error(`--ui is not supported for ${pkg}`);
    for (const name of ["maxWorkers", "testTimeout"]) {
      if (values[name] !== undefined && !/^[1-9]\d*$/.test(values[name])) throw new Error(`--${name} requires a positive integer`);
    }
    if (pkg === "indexer") {
      const scope = oneOf(values.scope ?? "full", ["full", "handlers", "contract-events"], "test scope");
      for (const key of ["watch", "ui", "testNamePattern", "project", "maxWorkers", "testTimeout", "exclude"]) {
        if (values[key] !== undefined) throw new Error(`--${key} is not supported for indexer`);
      }
      if (values.coverage && scope !== "handlers") throw new Error("Indexer coverage requires --scope handlers");
      if (values.reporter && !values.coverage) throw new Error("Indexer --reporter requires --coverage");
      if (scope === "contract-events" && paths.length) throw new Error("contract-events selects its own test file");
      if (scope === "full" && paths.length) throw new Error("Use --scope handlers for focused indexer tests; full requires all tests");
      if (scope === "full") node(["envio", "codegen"]);
      const mocha = ["mocha", "--require", "tsx", "--timeout", scope === "contract-events" ? "480000" : "30000",
        ...(scope === "contract-events" ? ["test/contractEventsLocal.test.ts"] : paths.length ? paths : ["test/**/*.ts"]),
        ...(values.grep ? ["--grep", values.grep] : [])];
      if (values.coverage) node(["c8", ...(values.reporter ?? []).flatMap((r) => ["--reporter", r]), "node", NODE_CLI, ...mocha]);
      else node(mocha, scope === "full" ? { GG_RUN_FULL_INDEXER_TEST_SUITE: "1" } : scope === "contract-events" ? { GG_RUN_LOCAL_CONTRACT_EVENT_INTEGRATION: "1" } : {});
    } else {
      if (values.grep) throw new Error("Use --testNamePattern for Vitest packages");
      const scopes = pkg === "shared" ? ["default", "all-configured", "live"] : pkg === "agent" ? ["all", "unit", "sqlite"] : ["all"];
      const scope = oneOf(values.scope ?? scopes[0], scopes, "test scope");
      if (values.coverage && pkg === "shared" && scope !== "all-configured") throw new Error("Shared coverage requires --scope all-configured");
      if (values.coverage && pkg === "agent" && scope !== "unit") throw new Error("Agent coverage requires --scope unit");
      if (pkg === "agent" && (values.watch || values.ui) && scope !== "unit") throw new Error("Agent watch/UI requires --scope unit");
      if (scope === "live" && (paths.length || values.watch || values.ui || values.coverage)) throw new Error("Live scope selects its two RPC tests and supports run mode only");
      const flags = Object.keys(TEST_OPTIONS).filter((name) => ![...Object.keys(COMMON), "scope", "suite", "coverage", "watch", "ui", "grep"].includes(name))
        .flatMap((name) => values[name] === undefined ? [] : (Array.isArray(values[name]) ? values[name] : [values[name]]).flatMap((value) => [`--${name}`, value]));
      const selected = values.suite ? ADMIN_HUB_TESTS : scope === "live" ? SHARED_LIVE_TESTS : paths;
      const env = pkg === "shared" ? (scope === "live" ? { RUN_LIVE_RPC_TESTS: "true" } : {}) : { APP_ENV: "test" };
      if (pkg === "agent") {
        const sqlitePaths = paths.filter((path) => path.includes("storage.sqlite.test"));
        const unitPaths = paths.filter((path) => !path.includes("storage.sqlite.test"));
        if (scope === "unit" && sqlitePaths.length) throw new Error("SQLite paths require --scope sqlite or all");
        if (scope === "sqlite" && unitPaths.length) throw new Error("SQLite scope accepts only storage.sqlite.test paths");
        if (values.coverage) add("bun", ["scripts/run-coverage.mjs", ...unitPaths, ...flags], env);
        else {
          if (scope !== "sqlite" && (paths.length === 0 || unitPaths.length > 0)) {
            node(["vitest", ...(values.watch ? [] : values.ui ? ["--ui"] : ["run"]), ...unitPaths, ...flags], env);
          }
          if (scope !== "unit" && (paths.length === 0 || sqlitePaths.length > 0)) {
            if (flags.length || values.watch || values.ui) throw new Error("SQLite selection does not accept Vitest options; choose --scope unit for those options");
            add("bun", ["--bun", "run", "vitest", "run"], { ...env, AGENT_SQLITE_INTEGRATION: "true" });
          }
        }
      } else {
        const argv = ["vitest", ...(values.watch ? ["--standalone"] : values.ui ? ["--ui"] : ["run"]),
          ...(pkg === "shared" && scope === "default" ? SHARED_DEFAULT_EXCLUSIONS.flatMap((path) => ["--exclude", path]) : []),
          ...selected, ...(values.coverage ? ["--coverage"] : []), ...flags];
        // Preserve the pre-existing standalone/UI executable; run uses real Node.
        if (values.watch || values.ui) add("vitest", argv.slice(1), env);
        else node(argv, env);
      }
    }
  }
  return { package: pkg, action, steps, help: Boolean(values.help), explain: Boolean(values.explain), json: Boolean(values.json) };
}

export async function executePackageCommand(plan, { spawnImpl = spawn, signals = process } = {}) {
  let child;
  let cancelled;
  const stop = (signal) => {
    cancelled ??= signal;
    if (child) child.kill(signal);
  };
  const onInt = () => stop("SIGINT");
  const onTerm = () => stop("SIGTERM");
  signals.on("SIGINT", onInt);
  signals.on("SIGTERM", onTerm);
  try {
    for (const step of plan.steps) {
      if (cancelled) break;
      const result = await new Promise((resolveResult, reject) => {
        child = spawnImpl(step.executable, step.args, { cwd: step.cwd, env: { ...process.env, ...step.env }, stdio: "inherit", shell: false });
        child.once("error", reject);
        child.once("close", (code, signal) => resolveResult({ code, signal }));
      });
      child = undefined;
      if (cancelled) break;
      if (result.signal) return result.signal === "SIGINT" ? 130 : 143;
      if (result.code !== 0) return result.code ?? 1;
    }
    return cancelled === "SIGINT" ? 130 : cancelled ? 143 : 0;
  } finally {
    signals.removeListener("SIGINT", onInt);
    signals.removeListener("SIGTERM", onTerm);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [pkg, action, ...args] = process.argv.slice(2);
    const plan = resolvePackageCommand(pkg, action, args);
    if (plan.help) process.stdout.write(plan.json ? `${JSON.stringify({ package: pkg, action, help: packageCommandHelp(pkg, action) }, null, 2)}\n` : packageCommandHelp(pkg, action));
    else if (plan.explain) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    else process.exitCode = await executePackageCommand(plan);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
