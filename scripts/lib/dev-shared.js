/**
 * Shared helpers for dev-environment scripts (setup.js, doctor.js, smoke-web.js,
 * test-e2e.js).
 *
 * Keep this module dependency-free and side-effect-free so it works under
 * both `node` (the canonical entry runtime) and any future bun caller.
 */

import http from "node:http";
import https from "node:https";
import path from "node:path";
import { homedir } from "node:os";
import { accessSync, constants, existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Use the same Docker environment in the launcher and doctor. Only replace a
// missing local socket; custom contexts and remote/live endpoints are intentional.
export function dockerEnvironment({ env = process.env, home = homedir(), exists = existsSync } = {}) {
  const result = { ...env };
  const dockerDirs = [
    path.join(home, ".orbstack/bin"),
    "/Applications/OrbStack.app/Contents/MacOS/xbin",
    "/Applications/Docker.app/Contents/Resources/bin",
    "/usr/local/bin",
  ].filter((dir) => exists(path.join(dir, "docker")));
  result.PATH = [...new Set([...(env.PATH || "").split(path.delimiter), ...dockerDirs])].filter(Boolean).join(path.delimiter);
  const socket = path.join(home, ".orbstack/run/docker.sock");
  const staleDesktopContext = env.DOCKER_CONTEXT === "desktop-linux" &&
    env.DOCKER_HOST === `unix://${path.join(home, ".docker/run/docker.sock")}`;
  if (
    (!env.DOCKER_CONTEXT || staleDesktopContext) && env.DOCKER_HOST?.startsWith("unix://") &&
    !exists(env.DOCKER_HOST.slice(7)) && exists(socket)
  ) {
    result.DOCKER_HOST = `unix://${socket}`;
    if (staleDesktopContext) result.DOCKER_CONTEXT = "orbstack";
  }
  return result;
}

export function assertDockerReady(env = dockerEnvironment()) {
  const result = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    env, encoding: "utf8", timeout: 10_000,
  });
  if (result.status !== 0) {
    throw new Error(
      "Docker is unavailable. Open OrbStack or Docker Desktop, check your Docker context/DOCKER_HOST, then rerun bun run dev. No services were started."
    );
  }
  const compose = spawnSync("docker", ["compose", "version", "--short"], {
    env, encoding: "utf8", timeout: 10_000,
  });
  if (compose.status !== 0) throw new Error("Docker Compose is unavailable. Enable Compose before running bun run dev.");
}

/**
 * Find a system Node executable by skipping bun's node shim. Bun installs
 * `~/.bun/bin/node` (a Bun front-end pretending to be Node), so a script
 * launched via `node foo.js` may actually run under Bun. That matters for
 * scripts that depend on Node-specific TLS behavior (`rejectUnauthorized: false`
 * does not work for self-signed mkcert certs under Bun's https client).
 *
 * Returns the absolute path to the first non-bun node on PATH, or an empty
 * string if none is found.
 */
