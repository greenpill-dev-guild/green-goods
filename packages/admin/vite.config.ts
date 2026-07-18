/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { assertEnvParity, assertSentryDsnResolvable } from "../../scripts/lib/env-parity.mjs";
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

function normalizeSentryEnvironment(value: string | undefined): string | undefined {
  const environment = value?.trim().toLowerCase();
  if (!environment) return undefined;
  if (environment === "prod") return "production";
  return environment;
}

function resolveSentryEnvironment(mode: string): string {
  return (
    normalizeSentryEnvironment(envValue("SENTRY_ENVIRONMENT")) ||
    normalizeSentryEnvironment(envValue("VITE_SENTRY_ENVIRONMENT")) ||
    normalizeSentryEnvironment(envValue("VERCEL_TARGET_ENV")) ||
    normalizeSentryEnvironment(envValue("VITE_VERCEL_TARGET_ENV")) ||
    normalizeSentryEnvironment(envValue("VERCEL_ENV")) ||
    normalizeSentryEnvironment(envValue("VITE_VERCEL_ENV")) ||
    normalizeSentryEnvironment(envValue("APP_ENV")) ||
    normalizeSentryEnvironment(mode) ||
    "development"
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
const ADMIN_WEB3_MODULES =
  /[\\/]node_modules[\\/](?:wagmi|viem|permissionless|ox|abitype|@wagmi|@walletconnect|@reown|@web3modal|@coinbase)[\\/]/;
const ADMIN_OBSERVABILITY_MODULES = /[\\/]node_modules[\\/](?:@sentry|posthog-js)[\\/]/;
const ADMIN_REACT_MODULES =
  /[\\/]node_modules[\\/](?:react|react-dom|react-is|scheduler)[\\/]/;

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
  // The PostHog upload lane (scripts/ops/upload-sourcemaps.js) sets
  // GG_ENABLE_SOURCEMAPS so a production build emits maps for server-side upload
  // even when Sentry is not configured — that is the current production path.
  // Sentry upload keeps emitting them too. Any other build (Vercel deploy, local
  // prod build) sets neither flag and ships no maps.
  const requestedSourceMaps = process.env.GG_ENABLE_SOURCEMAPS === "true";
  const enableSourceMaps =
    command === "build" && (requestedSourceMaps || shouldUploadSentrySourceMaps);
  const sentryDsn = resolveAdminSentryDsn();
  const sentryEnvironment = resolveSentryEnvironment(mode);
  if (command === "build") {
    assertEnvParity({
      app: "admin",
      env: process.env,
      schemaPath: resolve(rootDir, ".env.schema"),
    });
    assertSentryDsnResolvable({ app: "admin", sentryDsn, env: process.env });
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
    react(),
    babel({ presets: [reactCompilerPreset()] }),
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
      // 'hidden' emits .map files for server-side upload (PostHog / Sentry) but
      // omits the sourceMappingURL comment, so the maps are never referenced from
      // — or served to — browsers. The upload lane deletes them after upload.
      sourcemap: enableSourceMaps ? "hidden" : false,
      chunkSizeWarningLimit: 2000,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "vendor-react", test: ADMIN_REACT_MODULES, priority: 20 },
              { name: "vendor-web3", test: ADMIN_WEB3_MODULES, priority: 10 },
              {
                name: "vendor-observability",
                test: ADMIN_OBSERVABILITY_MODULES,
                priority: 10,
              },
            ],
          },
          strictExecutionOrder: true,
        },
      },
    },
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(shortAppVersion),
      "import.meta.env.VITE_SENTRY_ADMIN_DSN": JSON.stringify(sentryDsn ?? ""),
      "import.meta.env.VITE_SENTRY_ENVIRONMENT": JSON.stringify(sentryEnvironment),
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
      // `@green-goods/shared` is excluded (served as source for HMR), so Vite's
      // startup scanner never crawls its bare imports. Without the explicit
      // include list below, every one of shared's runtime deps is "discovered"
      // at request time on a cold cache, and each discovery broadcasts
      // "✨ optimized dependencies changed. reloading" — a full-page reload that
      // kills whatever in-flight lazy-route navigation the operator just
      // clicked (the long-standing "Create Assessment flashes and refreshes"
      // bug). Pre-bundling them at startup makes interaction-time discovery
      // impossible. Keep in sync with packages/client/vite.config.ts; when a
      // new bare import lands in shared, add it here (watch the dev log for
      // "new dependencies optimized" — that line means this list has drifted).
      include: [
        "@hookform/resolvers/zod",
        "react",
        "react-dom",
        "react-hook-form",
        "zod",
        "posthog-js",
        "posthog-js/react",
        "@sentry/react",
        "multiformats",
        // ── @green-goods/shared runtime surface ──
        "@green-goods/shared > @ethereum-attestation-service/eas-sdk",
        // Vite 8 resolves dependencies installed only under the linked shared
        // package through its `>` include syntax.
        "@green-goods/shared > @hypercerts-org/contracts",
        "@green-goods/shared > @hypercerts-org/marketplace-sdk",
        "@green-goods/shared > @hypercerts-org/sdk",
        "@green-goods/shared > @radix-ui/react-popover",
        "@radix-ui/react-select",
        "@green-goods/shared > @reown/appkit-adapter-wagmi",
        "@reown/appkit/react",
        "@green-goods/shared > @use-gesture/react",
        "@green-goods/shared > @wagmi/core",
        "@green-goods/shared > @xstate/react",
        "@green-goods/shared > browser-image-compression",
        "@green-goods/shared > clsx",
        "ethers",
        "gql.tada",
        "@green-goods/shared > graphql-request",
        "@green-goods/shared > heic-to/csp",
        "@green-goods/shared > idb",
        "idb-keyval",
        "@green-goods/shared > permissionless",
        "@green-goods/shared > permissionless/accounts",
        "@green-goods/shared > permissionless/clients/passkeyServer",
        "@green-goods/shared > permissionless/clients/pimlico",
        "@green-goods/shared > react-day-picker",
        "react-hot-toast",
        "@green-goods/shared > react-select",
        "tailwind-merge",
        "tailwind-variants",
        "viem/account-abstraction",
        "viem/chains",
        "@green-goods/shared > xstate",
        "zustand",
        "zustand/middleware",
        "zustand/react/shallow",
      ],
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
