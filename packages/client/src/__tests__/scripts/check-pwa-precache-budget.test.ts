import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

interface FixtureOptions {
  html?: string;
  precache?: string[];
  publicModules?: string[];
  route?: { source: string; contents: string };
  shellAssets?: string[];
  files?: Record<string, string>;
}

const fixtureDirectories: string[] = [];
const checkerPath = resolve(process.cwd(), "scripts/check-pwa-precache-budget.mjs");
const relaxedLimits = {
  PWA_PRECACHE_MAX_BYTES: "1000000000",
  PWA_PRECACHE_MAX_ENTRIES: "1000",
  PWA_PUBLIC_STARTUP_GZIP_MAX: "1000000000",
  PWA_INSTALLED_STARTUP_GZIP_MAX: "1000000000",
  PWA_MODULE_PRELOAD_MAX: "1000",
  PWA_MAJOR_ROUTE_GZIP_MAX: "1000000000",
  PWA_MEDIA_ROUTE_GZIP_MAX: "1000000000",
  PWA_SHELL_RAW_MAX: "1000000000",
  PWA_SHELL_GZIP_MAX: "1000000000",
};

function createFixture(options: FixtureOptions = {}) {
  const directory = mkdtempSync(resolve(tmpdir(), "gg-pwa-budget-"));
  fixtureDirectories.push(directory);
  mkdirSync(resolve(directory, ".vite"), { recursive: true });
  mkdirSync(resolve(directory, "assets"), { recursive: true });

  const precache = options.precache ?? ["index.html"];
  const manifest: Record<string, Record<string, unknown>> = {
    "src/main.tsx": { file: "assets/main.js", isEntry: true, src: "src/main.tsx" },
    "src/bootstrapPublic.tsx": {
      file: "assets/public.js",
      isDynamicEntry: true,
      src: "src/bootstrapPublic.tsx",
    },
    "src/bootstrapPwa.tsx": {
      file: "assets/pwa.js",
      isDynamicEntry: true,
      src: "src/bootstrapPwa.tsx",
    },
  };
  const chunks: Record<string, { imports: string[]; dynamicImports: string[]; modules: string[] }> =
    {
      "assets/main.js": {
        imports: [],
        dynamicImports: [],
        modules: ["packages/client/src/main.tsx"],
      },
      "assets/public.js": {
        imports: [],
        dynamicImports: [],
        modules: options.publicModules ?? ["packages/client/src/bootstrapPublic.tsx"],
      },
      "assets/pwa.js": {
        imports: [],
        dynamicImports: [],
        modules: ["packages/client/src/bootstrapPwa.tsx"],
      },
    };

  if (options.route) {
    manifest[options.route.source] = {
      file: "assets/route.js",
      isDynamicEntry: true,
      src: options.route.source,
    };
    chunks["assets/route.js"] = {
      imports: [],
      dynamicImports: [],
      modules: [`packages/client/${options.route.source}`],
    };
    writeFileSync(resolve(directory, "assets/route.js"), options.route.contents);
  }

  const files = {
    "assets/main.js": "export const main = true",
    "assets/public.js": "export const publicApp = true",
    "assets/pwa.js": "export const pwa = true",
    ...options.files,
  };
  for (const [file, contents] of Object.entries(files)) {
    const path = resolve(directory, file);
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeFileSync(path, contents);
  }
  writeFileSync(resolve(directory, "index.html"), options.html ?? "<!doctype html>");
  writeFileSync(
    resolve(directory, "sw.js"),
    `precacheAndRoute([${precache.map((url) => `{url:${JSON.stringify(url)}}`).join(",")}])`
  );
  writeFileSync(resolve(directory, ".vite/manifest.json"), JSON.stringify(manifest));
  writeFileSync(
    resolve(directory, ".vite/pwa-build-graph.json"),
    JSON.stringify({ version: 1, chunks })
  );
  writeFileSync(
    resolve(directory, "pwa-shell-assets.json"),
    JSON.stringify({
      version: 1,
      digest: "fixture",
      assets: options.shellAssets ?? ["/index.html"],
    })
  );
  return directory;
}

function runFailure(fixture: string, limits: Record<string, string>) {
  try {
    execFileSync("node", [checkerPath], {
      encoding: "utf8",
      env: { ...process.env, ...relaxedLimits, ...limits, PWA_DIST_DIR: fixture },
      stdio: "pipe",
    });
    return "";
  } catch (error) {
    const result = error as { stderr?: string; stdout?: string };
    return `${result.stderr ?? ""}${result.stdout ?? ""}`;
  }
}

afterEach(() => {
  for (const directory of fixtureDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("PWA build budgets", () => {
  it.each([
    [
      "precache entry count",
      { precache: ["index.html", "assets/main.js"] },
      { PWA_PRECACHE_MAX_ENTRIES: "1" },
    ],
    ["precache raw", { precache: ["index.html"] }, { PWA_PRECACHE_MAX_BYTES: "1" }],
    ["public startup gzip", {}, { PWA_PUBLIC_STARTUP_GZIP_MAX: "1" }],
    ["installed startup gzip", {}, { PWA_INSTALLED_STARTUP_GZIP_MAX: "1" }],
    [
      "HTML module preloads",
      { html: '<link rel="modulepreload" href="/assets/main.js">' },
      { PWA_MODULE_PRELOAD_MAX: "0" },
    ],
    [
      "route budgets exceeded",
      { route: { source: "src/views/Public/Home.tsx", contents: "export const route = true" } },
      { PWA_MAJOR_ROUTE_GZIP_MAX: "1" },
    ],
    [
      "route budgets exceeded",
      {
        route: { source: "src/views/Home/Garden/Proof.tsx", contents: "export const proof = true" },
      },
      { PWA_MEDIA_ROUTE_GZIP_MAX: "1" },
    ],
    ["offline shell raw", {}, { PWA_SHELL_RAW_MAX: "1" }],
    ["offline shell gzip", {}, { PWA_SHELL_GZIP_MAX: "1" }],
    [
      "forbidden public dependencies",
      { publicModules: ["packages/shared/src/modules/auth/session.ts"] },
      {},
    ],
  ])("fails the %s ceiling", (message, fixtureOptions, limits) => {
    const output = runFailure(createFixture(fixtureOptions as FixtureOptions), limits);
    expect(output).toContain(message);
  });
});