function executableExists(candidate) {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function probeNodeVersion(candidate) {
  const result = spawnSync(
    candidate,
    ["-p", "process.versions.bun ? `bun:${process.versions.bun}` : process.versions.node"],
    {
      encoding: "utf8",
      timeout: 2_000,
    }
  );
  return (result.stdout || "").trim();
}

function isSupportedSystemNode(version) {
  const major = majorVersion(version);
  return major !== null && major >= 22;
}

function miseDataDirectory(env = process.env) {
  return env.MISE_DATA_DIR || path.join(homedir(), ".local/share/mise");
}

function nodeExecutableName() {
  return process.platform === "win32" ? "node.exe" : "node";
}

/** True for the `node` Bun injects into the environment of a `bun run` child. */
function isBunNodeShimDirectory(entry) {
  return entry.includes("bun-node") || entry.includes(`${path.sep}.bun${path.sep}bin`);
}

function nodeCandidates() {
  const executable = nodeExecutableName();
  const miseData = miseDataDirectory();
  const candidates = [path.join(miseData, "shims", executable)];
  if (process.env.NODE) candidates.push(process.env.NODE);

  const pathEntries = (process.env.PATH || "").split(path.delimiter);
  for (const entry of pathEntries) {
    if (!entry || isBunNodeShimDirectory(entry)) {
      continue;
    }
    candidates.push(path.join(entry, executable));
  }

  const miseNodeRoot = path.join(miseData, "installs/node");
  try {
    for (const version of readdirSync(miseNodeRoot).sort().reverse()) {
      candidates.push(path.join(miseNodeRoot, version, "bin", executable));
    }
  } catch {
    // mise is optional; PATH candidates above are enough on most machines.
  }

  return candidates;
}

export function findCompatibleNode({
  isSupported = isSupportedSystemNode,
  candidates = nodeCandidates(),
  probe = probeNodeVersion,
  exists = executableExists,
} = {}) {
  const seen = new Set();

  for (const candidate of candidates) {
    if (!exists(candidate)) continue;

    let key = candidate;
    try {
      key = realpathSync(candidate);
    } catch {
      // Fall back to the literal candidate path.
    }
    if (seen.has(key)) continue;
    seen.add(key);

    let version = "";
    try {
      version = probe(candidate);
    } catch {
      continue;
    }
    if (!version || version.startsWith("bun:")) continue;
    if (isSupported(version)) return candidate;
  }

  return "";
}

export function findSystemNode() {
  const candidates = nodeCandidates();
  return (
    findCompatibleNode({ isSupported: isSupportedSystemNode, candidates }) ||
    findCompatibleNode({ isSupported: () => true, candidates })
  );
}

function findMiseConfig(startDirectory) {
  let directory = path.resolve(startDirectory || process.cwd());
  while (true) {
    try {
      return readFileSync(path.join(directory, ".mise.toml"), "utf8");
    } catch {
      const parent = path.dirname(directory);
      if (parent === directory) return "";
      directory = parent;
    }
  }
}

function pinnedMiseTools(cwd) {
  const tools = {};
  let inTools = false;
  for (const line of findMiseConfig(cwd).split("\n")) {
    const section = line.match(/^\s*\[([^\]]+)]/);
    if (section) {
      inTools = section[1] === "tools";
      continue;
    }
    if (!inTools) continue;
    const tool = line.match(/^\s*(node|bun|foundry)\s*=\s*["']([^"']+)["']/);
    if (tool) tools[tool[1]] = tool[2];
  }
  return tools;
}

const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * The exact Node version `.mise.toml` pins. CI installs this version, and the
 * validation policy blocks every check whose toolchain differs from it, so
 * setup and the doctor report against the pin instead of a floor of their own.
 */
export function readPinnedNodeVersion(cwd = process.cwd()) {
  const pinned = (pinnedMiseTools(cwd).node ?? "").replace(/^v/, "");
  if (!EXACT_VERSION_PATTERN.test(pinned)) {
    throw new Error(".mise.toml must pin Node to an exact x.y.z version");
  }
  return pinned;
}

/**
 * The first `node` on PATH, skipping the shim Bun injects into a `bun run`
 * child. `process.versions.node` cannot answer this: under `bun run` the
 * interpreter is Bun, and the Node version it reports is an emulation rather
 * than the Node that `node scripts/dev/<script>.js` will run.
 */
function firstNodeOnPath({ env, probe, exists }) {
  const executable = nodeExecutableName();
  for (const entry of (env.PATH || "").split(path.delimiter)) {
    if (!entry || isBunNodeShimDirectory(entry)) continue;
    const candidate = path.join(entry, executable);
    if (!exists(candidate)) continue;
    const version = probe(candidate);
    if (!version || version.startsWith("bun:")) continue;
    return { path: candidate, version };
  }
  return { path: "", version: "" };
}

/**
 * Where mise keeps the Node this repository pins, most specific first. The
 * repair worth suggesting is the pinned toolchain, so this deliberately does
 * not go looking for some other Node of the same major on PATH.
 */
function pinnedNodeCandidates(pinned, env) {
  const executable = nodeExecutableName();
  const miseData = miseDataDirectory(env);
  return [
    path.join(miseData, "installs/node", pinned, "bin", executable),
    path.join(miseData, "shims", executable),
  ];
}

/**
 * Compare the Node that runs this repository's scripts against the
 * `.mise.toml` pin, as `"matched"`, `"mismatched"`, or `"unknown"`.
 *
 * The major is the gate. `package.json` engines accepts the whole `>=22.19.0 <23`
 * range, so a different patch is worth printing but only a different major is a
 * toolchain this repository does not run on. `fix` prefers a PATH change when
 * mise already holds the pinned version, because that is the entire repair on a
 * machine whose mise shims sit behind another Node.
 */
