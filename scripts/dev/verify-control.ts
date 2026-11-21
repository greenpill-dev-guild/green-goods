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
//   expect-url:<regex>              fail unless the URL matches
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
type Role = "user" | "steward" | "deployer" | "disconnected";

interface ServerState {
  app: App;
  pid: number;
  url: string;
  log: string;
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
  if (!/^[\w.-]+$/.test(run)) fail(`run id must be letters, digits, dot, dash or underscore: ${run}`);
  const dir = path.join(verifyRoot, run);
  mkdirSync(dir, { recursive: true });
  return { run, dir };
}

const statePath = (dir: string, app: App) => path.join(dir, `${app}.server.json`);

function readState(dir: string, app: App): ServerState | null {
  const file = statePath(dir, app);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ServerState) : null;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function headCommit(): string {
  const result = Bun.spawnSync(["git", "-C", repoRoot, "rev-parse", "--short", "HEAD"]);
  return result.stdout.toString().trim();
}

/** The scheme the dev server chose (mkcert HTTPS locally, HTTP in CI), once it answers with the app. */
async function probe(port: number): Promise<string | null> {
  for (const scheme of ["https", "http"]) {
    const url = `${scheme}://localhost:${port}`;
    try {
      const response = await fetch(url, { tls: { rejectUnauthorized: false } } as RequestInit);
      if (response.ok && (await response.text()).includes("Green Goods")) return url;
    } catch {}
  }
  return null;
}

async function launch(argv: string[]) {
  const app = argv[1] as App;
  if (!(app in APPS)) fail("launch needs client or admin");
  const { run, dir } = runDir(argv);
  const existing = readState(dir, app);
  if (existing && alive(existing.pid)) fail(`${app} is already running for run ${run} at ${existing.url}`);
  const { cwd, port } = APPS[app];
  if (await probe(port)) fail(`port ${port} already serves an app this run did not start; stop it first`);
  const log = path.join(dir, `${app}.server.log`);
  const out = openSync(log, "a");
  // The same environment playwright.config.ts gives its test-mode servers: Sepolia, no telemetry,
  // the dev mock-auth seam available, and no live backend required.
  const child = spawn("bun", ["../../scripts/dev/node-cli.js", "vite", "--mode", "test", "--port", String(port), "--strictPort"], {
    cwd: path.join(repoRoot, cwd),
    detached: true,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
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
      REPORTING_AGENT_URL: "",
    },
  });
  child.unref();
  const deadline = Date.now() + 180_000;
  let url: string | null = null;
  while (Date.now() < deadline && !url) {
    if (child.pid && !alive(child.pid)) fail(`${app} dev server exited during startup; see ${log}`);
    url = await probe(port);
    if (!url) await Bun.sleep(1000);
  }
  if (!url || !child.pid) {
    if (child.pid) process.kill(-child.pid, "SIGTERM");
    fail(`${app} did not answer on port ${port} within 180 s; see ${log}`);
  }
  const state: ServerState = { app, pid: child.pid, url, log, startedAt: new Date().toISOString(), commit: headCommit() };
  writeFileSync(statePath(dir, app), `${JSON.stringify(state, null, 2)}\n`);
  console.log(`verify-control: ${app} ready at ${url} (pid ${child.pid}, run ${run}, commit ${state.commit})`);
}

