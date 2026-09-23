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
  // The offline shell installs in three tiers: critical, the offline-ready set
  // an installed app fetches straight away, and a send-time tail. Keep the
  // combined ceiling close to the full signed-in app so moving an asset between
  // tiers cannot hide growth.
  shellRaw: Number(process.env.PWA_SHELL_RAW_MAX ?? 11 * MiB),
  shellGzip: Number(process.env.PWA_SHELL_GZIP_MAX ?? 3.25 * MiB),
  shellPriorityGzip: Number(process.env.PWA_SHELL_PRIORITY_GZIP_MAX ?? 1.1 * MiB),
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

// The shape of every lazy chunk's file name, set by `chunkFileNames` in
// vite.config.ts. Privacy filters match a site's own files by name (Brave's
// Aggressive blocking, uBlock Origin): EasyPrivacy's `/analytics-events-` rule
// blocks the chunk every auth-importing route loads, and the browser reports the
// failure against the route's chunk. The `-<hash>` suffix is also what lets the
// worker reuse an unchanged file (`isContentAddressed` in src/sw/shellAssets.ts).
const OPAQUE_CHUNK_FILE = /^assets\/chunk-[A-Za-z0-9_-]{8,}\.js$/;

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
  // The worker bundle inlines the precache manifest as objects carrying both a
  // revision and a url; other url literals in the worker's own code are not entries.
  const manifestEntry =
    /\{\s*(?:"?revision"?:\s*(?:"[^"]*"|null)\s*,\s*"?url"?:\s*"([^"]+)"|"?url"?:\s*"([^"]+)"\s*,\s*"?revision"?:\s*(?:"[^"]*"|null))\s*\}/g;
  const precacheUrls = [
    ...new Set(
      [...swSource.matchAll(manifestEntry)].map((match) =>
        (match[1] ?? match[2]).split("?")[0].replace(/^\/+/, "")
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
  const lazyChunkFiles = [
    ...new Set(
      Object.values(manifest)
        .filter((entry) => !entry.isEntry && String(entry.file ?? "").endsWith(".js"))
        .map((entry) => entry.file)
    ),
  ];
  const namedChunks = lazyChunkFiles.filter((file) => !OPAQUE_CHUNK_FILE.test(file)).sort();
  if (namedChunks.length) {
    const shown = namedChunks.slice(0, 20);
    const more = namedChunks.length - shown.length;
    failures.push(
      `lazy chunk file names must be opaque (assets/chunk-<hash>.js):\n  ${shown.join("\n  ")}${
        more > 0 ? `\n  …and ${more} more` : ""
      }`
    );
  }
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
  const TIERS = ["criticalAssets", "priorityAssets", "tailAssets"];
  if (shell.version !== 3 || !Array.isArray(shell.assets) || TIERS.some((t) => !Array.isArray(shell[t]))) {
    throw new Error("Offline shell manifest must use the version 3 critical/priority/tail shape.");
  }
  const shellAssets = new Set(shell.assets);
  const tierSets = TIERS.map((tier) => new Set(shell[tier]));
  if (
    shellAssets.size !== shell.assets.length ||
    TIERS.some((tier, index) => tierSets[index].size !== shell[tier].length)
  ) {
    throw new Error("Offline shell manifest contains duplicate assets.");
  }
  const tieredTotal = tierSets.reduce((sum, tier) => sum + tier.size, 0);
  if (
    shellAssets.size !== tieredTotal ||
    [...shellAssets].some((asset) => !tierSets.some((tier) => tier.has(asset)))
  ) {
    throw new Error(
      "Offline shell critical, priority and tail assets must be a disjoint complete partition."
    );
  }
  const tierBytes = (tier, gzip = false) =>
    shell[tier].reduce((sum, file) => sum + fileSize(file, gzip), 0);
  const shellRaw = shell.assets.reduce((sum, file) => sum + fileSize(file), 0);
  const shellGzip = shell.assets.reduce((sum, file) => sum + fileSize(file, true), 0);
  const criticalRaw = tierBytes("criticalAssets");
  const criticalGzip = tierBytes("criticalAssets", true);
  const priorityRaw = tierBytes("priorityAssets");
  const priorityGzip = tierBytes("priorityAssets", true);
  const tailRaw = tierBytes("tailAssets");
  const tailGzip = tierBytes("tailAssets", true);
  // The offline-ready tier is what an installed app fetches straight away, so
  // it is budgeted on its own: growth here is felt right after install.
  if (priorityGzip > LIMITS.shellPriorityGzip) {
    failures.push(
      `offline-ready tier gzip ${formatBytes(priorityGzip)} exceeds ${formatBytes(LIMITS.shellPriorityGzip)}`
    );
  }
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
      `${lazyChunkFiles.length} opaque lazy chunks`,
      `offline shell ${formatBytes(shellRaw)} raw / ${formatBytes(shellGzip)} gzip`,
      `critical ${shell.criticalAssets.length} assets (${formatBytes(criticalRaw)} raw / ${formatBytes(criticalGzip)} gzip)`,
      `offline-ready ${shell.priorityAssets.length} assets (${formatBytes(priorityRaw)} raw / ${formatBytes(priorityGzip)} gzip)`,
      `tail ${shell.tailAssets.length} assets (${formatBytes(tailRaw)} raw / ${formatBytes(tailGzip)} gzip)`,
    ].join("; ")
  );
} catch (error) {
  console.error(`PWA build budget check failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