export function inspectPinnedNode({
  pinned,
  env = process.env,
  bunRuntime = process.versions.bun ?? "",
  interpreterNode = process.versions.node ?? "",
  probe = probeNodeVersion,
  exists = executableExists,
} = {}) {
  const pinnedMajor = majorVersion(pinned);
  // Outside Bun the interpreter running this script is the `node` the machine
  // resolved for it, so read it directly: no probe is cheaper or more accurate.
  // Under `bun run` the interpreter is Bun and its Node version is an
  // emulation, so walk PATH for the Node that `node scripts/...` will run.
  const detected = bunRuntime
    ? firstNodeOnPath({ env, probe, exists })
    : { path: "", version: interpreterNode };
  const major = majorVersion(detected.version);
  const state = major === null ? "unknown" : major === pinnedMajor ? "matched" : "mismatched";

  const installed = state === "matched"
    ? detected.path
    : findCompatibleNode({
        isSupported: (version) => majorVersion(version) === pinnedMajor,
        candidates: pinnedNodeCandidates(pinned, env),
        probe,
        exists,
      });

  const where = detected.path ? ` at ${detected.path}` : "";
  return {
    state,
    pinned,
    version: detected.version,
    path: detected.path,
    detail: state === "matched"
      ? `v${detected.version}${where}; .mise.toml pins ${pinned}.`
      : state === "mismatched"
        ? `v${detected.version}${where}; .mise.toml pins ${pinned} and CI runs that major only.`
        : `No Node answered a version probe; .mise.toml pins ${pinned}.`,
    fix: state === "matched"
      ? ""
      : installed
        ? `Put the pinned Node first on PATH: export PATH="${path.dirname(installed)}:$PATH"`
        : `Install Node ${pinnedMajor}: run mise install from the repository root, or install ${pinned} from nodejs.org.`,
    // `bun run` scripts execute under Bun's node shim, so name the interpreter
    // whose reported version this check deliberately ignored.
    runtimeNote: bunRuntime
      ? `Bun ${bunRuntime} ran this check and emulates Node ${interpreterNode}; the pinned-Node check reads PATH instead.`
      : "",
  };
}

function matchingToolchainPathEntries(node, cwd) {
  const entries = [];
  const tools = pinnedMiseTools(cwd);
  const miseData = miseDataDirectory();
  if (tools.bun) {
    const bun = path.join(miseData, "installs/bun", tools.bun, "bin", "bun");
    if (executableExists(bun)) entries.push(path.dirname(bun));
  }
  if (tools.foundry) {
    for (const forge of [
      path.join(miseData, "installs/foundry", tools.foundry, "forge"),
      path.join(miseData, "installs/foundry", tools.foundry, "bin", "forge"),
    ]) {
      if (!executableExists(forge)) continue;
      entries.push(path.dirname(forge));
      break;
    }
  }
  entries.push(path.dirname(node));
  return entries;
}

function reexecEnvironment(node, cwd, sentinel) {
  const pathEntries = [
    ...matchingToolchainPathEntries(node, cwd),
    ...(process.env.PATH || "").split(path.delimiter),
  ].filter(Boolean);
  return {
    ...process.env,
    [sentinel]: "1",
    NODE: node,
    npm_node_execpath: node,
    PATH: [...new Set(pathEntries)].join(path.delimiter),
  };
}

export function reexecUnderCompatibleNodeIfNeeded({
  scriptPath,
  sentinel,
  cwd,
  isSupported = isSupportedSystemNode,
  spawn = spawnSync,
  exit = (code) => process.exit(code),
  candidates,
  probe,
  exists,
}) {
  if (process.env[sentinel] === "1") return false;
  if (!process.versions.bun && isSupported(process.versions.node || "")) return false;

  const compatibleNode = findCompatibleNode({ isSupported, candidates, probe, exists });
  if (!compatibleNode) return false;
  const result = spawn(compatibleNode, [scriptPath, ...process.argv.slice(2)], {
    cwd,
    env: reexecEnvironment(compatibleNode, cwd, sentinel),
    stdio: "inherit",
  });
  if (result.error) return false;
  exit(result.status ?? (result.signal ? 1 : 0));
  return true;
}

