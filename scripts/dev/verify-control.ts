#!/usr/bin/env bun
// The control CLI behind the verify-green-goods skill: launch the client or admin dev server in
// Vite's test mode on ports of its own, check it, drive it in Chromium with the strict Playwright
// mock backend and the dev mock-auth seam, and tear down only what it started. Evidence goes to
// .cache/verify/<run>/ and survives cleanup.
//
//   bun scripts/dev/verify-control.ts launch client|admin [--run <id>]
//   bun scripts/dev/verify-control.ts doctor [--run <id>]
//   bun scripts/dev/verify-control.ts drive client|admin --feature <id> [--run <id>] [--role user|steward|deployer|disconnected]
//       [--width 375|1280] --step <step> [--step <step> ...]
//   bun scripts/dev/verify-control.ts cleanup [--run <id>]
//
// Steps run in order, in one browser page:
//   goto:<path>                     navigate and wait for the app shell to mount
//   click:<role>:<name>             click the element with that ARIA role and accessible name
//   fill:<role>:<name>:<value>      fill a textbox (or other fillable role) by accessible name
//   expect:<role>:<name>            fail unless that element is visible
//   expect-hidden:<role>:<name>     wait until that element is gone (the previous page has left)
//   expect-url:<text>               fail unless the URL contains the text
//   snapshot:<file>                 write the page's ARIA snapshot to <evidence>/<file>
//   screenshot:<file>               write a full-page PNG to <evidence>/<file>
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../..");
const verifyRoot = path.join(repoRoot, ".cache/verify");
// Ports apart from the dev defaults (3001, 3002) and Playwright's, so a run never drives or kills
// a server someone else started.
const APPS = {
  client: { cwd: "packages/client", port: 3101 },
  admin: { cwd: "packages/admin", port: 3102 },
} as const;
type App = keyof typeof APPS;
const ROLES = ["user", "steward", "deployer", "disconnected"] as const;
type Role = (typeof ROLES)[number];
// How long an expect step waits: a route's first visit waits on Vite compiling it, which can
// take most of the 30 s that goto already allows.
const WAIT_MS = 30_000;
// Run ids, feature ids and evidence file names: no leading dot, so never `.` or `..`.
const NAME = /^[\w-][\w.-]*$/;

interface ServerState {
  app: App;
  status: "starting" | "ready";
  pid: number;
  // The leader's start time as ps prints it, and the boot it belongs to: a reused pid has another.
  started: string;
  boot: string;
  port: number;
  url: string | null;
  log: string;
  repoRoot: string;
  startedAt: string;
  commit: string;
}

function fail(message: string, code = 1): never {
  console.error(`verify-control: ${message}`);
  process.exit(code);
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function options(argv: string[], name: string): string[] {
  return argv.flatMap((value, index) => (argv[index - 1] === name ? [value] : []));
}

function runDir(argv: string[]): { run: string; dir: string } {
  const run = option(argv, "--run") ?? "default";
  if (!NAME.test(run)) fail(`run id must be letters, digits, dot, dash or underscore, not starting with a dot: ${run}`);
  const dir = path.join(verifyRoot, run);
  mkdirSync(dir, { recursive: true });
  return { run, dir };
}

/** A file inside `dir`, or a failure: step text never writes outside the evidence folder. */
function evidenceFile(dir: string, name: string): string {
  const file = path.resolve(dir, name);
  if (!NAME.test(name) || !file.startsWith(`${dir}${path.sep}`)) throw new Error(`evidence file name not allowed: ${name}`);
  return file;
}

const statePath = (dir: string, app: App) => path.join(dir, `${app}.server.json`);

function readState(dir: string, app: App): ServerState | null {
  const file = statePath(dir, app);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ServerState) : null;
}

