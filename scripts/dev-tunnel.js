#!/usr/bin/env node

/**
 * PWA Device Testing Tunnel
 *
 * Creates a cloudflared tunnel to the local dev client server,
 * giving you a public HTTPS URL for testing on real mobile devices.
 *
 * When a tunnel URL is obtained, it's written to `.tunnel-url` so the
 * Vite dev server can expose it to the DevTunnel overlay (QR code).
 *
 * Usage:
 *   bun run dev:tunnel              # Tunnel to client (port 3001)
 *   bun run dev:tunnel -- --port 3002  # Tunnel to admin (port 3002)
 *
 * Prerequisites:
 *   brew install cloudflared
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex !== -1 ? args[portIndex + 1] : "3001";

const ROOT = resolve(import.meta.dirname, "..");
const URL_FILE = resolve(ROOT, ".tunnel-url");

// -- Preflight checks --------------------------------------------------------

// Check cloudflared is installed
try {
  execSync("which cloudflared", { stdio: "ignore" });
} catch {
  console.error(
    "\x1b[31m✗ cloudflared not found.\x1b[0m Install it with:\n\n  brew install cloudflared\n"
  );
  process.exit(1);
}

// Wait for the dev server to be ready (up to 60s)
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

// -- Cleanup ------------------------------------------------------------------

function cleanup() {
  try {
    if (existsSync(URL_FILE)) unlinkSync(URL_FILE);
  } catch {
    // best-effort
  }
}

for (const signal of ["exit", "SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup();
    if (signal !== "exit") process.exit(0);
  });
}

// -- Main ---------------------------------------------------------------------

const ready = await waitForPort(port);
if (!ready) {
  console.error(
    `\x1b[31m✗ No server running on port ${port} after 60s.\x1b[0m Start it first:\n\n  bun dev\n`
  );
  process.exit(1);
}

console.log(`\x1b[36m⟳ Starting tunnel to https://localhost:${port}...\x1b[0m\n`);

const tunnel = spawn("cloudflared", ["tunnel", "--url", `https://localhost:${port}`], {
  stdio: ["ignore", "inherit", "pipe"],
});

// Parse cloudflared stderr for the tunnel URL
tunnel.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  process.stderr.write(text);

  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    writeFileSync(URL_FILE, match[0], "utf-8");
    console.log(`\n\x1b[32m✓ Tunnel ready:\x1b[0m ${match[0]}`);
    console.log(`  Open the dev client to see the QR code.\n`);
  }
});

tunnel.on("error", (err) => {
  console.error(`\x1b[31m✗ Failed to start tunnel: ${err.message}\x1b[0m`);
  cleanup();
  process.exit(1);
});

tunnel.on("close", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