/**
 * Re-exec the current script under system Node when the runtime is Bun.
 * The first invocation finds system Node, re-spawns the script with stdio
 * inherited, and exits with the child's status. The re-exec sets a sentinel
 * env var so subsequent invocations no-op.
 *
 * Pass `{ scriptPath, sentinel, cwd }`:
 *   - scriptPath: absolute path of the script (use `fileURLToPath(import.meta.url)`)
 *   - sentinel:  env-var name to set on re-exec (e.g. "GREEN_GOODS_E2E_NODE_REEXEC")
 *   - cwd:       working directory for the spawned child (usually the project root)
 */
export function reexecUnderSystemNodeIfNeeded({ scriptPath, sentinel, cwd }) {
  if (!process.versions.bun || process.env[sentinel] === "1") return;
  const systemNode = findSystemNode();
  if (!systemNode) return;
  const result = spawnSync(systemNode, [scriptPath, ...process.argv.slice(2)], {
    cwd,
    env: reexecEnvironment(systemNode, cwd, sentinel),
    stdio: "inherit",
  });
  if (result.error) return;
  process.exit(result.status ?? (result.signal ? 1 : 0));
}

export function commandExists(cmd) {
  const probe = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
  return spawnSync(probe, { shell: true, stdio: "ignore" }).status === 0;
}

export function commandVersion(cmd) {
  // Node-running-under-bun reports the bun runtime version via `node --version`,
  // not the system node — read process.versions.node directly to stay honest.
  if (cmd === "node" && process.versions.node) {
    return `v${process.versions.node}`;
  }

  const result = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) return "";
  return `${result.stdout || result.stderr}`.trim().split("\n")[0] || "";
}

export function majorVersion(version) {
  const match = version.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export const SUBMODULE_RECOVERY_COMMAND = "git submodule update --init --recursive";

const submoduleStateByPrefix = {
  " ": "ready",
  "-": "uninitialized",
  "+": "mismatched",
  U: "conflicted",
};

/**
 * Parse `git submodule status --recursive` without reading or changing the filesystem.
 */
export function parseSubmoduleStatus({ stdout = "", status = 0, error = null } = {}) {
  if (error || status !== 0) {
    return {
      state: "command-error",
      ready: false,
      entries: [],
      detail: error?.message || `git submodule status exited with ${status}`,
    };
  }

  const entries = [];
  for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^(.)([0-9a-f]+)\s+(\S+)/i);
    const state = match ? submoduleStateByPrefix[match[1]] : null;
    if (!match || !state) {
      return {
        state: "command-error",
        ready: false,
        entries,
        detail: `Unrecognized git submodule status line: ${line}`,
      };
    }
    entries.push({ state, commit: match[2], path: match[3] });
  }

  const state = ["conflicted", "mismatched", "uninitialized"].find((candidate) =>
    entries.some((entry) => entry.state === candidate),
  ) ?? "ready";
  return { state, ready: state === "ready", entries, detail: "" };
}

export function inspectPinnedSubmodules({ cwd = process.cwd(), run = spawnSync } = {}) {
  const result = run("git", ["submodule", "status", "--recursive"], {
    cwd,
    encoding: "utf8",
  });
  const parsed = parseSubmoduleStatus(result);
  if (!parsed.ready) return parsed;

  const dirty = run(
    "git",
    [
      "status",
      "--porcelain=v1",
      "--ignore-submodules=none",
      "--",
      "packages/contracts/lib/kernel",
      "packages/contracts/lib/tokenbound",
    ],
    { cwd, encoding: "utf8" },
  );
  if (dirty.error || dirty.status !== 0) {
    return {
      ...parsed,
      state: "command-error",
      ready: false,
      detail: dirty.error?.message || `git status exited with ${dirty.status}`,
    };
  }
  if ((dirty.stdout || "").trim()) {
    return {
      ...parsed,
      state: "modified",
      ready: false,
      detail: String(dirty.stdout).trim(),
    };
  }
  return parsed;
}

export function resolveSubmoduleSetupAction({ state, installMode }) {
  if (state === "ready") return "none";
  if (state === "uninitialized" && installMode !== "skip") return "initialize";
  return "stop";
}

