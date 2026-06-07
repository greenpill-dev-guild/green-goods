/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions, type UserConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

const DEFAULT_INDEXER_URL = "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";
const ADMIN_VERCEL_PROJECT_ID = "prj_t2gwwFBMLKM22eYKxtA0yGRBfigg";

function envValue(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function projectScopedSentryDsn(vercelProjectId: string): string | undefined {
  const sentryDsn = envValue("SENTRY_DSN");
  if (!sentryDsn) return undefined;

  return envValue("VERCEL_PROJECT_ID") === vercelProjectId ? sentryDsn : undefined;
}

function resolveAdminSentryDsn(): string | undefined {
  return (
    envValue("VITE_SENTRY_ADMIN_DSN") ||
    envValue("VITE_SENTRY_DSN") ||
    envValue("SENTRY_ADMIN_DSN") ||
    envValue("NEXT_PUBLIC_SENTRY_ADMIN_DSN") ||
    envValue("NEXT_PUBLIC_SENTRY_DSN") ||
    envValue("PUBLIC_SENTRY_ADMIN_DSN") ||
    envValue("PUBLIC_SENTRY_DSN") ||
    projectScopedSentryDsn(ADMIN_VERCEL_PROJECT_ID)
  );
}

function deleteSourceMapsInDirectory(directory: string): void {
  if (!existsSync(directory)) return;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      deleteSourceMapsInDirectory(path);
    } else if (entry.isFile() && entry.name.endsWith(".map")) {
      rmSync(path, { force: true });
    }
  }
}

function deleteSentrySourceMapsPlugin(outDir: string): Plugin {
  let registeredExitCleanup = false;
  const cleanup = () => deleteSourceMapsInDirectory(outDir);

  return {
    name: "green-goods-delete-sentry-source-maps",
    apply: "build",
    enforce: "post",
    buildStart() {
      if (registeredExitCleanup) return;
      registeredExitCleanup = true;
      process.once("beforeExit", cleanup);
      process.once("exit", cleanup);
    },
    writeBundle() {
      cleanup();
    },
    closeBundle() {
      cleanup();
    },
  };
}

/**
 * Split large eager vendor dependencies into coarse, cacheable chunks so the
 * admin entry is not one multi-MB monolith (the un-split build emits a single
 * ~8.4 MB chunk and trips Vite's chunkSizeWarningLimit).
 *
 * Deliberately coarse:
 * - React core (react / react-dom / scheduler / react-is) stays in ONE chunk.
 *   Splitting it — or separating a hook-using lib from React — causes
 *   duplicate-React / "Invalid hook call" at runtime.
 * - The web3 stack (wagmi/viem/ox/...) is the heaviest cluster, so it gets its
 *   own chunk; observability (Sentry/PostHog) likewise.
 * - Everything else stays in a single `vendor` chunk to avoid a request
 *   waterfall from fine-grained per-package splits.
 *
 * Perf/caching only. This does NOT address the Bun-baseline `SIGILL` seen on
 * some Vercel build VMs — that is a Bun bundler/CPU issue tracked separately.
 */
function splitAdminVendorChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  // Only carve out the heavy, relatively self-contained clusters. React core
  // and everything else stay in the default entry chunking — forcing them into
  // separate manual chunks creates circular inter-chunk imports that fail at
  // runtime with "Cannot access X before initialization" (TDZ).
  if (
    /[\\/]node_modules[\\/](?:wagmi|viem|permissionless|ox|abitype|@wagmi|@walletconnect|@reown|@web3modal|@coinbase)[\\/]/.test(
      id
    )
  ) {
    return "vendor-web3";
  }
  if (/[\\/]node_modules[\\/](?:@sentry|posthog-js)[\\/]/.test(id)) {
    return "vendor-observability";
  }
  return undefined;
}