async function doctor(argv: string[]) {
  const { run, dir } = runDir(argv);
  let healthy = true;
  let found = 0;
  for (const app of Object.keys(APPS) as App[]) {
    const state = readState(dir, app);
    if (!state) continue;
    found += 1;
    const up = alive(state.pid);
    const answering = up ? await probe(APPS[app].port) : null;
    const ok = up && answering === state.url;
    healthy &&= ok;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${app}: pid ${state.pid} ${up ? "alive" : "gone"}, ${answering ? `serving ${answering}` : "not answering"}, ` +
        `started ${state.startedAt} at ${state.commit} (HEAD ${headCommit()})`,
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
  if (!state || !alive(state.pid)) fail(`${app} is not running for this run; launch it first`);
  const feature = option(argv, "--feature");
  if (!feature || !/^[\w.-]+$/.test(feature)) fail("drive needs --feature <id> naming the feature map entry");
  const role = (option(argv, "--role") ?? (app === "admin" ? "steward" : "user")) as Role;
  const width = Number(option(argv, "--width") ?? 1280);
  const steps = options(argv, "--step");
  if (!steps.length) fail("drive needs at least one --step");
  const evidence = path.join(dir, feature);
  mkdirSync(evidence, { recursive: true });

  // The helpers read their base URLs when loaded, so point them at this run's server first.
  process.env[app === "client" ? "TEST_CLIENT_URL" : "TEST_ADMIN_URL"] = state.url;
  const { chromium } = await import("@playwright/test");
  const { setupAuthenticatedClient, seedAcceptedUploadTerms, AdminTestHelper, ClientTestHelper } = await import(
    "../../tests/helpers/test-utils"
  );
  const { mockSepoliaRpc } = await import("../../tests/helpers/mock-backend");

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: state.url,
    ignoreHTTPSErrors: true,
    viewport: { width, height: width <= 480 ? 812 : 900 },
  });
  const page = await context.newPage();
  const transcript: string[] = [`feature ${feature}, app ${app}, role ${role}, width ${width}, server ${state.url} at ${state.commit}`];
  const consoleErrors: string[] = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  let helper: { waitForPageLoad(): Promise<void> };
  if (app === "client") {
    helper = await setupAuthenticatedClient(page, role);
  } else {
    // The Hub smoke spec's own route mocks are local to it; the shared RPC mock covers chain reads,
    // and indexer reads not mocked here fail loudly in the page, which the transcript records.
    await mockSepoliaRpc(page);
    // A returning member, as the Hub smoke spec seeds it, so the first-upload terms stay closed.
    if (role !== "disconnected") await seedAcceptedUploadTerms(context, state.url, [role]);
    const admin = new AdminTestHelper(page, context);
    await admin.enableMockAuth(role);
    helper = new ClientTestHelper(page);
  }

  let failed = false;
  for (const step of steps) {
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
        await page.getByRole(rest[0] as never, { name: rest.slice(1).join(":"), exact: true }).first().waitFor({ state: "visible", timeout: 15_000 });
      } else if (kind === "expect-hidden") {
        await page.getByRole(rest[0] as never, { name: rest.slice(1).join(":"), exact: true }).first().waitFor({ state: "hidden", timeout: 15_000 });
      } else if (kind === "expect-url") {
        const pattern = new RegExp(rest.join(":"));
        await page.waitForURL(pattern, { timeout: 15_000 });
      } else if (kind === "snapshot") {
        writeFileSync(path.join(evidence, rest.join(":")), await page.locator("body").ariaSnapshot());
      } else if (kind === "screenshot") {
        await page.screenshot({ path: path.join(evidence, rest.join(":")), fullPage: true });
      } else {
        throw new Error(`unknown step kind ${kind}`);
      }
      transcript.push(`ok   ${step} (${Date.now() - started} ms) url=${page.url()}`);
    } catch (error) {
      failed = true;
      transcript.push(`FAIL ${step}: ${(error as Error).message.split("\n")[0]} url=${page.url()}`);
      await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }).catch(() => {});
      break;
    }
  }
  if (consoleErrors.length) transcript.push(`console errors (${consoleErrors.length}):`, ...consoleErrors.map((text) => `  ${text.slice(0, 300)}`));
  writeFileSync(path.join(evidence, `transcript-${width}.txt`), `${transcript.join("\n")}\n`);
  await browser.close();
  console.log(transcript.join("\n"));
  console.log(`verify-control: evidence in ${path.relative(repoRoot, evidence)}`);
  if (failed) process.exit(1);
}

function cleanup(argv: string[]) {
  const { run, dir } = runDir(argv);
  for (const app of Object.keys(APPS) as App[]) {
    const state = readState(dir, app);
    if (!state) continue;
    // Only the process group this run started; never anything found by name or port.
    if (alive(state.pid)) {
      try {
        process.kill(-state.pid, "SIGTERM");
      } catch {
        process.kill(state.pid, "SIGTERM");
      }
    }
    rmSync(statePath(dir, app));
    console.log(`verify-control: stopped ${app} (pid ${state.pid}) for run ${run}`);
  }
  console.log(`verify-control: evidence kept in ${path.relative(repoRoot, dir)}`);
}

const argv = process.argv.slice(2);
const commands: Record<string, (argv: string[]) => unknown> = { launch, doctor, drive, cleanup };
const command = commands[argv[0] ?? ""];
if (!command) fail("usage: verify-control.ts launch|doctor|drive|cleanup (see the header of this file)", 2);
await command(argv);