function writeState(dir: string, state: ServerState) {
  writeFileSync(statePath(dir, state.app), `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * A command's output. `emptyExit` is the exit code that means "nothing matched" (ps for a missing
 * pid, lsof for a free port); any other failure throws, so a broken ps or lsof never reads as a
 * process that is gone.
 */
function run(command: string[]) {
  try {
    // A fixed zone and locale, so ps prints a start time that reads the same in every shell.
    return Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe", env: { ...process.env, TZ: "UTC", LC_ALL: "C" } });
  } catch (error) {
    throw new Error(`${command[0]} is required and could not run: ${(error as Error).message}`);
  }
}

function output(command: string[], emptyExit?: number): string {
  const result = run(command);
  if (result.exitCode === 0) return result.stdout.toString().trim();
  if (result.exitCode === emptyExit && !result.stderr.toString().trim()) return "";
  throw new Error(`${command.join(" ")} failed (${result.exitCode}): ${result.stderr.toString().trim()}`);
}

const startTime = (pid: number) => output(["ps", "-o", "lstart=", "-p", String(pid)], 1);
/** An id for this boot of the machine: Linux's boot_id, or macOS's boot session uuid. */
const bootId = () =>
  existsSync("/proc/sys/kernel/random/boot_id")
    ? readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim()
    : output(["sysctl", "-n", "kern.bootsessionuuid"]);

/** Every process whose group is `pgid`, with its start time and command line. */
function groupMembers(pgid: number): { pid: number; command: string }[] {
  return output(["ps", "-A", "-o", "pgid=,pid=,command="])
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter((match): match is RegExpMatchArray => match !== null && Number(match[1]) === pgid)
    .map((match) => ({ pid: Number(match[2]), command: match[3] }));
}

/** Process groups listening on `port`. */
function listenerGroups(port: number): number[] {
  const pids = output(["lsof", "-nPw", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"], 1).split("\n").filter(Boolean);
  return [...new Set(pids.map((pid) => Number(output(["ps", "-o", "pgid=", "-p", pid], 1))).filter(Boolean))];
}

/**
 * Whether the process group this run recorded still exists and is the one it started. While its
 * leader lives, the leader's start time must match (a reused pid has another). Once the leader is
 * gone, the group counts only in the same boot and only if a member is this run's Vite (its
 * command names the run's port), since a group id is free again once its group has exited.
 */
function owned(state: ServerState): boolean {
  if (state.repoRoot !== repoRoot || state.boot !== bootId()) return false;
  const leaderStart = startTime(state.pid);
  if (leaderStart) return leaderStart === state.started;
  return groupMembers(state.pid).some(({ command }) => command.includes("vite") && command.includes(`--port ${state.port}`));
}

/** Whether the recorded group still serves the port or still runs a Vite on it, owned or not. */
function heldByRecordedGroup(state: ServerState): boolean {
  return (
    listenerGroups(state.port).includes(state.pid) ||
    groupMembers(state.pid).some(({ command }) => command.includes("vite") && command.includes(`--port ${state.port}`))
  );
}

/** Stop this run's group, waiting for it to go; true once nothing this run can prove its own is left. */
async function stopGroup(state: ServerState): Promise<boolean> {
  for (const [signal, waitMs] of [["SIGTERM", 10_000], ["SIGKILL", 5_000]] as const) {
    if (!owned(state)) return true;
    try {
      process.kill(-state.pid, signal);
    } catch {}
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline && owned(state)) await Bun.sleep(250);
  }
  return !owned(state);
}

function headCommit(): string {
  return output(["git", "-C", repoRoot, "rev-parse", "--short", "HEAD"]);
}

/** The scheme the dev server chose (mkcert HTTPS locally, HTTP in CI), once it answers with the app. */
async function probe(port: number): Promise<string | null> {
  for (const scheme of ["https", "http"]) {
    const url = `${scheme}://localhost:${port}`;
    try {
      const response = await fetch(url, { tls: { rejectUnauthorized: false }, signal: AbortSignal.timeout(5_000) } as RequestInit);
      if (response.ok && (await response.text()).includes("Green Goods")) return url;
    } catch {}
  }
  return null;
}

/**
 * Every PostHog and Sentry key, set empty: those env.schema names, those either Vite config reads
 * (including its NEXT_PUBLIC_ and PUBLIC_ fallbacks), and any already in the environment. Vite
 * copies a root .env value only where a key is undefined, and the configs treat an empty value as
 * unset and try the next name, so every name in a fallback chain has to be blank.
 */