export default defineConfig(async ({ command, mode }): Promise<UserConfig> => {
  const rootDir = resolve(__dirname, "../../");
  // Resolve .env from monorepo root even when this package script runs with a package cwd.
  process.chdir(rootDir);

  // Load .env from monorepo root (all keys, regardless of VITE_ prefix) into process.env
  // so vite.config.ts can read VITE_* and SKIP_* values directly.
  const rootEnv = loadEnv(mode, rootDir, "");
  for (const [key, value] of Object.entries(rootEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  // Use relative paths for IPFS builds
  const isIPFSBuild = process.env.VITE_USE_HASH_ROUTER === "true";

  // Skip mkcert in devcontainer, CI, or when SKIP_MKCERT is set
  // SKIP_MKCERT is useful when sudo is broken (e.g., "you do not exist in passwd database")
  const isDevContainer = process.env.DEVCONTAINER === "true";
  const isCI = process.env.CI === "true";
  const skipMkcert = process.env.SKIP_MKCERT === "true";
  const indexerProxyTarget = process.env.VITE_ENVIO_INDEXER_URL ?? DEFAULT_INDEXER_URL;
  const appVersion =
    process.env.VITE_APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "dev";
  const shortAppVersion = appVersion.slice(0, 12);
  const sentryAuthToken = envValue("SENTRY_AUTH_TOKEN");
  const shouldUploadSentrySourceMaps = command === "build" && Boolean(sentryAuthToken);
  const requestedSourceMaps = process.env.GG_ENABLE_SOURCEMAPS === "true";
  if (command === "build" && requestedSourceMaps && !shouldUploadSentrySourceMaps) {
    console.warn(
      "GG_ENABLE_SOURCEMAPS was ignored because SENTRY_AUTH_TOKEN is missing; production source maps are only emitted for Sentry upload."
    );
  }
  const enableSourceMaps = shouldUploadSentrySourceMaps;
  const sentryDsn = resolveAdminSentryDsn();
  // Env-parity gate (PRD-567): a production deploy must ship with a resolvable
  // Sentry DSN, or error tracking silently no-ops — the May Sentry thrash. This
  // reuses the value resolved above, so it only fires when Sentry would truly be
  // dead. Fail closed on production; warn on other Vercel builds so staging
  // surfaces the same gap without blocking non-prod deploys.
  if (command === "build" && !sentryDsn) {
    const detail =
      "Sentry DSN did not resolve from any known alias (VITE_SENTRY_ADMIN_DSN, VITE_SENTRY_DSN, SENTRY_DSN via the Vercel integration, ...); error tracking would be disabled in this build.";
    if (process.env.VERCEL_ENV === "production") {
      throw new Error(`[env-parity] ${detail} Refusing to ship a production build without it.`);
    }
    if (process.env.VERCEL) {
      console.warn(`[env-parity] ${detail} Staging should mirror production — set the DSN for this environment.`);
    }
  }
  const sentryRelease = `green-goods-admin@${shortAppVersion}`;

  // Dev-only plugin: serves admin's tunnel URL at /__dev/tunnel for QR-code testing
  // on real mobile devices. Mirrors the client-side plugin; reads .tunnel-url-admin
  // (written by scripts/dev/tunnel.js when --port 3002 is included).
  function devTunnelPlugin(): Plugin {
    const tunnelUrlFile = resolve(rootDir, ".tunnel-url-admin");
    return {
      name: "dev-tunnel",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== "/__dev/tunnel") return next();

          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");

          try {
            if (!existsSync(tunnelUrlFile)) {
              res.end(JSON.stringify({ url: null }));
              return;
            }
            const url = readFileSync(tunnelUrlFile, "utf-8").trim();
            res.end(JSON.stringify({ url: url || null }));
          } catch {
            res.end(JSON.stringify({ url: null }));
          }
        });
      },
    };
  }

  const plugins = [
    devTunnelPlugin(),
    // Only use mkcert for HTTPS when not in devcontainer, CI, or explicitly skipped
    ...(isDevContainer || isCI || skipMkcert ? [] : [mkcert()]),
    tailwindcss(),
    // React Compiler: Automatically optimizes components with memoization
    // Eliminates need for manual useMemo/useCallback in most cases
    // @see https://react.dev/learn/react-compiler
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
    ...(shouldUploadSentrySourceMaps
      ? [
          ...sentryVitePlugin({
            authToken: sentryAuthToken,
            errorHandler(error) {
              throw error;
            },
            org: process.env.SENTRY_ORG || "greenpill",
            project:
              process.env.SENTRY_ADMIN_PROJECT ||
              process.env.SENTRY_PROJECT ||
              "green-goods-admin",
            release: {
              name: sentryRelease,
            },
            sourcemaps: {
              filesToDeleteAfterUpload: [resolve(__dirname, "dist/**/*.map")],
            },
            telemetry: false,
          }),
          deleteSentrySourceMapsPlugin(resolve(__dirname, "dist")),
        ]
      : []),
  ];

  const graphqlProxy: ProxyOptions = {
    target: indexerProxyTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/graphql/, ""),
    configure: (proxy) => {
      proxy.on("error", () => {});
    },
  };

  return {
    root: __dirname,
    base: isIPFSBuild ? "./" : "/",
    envDir: rootDir,
    envPrefix: ["VITE_", "SKIP_"],
    build: {
      sourcemap: enableSourceMaps,
      chunkSizeWarningLimit: 2000,
      rollupOptions: { output: { manualChunks: splitAdminVendorChunks } },
    },
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(shortAppVersion),
      "import.meta.env.VITE_SENTRY_ADMIN_DSN": JSON.stringify(sentryDsn ?? ""),
    },
    plugins,
    // Deduplicate React, PostHog, and Sentry to prevent multiple instances
    resolve: {
      dedupe: ["react", "react-dom", "posthog-js", "@sentry/react"],
      conditions: ["import", "module", "browser", "default"],
      alias: {
        "@": resolve(__dirname, "./src"),
        "@green-goods/shared/sentry": resolve(
          __dirname,
          "../shared/src/modules/app/sentry.ts"
        ),
        "@green-goods/shared": resolve(__dirname, "../shared/src"),
        "@green-goods/shared/hooks": resolve(__dirname, "../shared/src/hooks"),
        "@green-goods/shared/providers": resolve(__dirname, "../shared/src/providers"),
        "@green-goods/shared/modules": resolve(__dirname, "../shared/src/modules"),
        "@green-goods/shared/utils": resolve(__dirname, "../shared/src/utils"),
        "@green-goods/shared/config": resolve(__dirname, "../shared/src/config"),
        "@green-goods/shared/types": resolve(__dirname, "../shared/src/types"),
        "@green-goods/shared/stores": resolve(__dirname, "../shared/src/stores"),
        "@green-goods/shared/mocks": resolve(__dirname, "../shared/src/mocks"),
        "@green-goods/shared/i18n": resolve(__dirname, "../shared/src/i18n"),
        "@green-goods/shared/workflows": resolve(__dirname, "../shared/src/workflows"),
        "@green-goods/shared/constants": resolve(__dirname, "../shared/src/constants"),
        "@green-goods/contracts/deployments": resolve(__dirname, "../contracts/deployments"),
        "@green-goods/contracts/abis": resolve(__dirname, "../contracts/abis"),
      },
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
      include: ["react", "react-dom", "posthog-js", "@sentry/react", "multiformats"],
      exclude: ["@green-goods/shared"],
    },
    // Fix CommonJS resolution for ESM packages
    ssr: {
      noExternal: ["multiformats"],
    },
    server: {
      port: 3002,
      strictPort: true,
      host: true,
      open: false,
      hmr: { overlay: true },
      // Polling is only required on Docker bind mounts and some network filesystems.
      // On macOS native FSEvents the default watcher is much cheaper than polling
      // every 100ms across hundreds of files. Opt in with VITE_USE_POLLING=true.
      watch:
        process.env.VITE_USE_POLLING === "true"
          ? { usePolling: true, interval: 100 }
          : undefined,
      proxy: {
        // Proxy indexer requests to avoid CORS issues in development
        "/api/graphql": graphqlProxy,
      },
    },
  };
});