export function profileRequiresContractSubmodules(profile) {
  return profile === "contracts" || profile === "full";
}

/**
 * The variables that bind git to one repository, as listed by `git rev-parse --local-env-vars`.
 *
 * git exports GIT_DIR to every hook it runs in a linked worktree, and a git that inherits it
 * ignores `cwd` and `-C`. A test fixture under the push gate therefore works on the repository
 * being pushed: its `git init` marks that repository bare, its `git config user.name` lands in
 * the config every worktree shares, and its commits land on the pushed branch, all while the
 * test passes.
 */
export const REPOSITORY_LOCAL_GIT_VARIABLES = Object.freeze([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_COUNT",
  "GIT_OBJECT_DIRECTORY",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_REPLACE_REF_BASE",
  "GIT_PREFIX",
  "GIT_SHALLOW_FILE",
  "GIT_COMMON_DIR",
]);

/** Remove them from `environment` in place, so `cwd` decides which repository git works on. */
export function clearRepositoryLocalGitVariables(environment = process.env) {
  for (const variable of REPOSITORY_LOCAL_GIT_VARIABLES) delete environment[variable];
  return environment;
}

/**
 * Environment for git in a throwaway fixture repository. It inherits no GIT_* variable, reads no
 * developer or machine config (signing, hooks, templates), and carries its own identity, so a
 * fixture never has a reason to write one into a config file.
 */
export function fixtureGitEnvironment(environment = process.env) {
  const inherited = Object.entries(environment).filter(([variable]) => !variable.startsWith("GIT_"));
  return {
    ...Object.fromEntries(inherited),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  };
}

const SHARED_GIT_SETTINGS = "^(user\\.(name|email)|core\\.(bare|worktree)|commit\\.gpgsign)$";

/**
 * Read, from the config every worktree shares, the settings a leaking fixture overwrites.
 * Returns null where there is no repository to read.
 */
