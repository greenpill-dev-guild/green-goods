#!/usr/bin/env node

/**
 * PWA + admin device-testing tunnel(s).
 *
 * Spawns one cloudflared quick-tunnel per port. Each tunnel's URL is written
 * to a deterministic file the matching Vite dev server exposes via
 * `/__dev/tunnel` so the in-page QR overlay can render it.
 *
 * URL files:
 *   port 3001 (client)  → .tunnel-url           (legacy filename, kept for back-compat)
 *   port 3002 (admin)   → .tunnel-url-admin
 *   any other port      → .tunnel-url-<port>
 *
 * Usage:
 *   bun run dev:tunnel                              # default: client (3001) + admin (3002)
 *   bun run dev:tunnel -- --port 3001               # client only
 *   bun run dev:tunnel -- --port 3001 --port 3002   # both, explicit
 *   bun run dev:tunnel -- --ports 3001,3002         # both, shorthand
 *
 * Prerequisites:
 *   brew install cloudflared
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const DEFAULT_PORTS = ["3001", "3002"];

function parsePorts(argv) {
  const ports = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") {
      const value = argv[i + 1];
      if (value) {
        ports.push(value);
        i++;
      }
      continue;
    }
    if (arg === "--ports") {
      const value = argv[i + 1];
      if (value) {
        for (const p of value.split(",")) {
          const trimmed = p.trim();
          if (trimmed) ports.push(trimmed);
        }
        i++;
      }
      continue;
    }
    if (arg.startsWith("--port=")) {
      ports.push(arg.slice("--port=".length));
      continue;
    }
    if (arg.startsWith("--ports=")) {
      for (const p of arg.slice("--ports=".length).split(",")) {
        const trimmed = p.trim();
        if (trimmed) ports.push(trimmed);
      }
      continue;
    }
  }

  if (ports.length === 0) return [...DEFAULT_PORTS];

  // De-duplicate while preserving order.
  return Array.from(new Set(ports));
}

function urlFileFor(port) {
  if (port === "3001") return resolve(ROOT, ".tunnel-url");
  if (port === "3002") return resolve(ROOT, ".tunnel-url-admin");
  return resolve(ROOT, `.tunnel-url-${port}`);
}

function labelFor(port) {
  if (port === "3001") return "client";
  if (port === "3002") return "admin";
  return `port-${port}`;
}

// -- Preflight ---------------------------------------------------------------

try {
  execSync("which cloudflared", { stdio: "ignore" });
} catch {
  console.error(
    "\x1b[31m✗ cloudflared not found.\x1b[0m Install it with:\n\n  brew install cloudflared\n"
  );
  process.exit(1);
}

const ports = parsePorts(process.argv.slice(2));

async function waitForPort(targetPort, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      execSync(`lsof -iTCP:${targetPort} -sTCP:LISTEN`, { stdio: "ignore" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
}

// -- Cleanup -----------------------------------------------------------------

const urlFiles = ports.map((port) => urlFileFor(port));
const tunnels = [];

function cleanup() {
  for (const file of urlFiles) {
    try {
      if (existsSync(file)) unlinkSync(file);
    } catch {
      // best-effort
    }
  }
  for (const child of tunnels) {
    if (!child.killed) {
      try {
        child.kill("SIGTERM");
      } catch {
        // best-effort
      }
    }
  }
}

for (const signal of ["exit", "SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup();
    if (signal !== "exit") process.exit(0);
  });
}

// -- Spawn one tunnel per ready port -----------------------------------------

async function startTunnel(port) {
  const ready = await waitForPort(port);
  const label = labelFor(port);

  if (!ready) {
    console.error(
      `\x1b[33m⚠ ${label}:${port} did not come up within 60s; skipping its tunnel.\x1b[0m`
    );
    return;
  }

  console.log(
    `\x1b[36m⟳ Starting ${label} tunnel to https://localhost:${port}...\x1b[0m`
  );

  const child = spawn("cloudflared", ["tunnel", "--url", `https://localhost:${port}`], {
    stdio: ["ignore", "inherit", "pipe"],
  });
  tunnels.push(child);

  const file = urlFileFor(port);
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);

    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      writeFileSync(file, match[0], "utf-8");
      console.log(`\n\x1b[32m✓ ${label} tunnel ready:\x1b[0m ${match[0]}`);
    }
  });

  child.on("error", (err) => {
    console.error(`\x1b[31m✗ ${label} tunnel failed: ${err.message}\x1b[0m`);
  });

  child.on("close", (code) => {
    try {
      if (existsSync(file)) unlinkSync(file);
    } catch {
      // best-effort
    }
    // Don't exit the process — other tunnels may still be live. Track exit codes.
    if (code && code !== 0) {
      console.error(`\x1b[31m✗ ${label} tunnel exited with code ${code}\x1b[0m`);
    }
  });
}

await Promise.all(ports.map((port) => startTunnel(port)));

// Hold the process open while tunnel children are running.
await new Promise(() => {});
