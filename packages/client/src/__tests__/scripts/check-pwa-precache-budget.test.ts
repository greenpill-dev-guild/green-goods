import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  /** Shared chunks nothing imports, added only for the file-name rule. */
  lazyChunks?: { file: string; name?: string }[];
}

// Real builds name every lazy chunk `assets/chunk-<hash>.js`.
const PUBLIC_CHUNK = "assets/chunk-X4mQ9aTe.js";
const PWA_CHUNK = "assets/chunk-Hn2Rw7Kd.js";
const ROUTE_CHUNK = "assets/chunk-bV6sE1yZ.js";

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
      file: PUBLIC_CHUNK,
      isDynamicEntry: true,
      src: "src/bootstrapPublic.tsx",
    },
    "src/bootstrapPwa.tsx": {
      file: PWA_CHUNK,
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
      [PUBLIC_CHUNK]: {
        imports: [],
        dynamicImports: [],
        modules: options.publicModules ?? ["packages/client/src/bootstrapPublic.tsx"],
      },
      [PWA_CHUNK]: {
        imports: [],
        dynamicImports: [],
        modules: ["packages/client/src/bootstrapPwa.tsx"],
      },
    };

  if (options.route) {
    manifest[options.route.source] = {
      file: ROUTE_CHUNK,
      isDynamicEntry: true,
      src: options.route.source,
    };
    chunks[ROUTE_CHUNK] = {
      imports: [],
      dynamicImports: [],
      modules: [`packages/client/${options.route.source}`],
    };
    writeFileSync(resolve(directory, ROUTE_CHUNK), options.route.contents);
  }

  for (const chunk of options.lazyChunks ?? []) {
    manifest[`_${chunk.file.slice("assets/".length)}`] = { ...chunk };
  }

  const files = {
    "assets/main.js": "export const main = true",
    [PUBLIC_CHUNK]: "export const publicApp = true",
    [PWA_CHUNK]: "export const pwa = true",
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
    // The shape Workbox injects: each entry pairs a revision with its url.
    `precacheAndRoute([${precache
      .map((url) => `{"revision":null,"url":${JSON.stringify(url)}}`)
      .join(",")}])`
  );
  writeFileSync(resolve(directory, ".vite/manifest.json"), JSON.stringify(manifest));
  writeFileSync(
    resolve(directory, ".vite/pwa-build-graph.json"),
    JSON.stringify({ version: 1, chunks })
  );
  writeFileSync(
    resolve(directory, "pwa-shell-assets.json"),
    JSON.stringify({
      version: 3,
      digest: "fixture",
      assets: options.shellAssets ?? ["/index.html"],
      criticalAssets: options.shellAssets ?? ["/index.html"],
      priorityAssets: [],
      tailAssets: [],
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

  it("passes a build whose lazy chunks carry opaque names", () => {
    const fixture = createFixture({
      lazyChunks: [
        { file: "assets/chunk-Q7fZ2kLp.js", name: "analytics-events" },
        // Rolldown appends a numeric suffix to some hash-only names.
        { file: "assets/chunk-0Z0fNygk2.js", name: "CampaignJarSurface" },
        // A random hash can spell a short name; those are not checked.
        { file: "assets/chunk-CfAB5leN2.js", name: "en" },
      ],
    });
    expect(runFailure(fixture, {})).toBe("");
  });

  // EasyPrivacy's `/analytics-events-` rule blocks the first two names under Brave's
  // Aggressive blocking and uBlock Origin, failing every lazy route that imports auth.
  it.each([
    { file: "assets/analytics-events-OnL9QVlN.js", name: "analytics-events" },
    { file: "assets/chunk-analytics-events-OnL9QVlN.js", name: "analytics-events" },
    { file: "assets/chunk-public01.js", name: "public" },
  ])("fails a lazy chunk whose file name carries its name: $file", (chunk) => {
    const output = runFailure(createFixture({ lazyChunks: [chunk] }), {});
    expect(output).toContain("lazy chunk file names must be opaque");
    expect(output).toContain(chunk.file);
  });
});
