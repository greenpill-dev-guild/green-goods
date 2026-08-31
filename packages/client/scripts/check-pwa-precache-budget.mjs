#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KiB = 1024;
const MiB = 1024 * KiB;
const LIMITS = {
  precacheRaw: Number(process.env.PWA_PRECACHE_MAX_BYTES ?? 5 * MiB),
  precacheEntries: Number(process.env.PWA_PRECACHE_MAX_ENTRIES ?? 40),
  publicStartupGzip: Number(process.env.PWA_PUBLIC_STARTUP_GZIP_MAX ?? 450 * KiB),
  pwaStartupGzip: Number(process.env.PWA_INSTALLED_STARTUP_GZIP_MAX ?? 1.25 * MiB),
  modulePreloads: Number(process.env.PWA_MODULE_PRELOAD_MAX ?? 16),
  majorRouteGzip: Number(process.env.PWA_MAJOR_ROUTE_GZIP_MAX ?? 500 * KiB),
  mediaRouteGzip: Number(process.env.PWA_MEDIA_ROUTE_GZIP_MAX ?? 850 * KiB),
  shellRaw: Number(process.env.PWA_SHELL_RAW_MAX ?? 5 * MiB),
  shellGzip: Number(process.env.PWA_SHELL_GZIP_MAX ?? 1.5 * MiB),
};

const FORBIDDEN_PUBLIC_MODULES = [
  "/providers/AppKitProvider",
  "/routes/WalletRuntimeProviders",
  "/modules/auth/",
  "/hooks/auth/",
  "/providers/JobQueue",
  "/modules/job-queue/",
  "/config/query-persistence",
  "/config/default-chain",
  "/hooks/blockchain/",
];