export function readSharedGitSettings({ cwd = process.cwd(), run = spawnSync } = {}) {
  const result = run("git", ["config", "--local", "--get-regexp", SHARED_GIT_SETTINGS], {
    cwd,
    encoding: "utf8",
    env: clearRepositoryLocalGitVariables({ ...process.env }),
  });
  // git exits 1 when nothing matches, which is the healthy state for the identity settings.
  if (result.error || ![0, 1].includes(result.status)) return null;

  const settings = {};
  for (const line of (result.stdout ?? "").split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf(" ");
    if (separator === -1) settings[line] = "";
    else settings[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return settings;
}

// RFC 2606 and RFC 6761 reserve these domains for documentation and tests. No contributor
// commits from one, so an identity there was written by a fixture.
const RESERVED_MAIL_DOMAIN = /(?:@|\.)(?:example\.(?:com|net|org)|test|example|invalid|localhost)$/i;

/** True for an address no contributor can own, which is what a leaked fixture identity looks like. */
export function isReservedTestEmail(email) {
  return RESERVED_MAIL_DOMAIN.test(email ?? "");
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * A fixture identity already sitting in `readSharedGitSettings` output, left by an earlier leak
 * from any worktree. `problems` and `repairs` are empty for a healthy config, and a
 * contributor's own per-repository identity is healthy.
 */
export function findInheritedFixtureIdentity(settings) {
  const email = settings?.["user.email"] ?? "";
  if (!isReservedTestEmail(email)) return { problems: [], repairs: [] };
  const problems = [`user.email is ${email}, an address reserved for tests`];
  const repairs = ["git config --local --unset-all user.name", "git config --local --unset-all user.email"];
  // The fixtures that write an identity also turn signing off and can mark the repository bare.
  // Beside their identity those are their writes too, so restore them in the same repair.
  if (settings["commit.gpgsign"]?.toLowerCase() === "false") {
    problems.push("commit.gpgsign is false, which the same fixtures write");
    repairs.push("git config --local --unset-all commit.gpgsign");
  }
  if (settings["core.bare"]?.toLowerCase() === "true") {
    problems.push("core.bare is true, which the same fixtures write");
    repairs.push("git config --local core.bare false");
  }
  return { problems, repairs };
}

/**
 * The shared settings that differ between two `readSharedGitSettings` results taken around a
 * validation run, each with the command that restores it. A leaking fixture passes its own
 * test, so this difference is the only place it shows.
 */
export function findSharedGitSettingChanges(before, after) {
  const problems = [];
  const repairs = [];
  if (!before || !after) return { problems, repairs };

  for (const setting of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[setting] === after[setting]) continue;
    const was = before[setting] === undefined ? "unset" : before[setting];
    const is = after[setting] === undefined ? "unset" : after[setting];
    problems.push(`${setting} changed from ${was} to ${is} while validation ran`);
    repairs.push(
      before[setting] === undefined
        ? `git config --local --unset-all ${setting}`
        : `git config --local ${setting} ${shellQuote(before[setting])}`,
    );
  }
  return { problems, repairs };
}

const VITEST_WORKER_MEMORY_BYTES = 2 * 1024 ** 3;

export function resolveVitestMaxWorkers({ cpus, totalMemoryBytes, ci, share = 1 }) {
  if (ci) return undefined;

  const cpuLimit = Math.max(2, Math.floor(cpus) - 1);
  const memoryLimit = Math.floor(totalMemoryBytes / VITEST_WORKER_MEMORY_BYTES);
  const packageShare = Math.max(1, Math.floor(share));
  const sharedLimit = Math.floor(Math.min(cpuLimit, memoryLimit) / packageShare);

  return Math.min(cpuLimit, Math.max(2, sharedLimit));
}

/**
 * GET a URL, resolving with `{ ok, statusCode? | error? }`. Self-signed certs
 * are accepted (vite-plugin-mkcert generates one per dev session).
 *
 * The URL is parsed into hostname/port/path before being passed to `client.get`
 * because Bun's `https.get(urlString, options)` form doesn't honor
 * `rejectUnauthorized: false` reliably — using the explicit options object
 * guarantees the TLS option is applied.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function requestUrl(url, timeoutMs = 2500) {
  const parsed = new URL(url);
  if (parsed.protocol === "https:" && !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `requestUrl is a dev-only probe and refuses non-loopback HTTPS targets: ${url}`,
    );
  }
  const isHttps = parsed.protocol === "https:";
  const client = isHttps ? https : http;

  return new Promise((resolve) => {
    let settled = false;
    let request;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
      request?.destroy();
    };
    timer = setTimeout(() => {
      finish({ ok: false, url, error: `Timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    const requestOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname || "/"}${parsed.search || ""}`,
    };
    if (isHttps) {
      // Loopback-only by the guard above. Dev servers (vite-plugin-mkcert)
      // ship a per-session self-signed cert, so the smoke probe must accept it.
      requestOptions.rejectUnauthorized = false;
    }

    request = client.get(requestOptions, (response) => {
      response.resume();
      finish({ ok: true, url, statusCode: response.statusCode });
    });
    request.setTimeout(timeoutMs, () => {
      finish({ ok: false, url, error: `Timed out after ${timeoutMs}ms` });
    });
    request.on("error", (error) => {
      finish({ ok: false, url, error: error.code || error.message });
    });
  });
}

/**
 * Poll one or more candidate URLs for a service until any responds, or
 * `deadlineMs` passes. Resolves with `{ ok, url?, statusCode?, attempts? }`.
 *
 * `urls` is intentionally an array so callers can fall through https→http when
 * mkcert isn't yet bootstrapped (smoke-web.js does this).
 */
export async function waitForService({ urls, deadlineMs, perAttemptMs = 2500, gapMs = 1000 }) {
  const attempts = [];
  while (Date.now() < deadlineMs) {
    for (const url of urls) {
      const attempt = await requestUrl(url, perAttemptMs);
      attempts.push(attempt);
      if (attempt.ok) return { ok: true, url: attempt.url, statusCode: attempt.statusCode };
    }
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return { ok: false, attempts: attempts.slice(-urls.length) };
}

/** Markers required by the existing setup workflow; never installs or repairs dependencies. */
export function dependencyReadiness(root = process.cwd()) {
  const requiredPaths = [
    "node_modules/.bun",
    "node_modules/.bin/turbo",
    "node_modules/.bin/oxlint",
    "node_modules/multiformats/basics.js",
  ];
  const missing = requiredPaths.filter((entry) => !existsSync(path.join(root, entry)));
  return { ready: missing.length === 0, missing };
}
