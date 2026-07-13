/// <reference types="vitest" />

import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, readdirSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";
import { assertEnvParity, assertSentryDsnResolvable } from "../../scripts/lib/env-parity.mjs";
import { resolveTunnelHmrConfig } from "../../scripts/lib/vite-tunnel-hmr.js";
import {
  createPwaManifestBranding,
  type PwaManifestBranding,
  resolvePwaManifestFlavor,
} from "./src/config/pwa-manifest";
import { APP_ROUTES, createPwaRoutingConfig } from "./src/config/pwa-routing";
import { createPublicSocialPreviewPlugin } from "./vite/social-preview";

const DEFAULT_INDEXER_URL = "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";
const CLIENT_VERCEL_PROJECT_ID = "prj_AFl9rmdB5VJFKcpK4Art9had9DmG";

function envValue(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function projectScopedSentryDsn(vercelProjectId: string): string | undefined {
  const sentryDsn = envValue("SENTRY_DSN");
  if (!sentryDsn) return undefined;

  return envValue("VERCEL_PROJECT_ID") === vercelProjectId ? sentryDsn : undefined;
}

function resolveClientSentryDsn(): string | undefined {
  return (
    envValue("VITE_SENTRY_CLIENT_DSN") ||
    envValue("VITE_SENTRY_DSN") ||
    envValue("SENTRY_CLIENT_DSN") ||
    envValue("NEXT_PUBLIC_SENTRY_CLIENT_DSN") ||
    envValue("NEXT_PUBLIC_SENTRY_DSN") ||
    envValue("PUBLIC_SENTRY_CLIENT_DSN") ||
    envValue("PUBLIC_SENTRY_DSN") ||
    projectScopedSentryDsn(CLIENT_VERCEL_PROJECT_ID)
  );
}

function normalizeSentryEnvironment(value: string | undefined): string | undefined {
  const environment = value?.trim().toLowerCase();
  if (!environment) return undefined;
  if (environment === "prod") return "production";
  return environment;
}

function resolveAppVersion(): string {
  const vercelCommitSha = envValue("VERCEL_GIT_COMMIT_SHA");

  if (envValue("VERCEL") && vercelCommitSha) {
    return vercelCommitSha;
  }

  return envValue("VITE_APP_VERSION") || vercelCommitSha || envValue("GITHUB_SHA") || "dev";
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

function pwaHtmlMetadataPlugin(branding: PwaManifestBranding): Plugin {
  const appleIcon = (sizes: string) => {
    const icon = branding.appleTouchIcons.find((candidate) => candidate.sizes === sizes);
    if (!icon) throw new Error(`Missing ${sizes} apple touch icon for ${branding.flavor} PWA`);
    return icon.src;
  };

  const replacements = {
    "%PWA_APP_NAME%": branding.name,
    "%PWA_APPLE_ICON_57%": appleIcon("57x57"),
    "%PWA_APPLE_ICON_60%": appleIcon("60x60"),
    "%PWA_APPLE_ICON_72%": appleIcon("72x72"),
    "%PWA_APPLE_ICON_120%": appleIcon("120x120"),
    "%PWA_APPLE_ICON_144%": appleIcon("144x144"),
    "%PWA_APPLE_ICON_180%": appleIcon("180x180"),
    "%PWA_BROWSER_ICON%": branding.browserIcon,
    "%PWA_MS_TILE_COLOR%": branding.msTileColor,
    "%PWA_MS_TILE_IMAGE%": branding.msTileImage,
    "%PWA_THEME_COLOR_LIGHT%": branding.htmlThemeColorLight,
    "%PWA_THEME_COLOR_DARK%": branding.htmlThemeColorDark,
  };

  return {
    name: "green-goods-pwa-html-metadata",
    transformIndexHtml(html) {
      let transformedHtml = html;
      for (const [token, value] of Object.entries(replacements)) {
        transformedHtml = transformedHtml.split(token).join(value);
      }
      return transformedHtml;
    },
  };
}

export default defineConfig(async ({ command, mode }) => {
  const rootDir = resolve(__dirname, "../../");
  // Resolve .env from monorepo root even when this package script runs with a package cwd.
  process.chdir(rootDir);

  // Load .env from monorepo root (all keys, regardless of VITE_ prefix) into process.env
  // so vite.config.ts can read VITE_* and SKIP_* values directly.
  const rootEnv = loadEnv(mode, rootDir, "");
  for (const [key, value] of Object.entries(rootEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  const enableRpcBgSync = process.env.VITE_ENABLE_RPC_BG_SYNC === "true";

  const rpcBgSyncCaching: NonNullable<NonNullable<VitePWAOptions["workbox"]>["runtimeCaching"]> =
    enableRpcBgSync
      ? ([
          {
            urlPattern: /https:\/\/api\.pimlico\.xyz\/.*\/rpc$/,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "rpc-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            urlPattern: /https:\/\/(\w+\.)?alchemyapi\.io\/v2\/.*/,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "rpc-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
        ] as NonNullable<NonNullable<VitePWAOptions["workbox"]>["runtimeCaching"]>)
      : ([] as NonNullable<NonNullable<VitePWAOptions["workbox"]>["runtimeCaching"]>);

  // Use relative paths for IPFS builds
  const isIPFSBuild = process.env.VITE_USE_HASH_ROUTER === "true";
  const pwaRouting = createPwaRoutingConfig(isIPFSBuild);
  const appVersion = resolveAppVersion();
  const shortAppVersion = appVersion.slice(0, 12);
  const versionedUrl = (url: string) =>
    shortAppVersion && shortAppVersion !== "dev"
      ? `${url}${url.includes("?") ? "&" : "?"}gg_v=${encodeURIComponent(shortAppVersion)}`
      : url;
  const pwaStartUrl = versionedUrl(pwaRouting.startUrl);
  const pwaBranding = createPwaManifestBranding(resolvePwaManifestFlavor(process.env));

  // Skip mkcert in devcontainer, CI, or when SKIP_MKCERT is set
  // SKIP_MKCERT is useful when sudo is broken (e.g., "you do not exist in passwd database")
  const isDevContainer = process.env.DEVCONTAINER === "true";
  const isCI = process.env.CI === "true";
  const skipMkcert = process.env.SKIP_MKCERT === "true";
  const nodeEnv = command === "build" ? "production" : "development";
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
  const sentryDsn = resolveClientSentryDsn();
  const sentryEnvironment = resolveSentryEnvironment(mode);
  if (command === "build") {
    assertEnvParity({
      app: "client",
      env: process.env,
      schemaPath: resolve(rootDir, ".env.schema"),
    });
    assertSentryDsnResolvable({ app: "client", sentryDsn, env: process.env });
  }
  const sentryRelease = `green-goods-client@${shortAppVersion}`;
  const indexerProxyTarget =
    process.env.VITE_ENVIO_INDEXER_URL?.trim() ||
    (nodeEnv === "development" ? "http://localhost:3006/v1/graphql" : DEFAULT_INDEXER_URL);
  const isBunRuntime = "bun" in process.versions;
  if (command === "build") {
    process.env.NODE_ENV = "production";
  }

  // Dev-only plugin: serves tunnel URL at /__dev/tunnel for the landing page QR code
  function devTunnelPlugin(): Plugin {
    const tunnelUrlFile = resolve(rootDir, ".tunnel-url");
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

  const tunnelHmr = resolveTunnelHmrConfig(rootDir);

  const plugins = [
    devTunnelPlugin(),
    pwaHtmlMetadataPlugin(pwaBranding),
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
    createPublicSocialPreviewPlugin(isIPFSBuild),
    VitePWA({
      includeAssets: pwaBranding.includeAssets,
      injectRegister: false,
      registerType: "autoUpdate",
      workbox: {
        // Workbox's Rollup/Terser pass can exit early under Bun while writing the
        // generated service worker. Keep the app build in production mode, but
        // avoid SW minification on Bun so `bun run build` remains deterministic.
        mode: isBunRuntime ? "development" : nodeEnv,
        disableDevLogs: true,
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        globPatterns: ["index.html", "assets/*.css"],
        globIgnores: [
          "**/*.map",
          "assets/Actions-*.js",
          "assets/Cookies-*.js",
          "assets/EditorialReadDeeper-*.js",
          "assets/Fund-*.js",
          "assets/Gardens-*.js",
          "assets/Glossary-*.js",
          "assets/Impact-*.js",
          "assets/Public*.js",
          "assets/TopNav-*.js",
          "assets/index-*.js",
          "assets/socials-*.js",
          "social/**",
          "social-*.png",
          "actions/index.html",
          "cookies/index.html",
          "fund/index.html",
          "gardens/index.html",
          "glossary/index.html",
          "impact/index.html",
          "landing/index.html",
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        // The browser-origin worker is scoped to /home, so the app shell fallback
        // only owns installed-app routes while public/editorial routes stay in the browser.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [
          /^\/$/,
          /^\/actions(?:[?#].*)?$/,
          /^\/cookies(?:[?#].*)?$/,
          /^\/fund(?:[?#].*)?$/,
          /^\/gardens(?:\/.*)?(?:[?#].*)?$/,
          /^\/glossary(?:[?#].*)?$/,
          /^\/impact(?:[?#].*)?$/,
        ],
        sourcemap: false,
        importScripts: ["sw-custom.js"],
        runtimeCaching: [
          {
            urlPattern: /.*\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // IPFS content is immutable (same CID = same bytes forever), so cache aggressively.
            // Matches dedicated Pinata gateway + public IPFS gateways.
            urlPattern:
              /https:\/\/(greengoods\.mypinata\.cloud|gateway\.pinata\.cloud|ipfs\.io)\/ipfs\/.+/,
            handler: "CacheFirst",
            options: {
              cacheName: "ipfs-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year — CIDs are immutable
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Indexer API - show cached immediately, revalidate in background
            urlPattern: /indexer\.hyperindex\.xyz|localhost:3006/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "indexer-cache",
              expiration: {
                maxAgeSeconds: 24 * 60 * 60, // 24 hours for offline
                maxEntries: 100,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // GraphQL fallback (EAS, etc.) - show cached immediately, revalidate in background
            urlPattern: /graphql/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "graphql-cache",
              expiration: {
                maxAgeSeconds: 24 * 60 * 60, // 24 hours for offline
                maxEntries: 100,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Background sync for critical POSTs (users/me updates as example)
          {
            urlPattern: /\/users\/me$/,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "gg-api-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          ...rpcBgSyncCaching,
        ],
      },
      manifest: {
        id: pwaBranding.manifestId,
        name: pwaBranding.name,
        short_name: pwaBranding.shortName,
        ...(pwaBranding.description ? { description: pwaBranding.description } : {}),
        // Window Controls Overlay: Native desktop app feel (removes browser titlebar)
        // Falls back to standalone on mobile or unsupported browsers
        display_override: ["window-controls-overlay", "standalone"],
        icons: pwaBranding.manifestIcons,
        start_url: pwaStartUrl,
        scope: pwaRouting.manifestScope,
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: pwaBranding.themeColor,
        background_color: pwaBranding.backgroundColor,
        shortcuts: [
          {
            name: "Home",
            description: "View Gardens",
            url: pwaRouting.shortcutUrl(APP_ROUTES.home),
            icons: [{ src: pwaBranding.shortcutIcon, sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Garden",
            description: "Upload your work",
            url: pwaRouting.shortcutUrl(APP_ROUTES.garden),
            icons: [{ src: pwaBranding.shortcutIcon, sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Profile",
            description: "View your profile",
            url: pwaRouting.shortcutUrl(APP_ROUTES.profile),
            icons: [{ src: pwaBranding.shortcutIcon, sizes: "192x192", type: "image/png" }],
          },
        ],
        categories: [],
      },
      devOptions: { enabled: process.env.VITE_ENABLE_SW_DEV === "true" },
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
              process.env.SENTRY_CLIENT_PROJECT ||
              process.env.SENTRY_PROJECT ||
              "green-goods-client",
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

  return {
    root: __dirname,
    base: pwaRouting.assetBasePath,
    envDir: rootDir,
    envPrefix: ["VITE_", "SKIP_"],
    build: {
      // 'hidden' emits .map files for server-side upload (PostHog / Sentry) but
      // omits the sourceMappingURL comment, so the maps are never referenced from
      // — or served to — browsers. The upload lane deletes them after upload.
      sourcemap: enableSourceMaps ? "hidden" : false,
      chunkSizeWarningLimit: 2000,
    },
    define: {
      "import.meta.env.DEV": JSON.stringify(nodeEnv !== "production"),
      "import.meta.env.PROD": JSON.stringify(nodeEnv === "production"),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(shortAppVersion),
      "import.meta.env.VITE_SENTRY_CLIENT_DSN": JSON.stringify(sentryDsn ?? ""),
      "import.meta.env.VITE_SENTRY_ENVIRONMENT": JSON.stringify(sentryEnvironment),
      "process.env.NODE_ENV": JSON.stringify(nodeEnv),
    },
    esbuild: {
      jsxDev: command !== "build",
    },
    plugins,
    // Deduplicate React, PostHog, and Sentry to prevent multiple instances
    resolve: {
      dedupe: ["react", "react-dom", "posthog-js", "@sentry/react"],
      alias: {
        "@": resolve(__dirname, "./src"),
        "@green-goods/shared/sentry": resolve(__dirname, "../shared/src/modules/app/sentry.ts"),
        "@green-goods/shared/service-worker": resolve(
          __dirname,
          "../shared/src/modules/app/service-worker-registration.ts"
        ),
        "@green-goods/shared": resolve(__dirname, "../shared/src"),
        "@green-goods/shared/components": resolve(__dirname, "../shared/src/components"),
        "@green-goods/shared/hooks": resolve(__dirname, "../shared/src/hooks"),
        "@green-goods/shared/providers": resolve(__dirname, "../shared/src/providers"),
        "@green-goods/shared/public-contracts": resolve(
          __dirname,
          "../shared/src/public-contracts"
        ),
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
      // Add conditions for proper module resolution on Vercel
      conditions: [nodeEnv, "import", "module", "browser", "default"],
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
      // `@green-goods/shared` is excluded (served as source for HMR), so Vite's
      // startup scanner never crawls its bare imports. Pre-bundle shared's
      // runtime dep surface up front — otherwise a cold cache discovers these
      // at request time and broadcasts "optimized dependencies changed.
      // reloading", a full-page reload that kills in-flight lazy-route
      // navigation. Keep in sync with packages/admin/vite.config.ts.
      include: [
        "react",
        "react-dom",
        "posthog-js",
        "posthog-js/react",
        "@sentry/react",
        // ── @green-goods/shared runtime surface ──
        "@ethereum-attestation-service/eas-sdk",
        "@hypercerts-org/contracts",
        "@hypercerts-org/marketplace-sdk",
        "@hypercerts-org/sdk",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-popover",
        "@radix-ui/react-select",
        "@react-spring/web",
        "@reown/appkit-adapter-wagmi",
        "@reown/appkit/react",
        "@storacha/client",
        "@storacha/client/principal/ed25519",
        "@storacha/client/proof",
        "@use-gesture/react",
        "@wagmi/core",
        "@xstate/react",
        "browser-image-compression",
        "clsx",
        "ethers",
        "gql.tada",
        "graphql-request",
        // heic-to lives only under shared's node_modules (bun isolated
        // linker), so it needs the linked-package `>` resolution form.
        "@green-goods/shared > heic-to/csp",
        "idb",
        "idb-keyval",
        "permissionless",
        "permissionless/accounts",
        "permissionless/clients/passkeyServer",
        "permissionless/clients/pimlico",
        "react-day-picker",
        "react-hot-toast",
        "react-select",
        "tailwind-merge",
        "tailwind-variants",
        "viem/account-abstraction",
        "viem/chains",
        "xstate",
        "zustand",
        "zustand/middleware",
        "zustand/react/shallow",
      ],
      // Exclude local packages and ESM-only packages
      exclude: ["@green-goods/shared"],
    },
    server: {
      port: 3001,
      strictPort: true,
      host: true,
      open: false,
      // cloudflared quick tunnels change hostname each run; allow remote Host headers in dev.
      allowedHosts: tunnelHmr ? true : undefined,
      hmr: tunnelHmr ? { overlay: true, ...tunnelHmr } : { overlay: true },
      // Polling is only required on Docker bind mounts and some network filesystems.
      // On macOS native FSEvents the default watcher is much cheaper than polling
      // every 100ms across hundreds of files. Opt in with VITE_USE_POLLING=true.
      watch: {
        ignored: ["**/dev-dist/**"],
        ...(process.env.VITE_USE_POLLING === "true" ? { usePolling: true, interval: 100 } : {}),
      },
      proxy: {
        "/api/graphql": {
          target: indexerProxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/graphql/, ""),
        },
      },
    },
  };
});