const ROUTE_SOURCE_SUFFIXES = [
  "src/views/Public/Home.tsx",
  "src/views/Public/Gardens.tsx",
  "src/views/Public/GardenDetail.tsx",
  "src/views/Public/Cookies.tsx",
  "src/views/Public/Fund.tsx",
  "src/views/Public/Vaults.tsx",
  "src/views/Public/Impact.tsx",
  "src/views/Public/Actions.tsx",
  "src/views/Public/Glossary.tsx",
  "src/views/Login/index.tsx",
  "src/views/Garden/index.tsx",
  "src/views/Profile/index.tsx",
  "src/views/Home/index.tsx",
  "src/views/Home/Garden/index.tsx",
  "src/views/Home/Garden/Work.tsx",
  "src/views/Home/Garden/Compose.tsx",
  "src/views/Home/Garden/Commitment.tsx",
  "src/views/Home/Garden/Proof.tsx",
  "src/views/Home/Garden/Assessment.tsx",
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = process.env.PWA_DIST_DIR
  ? resolve(process.env.PWA_DIST_DIR)
  : resolve(scriptDir, "../dist");
const swPath = resolve(distDir, "sw.js");
const viteManifestPath = resolve(distDir, ".vite/manifest.json");
const buildGraphPath = resolve(distDir, ".vite/pwa-build-graph.json");
const shellManifestPath = resolve(distDir, "pwa-shell-assets.json");
const indexPath = resolve(distDir, "index.html");

function formatBytes(bytes) {
  return `${(bytes / MiB).toFixed(2)} MiB`;
}

function requireFile(path) {
  if (!existsSync(path)) throw new Error(`Required build artifact does not exist: ${path}`);
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(requireFile(path));
}

function fileSize(file, gzip = false) {
  const path = resolve(distDir, file.replace(/^\/+/, ""));
  if (!existsSync(path)) throw new Error(`Build asset ${file} does not exist in dist.`);
  return gzip ? gzipSync(readFileSync(path)).byteLength : statSync(path).size;
}

function collectManifestClosure(manifest, roots) {
  const visited = new Set();
  const files = new Set();
  const visit = (key) => {
    if (!key || visited.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    if (!entry) return;
    if (entry.file) files.add(entry.file);
    entry.css?.forEach((file) => files.add(file));
    entry.assets?.forEach((file) => files.add(file));
    entry.imports?.forEach(visit);
  };
  roots.forEach(visit);
  return { keys: visited, files };
}

function findManifestKey(manifest, sourceSuffix) {
  return Object.keys(manifest).find((key) =>
    String(manifest[key].src ?? key).endsWith(sourceSuffix)
  );
}

function collectChunkClosure(graph, rootFiles) {
  const visited = new Set();
  const visit = (file) => {
    if (!file || visited.has(file)) return;
    visited.add(file);
    graph.chunks[file]?.imports?.forEach(visit);
  };
  rootFiles.forEach(visit);
  return visited;
}

const failures = [];
try {
  const swSource = requireFile(swPath);
  const precacheUrls = [
    ...new Set(
      [...swSource.matchAll(/url:\s*["']([^"']+)["']/g)].map((match) =>
        match[1].split("?")[0].replace(/^\/+/, "")
      )
    ),
  ].filter((url) => url && !/^https?:\/\//.test(url));
  const precacheRaw = precacheUrls.reduce((sum, url) => sum + fileSize(url), 0);
  if (precacheUrls.length > LIMITS.precacheEntries) {
    failures.push(`precache entry count ${precacheUrls.length} exceeds ${LIMITS.precacheEntries}`);
  }
  if (precacheRaw > LIMITS.precacheRaw) {
    failures.push(`precache raw ${formatBytes(precacheRaw)} exceeds ${formatBytes(LIMITS.precacheRaw)}`);
  }

  const manifest = readJson(viteManifestPath);
  const graph = readJson(buildGraphPath);
  const mainKey =
    findManifestKey(manifest, "src/main.tsx") ??
    Object.keys(manifest).find((key) => manifest[key].isEntry);
  const publicKey = findManifestKey(manifest, "src/bootstrapPublic.tsx");
  const pwaKey = findManifestKey(manifest, "src/bootstrapPwa.tsx");
  if (!mainKey || !publicKey || !pwaKey) throw new Error("Bootstrap entries are missing from Vite manifest");

  const mainClosure = collectManifestClosure(manifest, [mainKey]);
  const publicClosure = collectManifestClosure(manifest, [mainKey, publicKey]);
  const publicGzip = [...publicClosure.files].reduce((sum, file) => sum + fileSize(file, true), 0);
  if (publicGzip > LIMITS.publicStartupGzip) {
    failures.push(
      `public startup gzip ${formatBytes(publicGzip)} exceeds ${formatBytes(LIMITS.publicStartupGzip)}`
    );
  }

  const pwaShellSources = [
    "src/bootstrapPwa.tsx",
    "src/routes/PwaRuntime.tsx",
    "src/routes/WalletRuntimeProviders.tsx",
    "src/routes/RequireAuth.tsx",
    "src/routes/AppShell.tsx",
    "src/views/Home/index.tsx",
  ];
  const signedInRoots = [mainKey, pwaKey, ...pwaShellSources.map((src) => findManifestKey(manifest, src))];
  const signedOutRoots = [...signedInRoots.slice(0, 2), findManifestKey(manifest, "src/views/Login/index.tsx")];
  const signedIn = collectManifestClosure(manifest, signedInRoots);
  const signedOut = collectManifestClosure(manifest, signedOutRoots);
  const signedInGzip = [...signedIn.files].reduce((sum, file) => sum + fileSize(file, true), 0);
  const signedOutGzip = [...signedOut.files].reduce((sum, file) => sum + fileSize(file, true), 0);
  const pwaStartupGzip = Math.max(signedInGzip, signedOutGzip);
  if (pwaStartupGzip > LIMITS.pwaStartupGzip) {
    failures.push(
      `installed startup gzip ${formatBytes(pwaStartupGzip)} exceeds ${formatBytes(LIMITS.pwaStartupGzip)}`
    );
  }

  const modulePreloads = (requireFile(indexPath).match(/rel=["']modulepreload["']/g) ?? []).length;
  if (modulePreloads > LIMITS.modulePreloads) {
    failures.push(`HTML module preloads ${modulePreloads} exceeds ${LIMITS.modulePreloads}`);
  }

  const routeFailures = [];
  for (const [key, entry] of Object.entries(manifest)) {
    const source = String(entry.src ?? key);
    if (
      !entry.isDynamicEntry ||
      !ROUTE_SOURCE_SUFFIXES.some((sourceSuffix) => source.endsWith(sourceSuffix))
    ) {
      continue;
    }
    const baseFiles = source.includes("src/views/Public/") ? publicClosure.files : signedIn.files;
    const route = collectManifestClosure(manifest, [key]);
    const incrementalFiles = [...route.files].filter((file) => !baseFiles.has(file));
    const gzip = incrementalFiles.reduce((sum, file) => sum + fileSize(file, true), 0);
    const mediaException =
      /\/(Proof|Media)(\/|\.)/.test(source) || source.endsWith("src/views/Garden/index.tsx");
    const limit = mediaException ? LIMITS.mediaRouteGzip : LIMITS.majorRouteGzip;
    if (gzip > limit) routeFailures.push(`${source}: ${formatBytes(gzip)} > ${formatBytes(limit)}`);
  }
  if (routeFailures.length) failures.push(`route budgets exceeded\n  ${routeFailures.join("\n  ")}`);

  const shell = readJson(shellManifestPath);
  const shellRaw = shell.assets.reduce((sum, file) => sum + fileSize(file), 0);
  const shellGzip = shell.assets.reduce((sum, file) => sum + fileSize(file, true), 0);
  if (shellRaw > LIMITS.shellRaw) {
    failures.push(`offline shell raw ${formatBytes(shellRaw)} exceeds ${formatBytes(LIMITS.shellRaw)}`);
  }
  if (shellGzip > LIMITS.shellGzip) {
    failures.push(`offline shell gzip ${formatBytes(shellGzip)} exceeds ${formatBytes(LIMITS.shellGzip)}`);
  }

  const publicChunkClosure = collectChunkClosure(graph, publicClosure.files);
  const forbidden = [];
  for (const file of publicChunkClosure) {
    for (const moduleId of graph.chunks[file]?.modules ?? []) {
      if (FORBIDDEN_PUBLIC_MODULES.some((pattern) => moduleId.includes(pattern))) {
        forbidden.push(moduleId);
      }
    }
  }
  if (forbidden.length) {
    failures.push(`forbidden public dependencies:\n  ${[...new Set(forbidden)].sort().join("\n  ")}`);
  }

  if (failures.length) {
    console.error(`PWA build budget check failed:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }

  console.log(
    [
      `PWA budgets OK: ${precacheUrls.length} precache entries (${formatBytes(precacheRaw)} raw)`,
      `public startup ${formatBytes(publicGzip)} gzip`,
      `installed startup ${formatBytes(pwaStartupGzip)} gzip`,
      `${modulePreloads} module preloads`,
      `offline shell ${formatBytes(shellRaw)} raw / ${formatBytes(shellGzip)} gzip`,
    ].join("; ")
  );
} catch (error) {
  console.error(`PWA build budget check failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
