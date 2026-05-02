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
import { accessSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";

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
export function findSystemNode() {
  const executable = process.platform === "win32" ? "node.exe" : "node";
  const pathEntries = (process.env.PATH || "").split(path.delimiter);
  for (const entry of pathEntries) {
    if (!entry || entry.includes("bun-node") || entry.includes(`${path.sep}.bun${path.sep}bin`)) {
      continue;
    }
    const candidate = path.join(entry, executable);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep scanning PATH.
    }
  }
  return "";
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
    env: { ...process.env, [sentinel]: "1" },
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

/**
 * GET a URL, resolving with `{ ok, statusCode? | error? }`. Self-signed certs
 * are accepted (vite-plugin-mkcert generates one per dev session).
 *
 * The URL is parsed into hostname/port/path before being passed to `client.get`
 * because Bun's `https.get(urlString, options)` form doesn't honor
 * `rejectUnauthorized: false` reliably — using the explicit options object
 * guarantees the TLS option is applied.
 */
export function requestUrl(url, timeoutMs = 2500) {
  const parsed = new URL(url);
  const client = parsed.protocol === "https:" ? https : http;

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

    request = client.get(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname || "/",
        rejectUnauthorized: false,
      },
      (response) => {
        response.resume();
        finish({ ok: true, url, statusCode: response.statusCode });
      },
    );
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
