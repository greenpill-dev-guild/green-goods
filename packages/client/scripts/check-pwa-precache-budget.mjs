#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_PRECACHE_BYTES = Number(process.env.PWA_PRECACHE_MAX_BYTES ?? 5 * 1024 * 1024);
const MAX_PRECACHE_ENTRIES = Number(process.env.PWA_PRECACHE_MAX_ENTRIES ?? 160);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(scriptDir, "..");
const distDir = resolve(clientRoot, "dist");
const swPath = resolve(distDir, "sw.js");

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

if (!existsSync(swPath)) {
  console.error(`PWA precache budget check failed: ${swPath} does not exist.`);
  process.exit(1);
}

const swSource = readFileSync(swPath, "utf8");
const urls = [
  ...new Set(
    [...swSource.matchAll(/url:\s*["']([^"']+)["']/g)].map((match) =>
      match[1].split("?")[0].replace(/^\/+/, "")
    )
  ),
].filter((url) => url && !/^https?:\/\//.test(url));

const entries = urls.map((url) => {
  const filePath = resolve(distDir, url);
  if (!existsSync(filePath)) {
    throw new Error(`Precache entry ${url} does not exist in dist.`);
  }
  return {
    url,
    bytes: statSync(filePath).size,
  };
});

const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const failures = [];

if (entries.length > MAX_PRECACHE_ENTRIES) {
  failures.push(`entry count ${entries.length} exceeds ${MAX_PRECACHE_ENTRIES}`);
}

if (totalBytes > MAX_PRECACHE_BYTES) {
  failures.push(`total ${formatBytes(totalBytes)} exceeds ${formatBytes(MAX_PRECACHE_BYTES)}`);
}

if (failures.length > 0) {
  const largest = [...entries]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10)
    .map((entry) => `  - ${entry.url}: ${formatBytes(entry.bytes)}`)
    .join("\n");

  console.error(`PWA precache budget check failed: ${failures.join("; ")}.`);
  console.error(`Largest precache entries:\n${largest}`);
  process.exit(1);
}

console.log(
  `PWA precache budget OK: ${entries.length} entries, ${formatBytes(totalBytes)} total.`
);
