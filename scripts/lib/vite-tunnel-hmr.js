/**
 * Vite dev-server helpers for cloudflared quick tunnels.
 *
 * cloudflared forwards HTTP fine, but Vite HMR defaults to localhost WSS.
 * Read the tunnel URL written by scripts/dev/tunnel.js and return matching
 * server.hmr options so remote browsers can connect.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @param {string} rootDir Monorepo root
 * @param {string} [tunnelFile] Tunnel URL file relative to root
 * @returns {URL | null}
 */
export function readTunnelUrl(rootDir, tunnelFile = ".tunnel-url") {
  const file = resolve(rootDir, tunnelFile);
  if (!existsSync(file)) return null;

  try {
    const raw = readFileSync(file, "utf-8").trim();
    return raw ? new URL(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} rootDir
 * @param {string} [tunnelFile]
 * @returns {import('vite').ServerOptions['hmr'] | null}
 */
export function resolveTunnelHmrConfig(rootDir, tunnelFile = ".tunnel-url") {
  const tunnel = readTunnelUrl(rootDir, tunnelFile);
  if (!tunnel) return null;

  const isHttps = tunnel.protocol === "https:";
  return {
    host: tunnel.hostname,
    clientPort: tunnel.port ? Number(tunnel.port) : isHttps ? 443 : 80,
    protocol: isHttps ? "wss" : "ws",
  };
}