function telemetryBlanks(): Record<string, string> {
  const telemetry = /^[A-Z0-9_]*(?:POSTHOG|SENTRY)[A-Z0-9_]*$/;
  const schema = readFileSync(path.join(repoRoot, "env.schema"), "utf8");
  const configs = Object.values(APPS)
    .map(({ cwd }) => readFileSync(path.join(repoRoot, cwd, "vite.config.ts"), "utf8"))
    .join("\n");
  const keys = new Set([
    ...[...schema.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]),
    ...[...configs.matchAll(/["'`]([A-Z0-9_]+)["'`]/g)].map((match) => match[1]),
    ...Object.keys(process.env),
  ]);
  return Object.fromEntries([...keys].filter((key) => telemetry.test(key)).map((key) => [key, ""]));
}

async function launch(argv: string[]) {
  const app = argv[1] as App;
  if (!(app in APPS)) fail("launch needs client or admin");
  const { run, dir } = runDir(argv);
  const existing = readState(dir, app);
  if (existing && owned(existing)) fail(`${app} is already running for run ${run}${existing.url ? ` at ${existing.url}` : ""}; run cleanup first`);
  if (existing && heldByRecordedGroup(existing)) {
    fail(`${app}'s recorded group ${existing.pid} still serves port ${existing.port} but cannot be proven this run's; stop it by hand`);
  }
  if (existing) rmSync(statePath(dir, app));
  const { cwd, port } = APPS[app];
  // Read before spawning, so nothing between spawn and the state file can throw.
  const boot = bootId();
  const commit = headCommit();
  if (listenerGroups(port).length || (await probe(port))) fail(`port ${port} is in use by a process this run did not start; stop it first`);
  const log = path.join(dir, `${app}.server.log`);
  const out = openSync(log, "a");
  // The same environment playwright.config.ts gives its test-mode servers: Sepolia, no telemetry,
  // the dev mock-auth seam available, and no live backend required. Loopback only.
  const child = spawn(
    "bun",
    ["../../scripts/dev/node-cli.js", "vite", "--mode", "test", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: path.join(repoRoot, cwd),
      detached: true,
      stdio: ["ignore", out, out],
      env: {
        ...process.env,
        ...telemetryBlanks(),
        APP_ENV: "test",
        NODE_ENV: "test",
        VITE_CHAIN_ID: "11155111",
        VITE_ENVIO_INDEXER_URL: "http://localhost:3006/v1/graphql",
        VITE_POSTHOG_KEY: "",
        VITE_SENTRY_CLIENT_DSN: "",
        SENTRY_AUTH_TOKEN: "",
        GG_ENABLE_SOURCEMAPS: "false",
        VITE_USE_HASH_ROUTER: "false",
        VITE_API_BASE_URL: "http://localhost:3005",
        VITE_PASSKEY_SERVER_ENABLED: "false",
        VITE_ENABLE_SW_DEV: "false",
        REPORTING_AGENT_URL: "",
        // A closed port: the client's /api/messaging proxy must not reach a local reporting driver.
        REPORTING_DRIVER_URL: "http://127.0.0.1:9",
      },
    },
  );
  child.unref();
  if (!child.pid) fail(`${app} dev server did not start; see ${log}`);
  let started = "";
  try {
    started = startTime(child.pid);
  } catch {}
  if (!started) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
    fail(`could not read the start time of the ${app} server it just started; stopped it`);
  }
  // Recorded before waiting, so cleanup can stop a launch that was interrupted.
  const state: ServerState = {
    app,
    status: "starting",
    pid: child.pid,
    started,
    boot,
    port,
    url: null,
    log,
    repoRoot,
    startedAt: new Date().toISOString(),
    commit,
  };
  writeState(dir, state);
  const deadline = Date.now() + 180_000;
  let url: string | null = null;
  while (Date.now() < deadline && !url) {
    if (!owned(state)) fail(`${app} dev server exited during startup; see ${log}`);
    url = await probe(port);
    if (!url) await Bun.sleep(1000);
  }
  if (!url || !listenerGroups(port).includes(state.pid)) {
    if (await stopGroup(state)) rmSync(statePath(dir, app));
    fail(`${app} did not answer on port ${port} within 180 s; see ${log}`);
  }
  writeState(dir, { ...state, status: "ready", url });
  console.log(`verify-control: ${app} ready at ${url} (pid ${state.pid}, run ${run}, commit ${state.commit})`);
}

/** Why this run's server cannot be driven, or null when it can. */
async function unhealthy(state: ServerState): Promise<string | null> {
  if (!owned(state)) return "the process group this run started is gone";
  if (state.status !== "ready") return "the launch never finished; run cleanup, then launch again";
  if (!listenerGroups(state.port).includes(state.pid)) return `port ${state.port} is not served by this run's process group`;
  if ((await probe(state.port)) !== state.url) return `${state.url} does not answer with the app`;
  if (state.commit !== headCommit()) return `launched at ${state.commit}, but HEAD is now ${headCommit()}; relaunch`;
  return null;
}

async function doctor(argv: string[]) {
  const { run, dir } = runDir(argv);
  let healthy = true;
  let found = 0;
  for (const app of Object.keys(APPS) as App[]) {
    const state = readState(dir, app);
    if (!state) continue;
    found += 1;
    let problem: string | null;
    try {
      problem = await unhealthy(state);
    } catch (error) {
      problem = `could not check: ${(error as Error).message}`;
    }
    healthy &&= !problem;
    console.log(
      `${problem ? "FAIL" : "ok  "} ${app}: pid ${state.pid}, ${state.url ?? "no url"}, started ${state.startedAt} at ${state.commit}` +
        (problem ? `: ${problem}` : ""),
    );
  }
  if (!found) fail(`no server launched for run ${run}; run launch first`);
  if (!healthy) process.exit(1);
}

async function drive(argv: string[]) {
  const app = argv[1] as App;
  if (!(app in APPS)) fail("drive needs client or admin");
  const { dir } = runDir(argv);
  const state = readState(dir, app);
  if (!state) fail(`${app} is not running for this run; launch it first`);
  const problem = await unhealthy(state);
  if (problem || !state.url) fail(`${app} cannot be driven: ${problem}`);
  const url = state.url;
  const feature = option(argv, "--feature");
  if (!feature || !NAME.test(feature)) fail("drive needs --feature <id> naming the feature map entry");
  const role = (option(argv, "--role") ?? (app === "admin" ? "steward" : "user")) as Role;
  if (!ROLES.includes(role)) fail(`--role must be one of ${ROLES.join(", ")}`);
  const width = Number(option(argv, "--width") ?? 1280);
  if (!Number.isInteger(width) || width < 320 || width > 2560) fail("--width must be a whole number of pixels from 320 to 2560");
  const steps = options(argv, "--step");
  if (!steps.length) fail("drive needs at least one --step");
  const evidence = path.join(dir, feature);
  mkdirSync(evidence, { recursive: true });
  const failureShot = path.join(evidence, `failure-${width}.png`);
  // A retry must not leave an earlier attempt's captures beside this attempt's transcript.
  const captures = steps.flatMap((step) => (/^(snapshot|screenshot):/.test(step) ? [step.slice(step.indexOf(":") + 1)] : []));
  let captureFiles: string[] = [];
  try {
    captureFiles = captures.map((name) => evidenceFile(evidence, name));
  } catch (error) {
    fail((error as Error).message);
  }
  for (const file of captureFiles) rmSync(file, { force: true });
  for (const file of [failureShot, path.join(evidence, `transcript-${width}.txt`)]) rmSync(file, { force: true });

  const transcript: string[] = [`feature ${feature}, app ${app}, role ${role}, width ${width}, server ${url} at ${state.commit}`];
  const consoleErrors: string[] = [];
  let failed = false;
  // A fixture route that meets a request it does not mock throws outside any awaited call, so the
  // page's request hangs; record it as a failure instead of letting it pass unseen.
  const onUnhandled = (error: unknown) => {
    failed = true;
    transcript.push(`FAIL unhandled: ${String((error as Error)?.message ?? error).split("\n")[0]}`);
  };
  process.on("unhandledRejection", onUnhandled);

  // The helpers read their base URLs when loaded, so point them at this run's server first.
  process.env[app === "client" ? "TEST_CLIENT_URL" : "TEST_ADMIN_URL"] = url;
  const { chromium } = await import("@playwright/test");
  const { setupAuthenticatedClient, seedAcceptedUploadTerms, AdminTestHelper } = await import("../../tests/helpers/test-utils");
  const { mockSepoliaRpc } = await import("../../tests/helpers/mock-backend");

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL: url,
      ignoreHTTPSErrors: true,
      viewport: { width, height: width <= 480 ? 812 : 900 },
    });
    // Never reach a developer's local Agent (3005) or indexer (3006, or the Hub's /api proxies to
    // them). Page routes from the fixtures take precedence; anything they leave falls through here.
    await context.route(/^https?:\/\/(localhost|127\.0\.0\.1):300[56]\//, (route) => route.abort("blockedbyclient"));
    await context.route(/\/api\/(graphql|messaging)(\/|\?|$)/, (route) => route.abort("blockedbyclient"));
    // The client fixtures answer EAS; the Hub has none, so it never reaches the live service.
    await context.route("https://sepolia.easscan.org/**", (route) => route.abort("blockedbyclient"));
    const page = await context.newPage();
    page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
    let helper: { waitForPageLoad(): Promise<void>; backend?: { assertSatisfied(): void } };
    if (app === "client") {
      helper = await setupAuthenticatedClient(page, role);
    } else {
      // The Hub smoke spec's own route mocks are local to it; the shared RPC mock covers chain
      // reads, and indexer reads are blocked above, so the page shows them failing.
      await mockSepoliaRpc(page);
      // A returning member, as the Hub smoke spec seeds it, so the first-upload terms stay closed.
      if (role !== "disconnected") await seedAcceptedUploadTerms(context, url, [role]);
      const admin = new AdminTestHelper(page, context);
      await admin.enableMockAuth(role);
      helper = admin;
    }

    for (const step of steps) {
      if (failed) break;
      const [kind, ...rest] = step.split(":");
      const started = Date.now();
      try {
        if (kind === "goto") {
          await page.goto(rest.join(":"), { waitUntil: "domcontentloaded" });
          await helper.waitForPageLoad();
        } else if (kind === "click") {
          await page.getByRole(rest[0] as never, { name: rest.slice(1).join(":"), exact: true }).first().click();
        } else if (kind === "fill") {
          await page.getByRole(rest[0] as never, { name: rest[1], exact: true }).first().fill(rest.slice(2).join(":"));
        } else if (kind === "expect") {
          await page.getByRole(rest[0] as never, { name: rest.slice(1).join(":"), exact: true }).first().waitFor({ state: "visible", timeout: WAIT_MS });
        } else if (kind === "expect-hidden") {
          await page.getByRole(rest[0] as never, { name: rest.slice(1).join(":"), exact: true }).first().waitFor({ state: "hidden", timeout: WAIT_MS });
        } else if (kind === "expect-url") {
          const fragment = rest.join(":");
          await page.waitForURL((current) => current.href.includes(fragment), { timeout: WAIT_MS });
        } else if (kind === "snapshot") {
          writeFileSync(evidenceFile(evidence, rest.join(":")), await page.locator("body").ariaSnapshot());
        } else if (kind === "screenshot") {
          await page.screenshot({ path: evidenceFile(evidence, rest.join(":")), fullPage: true });
        } else {
          throw new Error(`unknown step kind ${kind}`);
        }
        transcript.push(`ok   ${step} (${Date.now() - started} ms) url=${page.url()}`);
      } catch (error) {
        failed = true;
        transcript.push(`FAIL ${step}: ${(error as Error).message.split("\n")[0]} url=${page.url()}`);
        await page.screenshot({ path: failureShot, fullPage: true }).catch(() => {});
      }
    }
    if (!failed && helper.backend) {
      try {
        helper.backend.assertSatisfied();
      } catch (error) {
        failed = true;
        transcript.push(`FAIL fixture: ${(error as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    // Requests still in flight at close would reject their route handlers; drop the routes first.
    for (const context of browser.contexts()) {
      for (const page of context.pages()) await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
      await context.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
    }
    process.off("unhandledRejection", onUnhandled);
    await browser.close();
    if (consoleErrors.length) transcript.push(`console errors (${consoleErrors.length}):`, ...consoleErrors.map((text) => `  ${text.slice(0, 300)}`));
    writeFileSync(path.join(evidence, `transcript-${width}.txt`), `${transcript.join("\n")}\n`);
    console.log(transcript.join("\n"));
    console.log(`verify-control: evidence in ${path.relative(repoRoot, evidence)}`);
  }
  if (failed) process.exit(1);
}

async function cleanup(argv: string[]) {
  const { run, dir } = runDir(argv);
  let stuck = false;
  for (const app of Object.keys(APPS) as App[]) {
    const state = readState(dir, app);
    if (!state) continue;
    // Only the process group this run started, proven by its recorded start time or surviving
    // group; never anything found by name or port. Any doubt keeps the state file.
    try {
      const running = owned(state);
      if (!running && heldByRecordedGroup(state)) {
        stuck = true;
        console.error(`verify-control: ${app} group ${state.pid} still serves port ${state.port} but cannot be proven this run's; stop it by hand, then remove ${path.relative(repoRoot, statePath(dir, app))}`);
      } else if (await stopGroup(state)) {
        rmSync(statePath(dir, app));
        console.log(`verify-control: ${running ? "stopped" : "found no running"} ${app} (group ${state.pid}) for run ${run}`);
      } else {
        stuck = true;
        console.error(`verify-control: ${app} group ${state.pid} is still running; its state file is kept`);
      }
    } catch (error) {
      stuck = true;
      console.error(`verify-control: could not check ${app} (${(error as Error).message}); its state file is kept`);
    }
  }
  console.log(`verify-control: evidence kept in ${path.relative(repoRoot, dir)}`);
  if (stuck) process.exit(1);
}

const argv = process.argv.slice(2);
const commands: Record<string, (argv: string[]) => unknown> = { launch, doctor, drive, cleanup };
const command = commands[argv[0] ?? ""];
if (!command) fail("usage: verify-control.ts launch|doctor|drive|cleanup (see the header of this file)", 2);
await command(argv);
