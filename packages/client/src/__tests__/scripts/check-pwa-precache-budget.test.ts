import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

interface FixtureOptions {
  html?: string;
  precache?: string[];
  publicModules?: string[];
  /** Modules in the installed app's entry chunk, which every startup closure holds. */
  pwaModules?: string[];
  /** Modules in a chunk the website's frame imports, as a barrel under it would pull them in. */
  publicShellImports?: string[];
  /** Leave the website's frame out of the build, as a moved or renamed file would. */
  withoutPublicShell?: boolean;
  /** Modules in a chunk both reporting pages import. */
  reportingImports?: string[];
  /** Leave the reporting pages out of the build, as a moved or renamed file would. */
  withoutReportingPages?: boolean;
  /** Modules in a chunk the session gate imports, which every installed start loads. */
  sessionGateImports?: string[];
  /** Leave one installed startup module out of the build, as a moved or renamed file would. */
  withoutStartupModule?: string;
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
const PUBLIC_SHELL_CHUNK = "assets/chunk-pS7hLw2N.js";
const PUBLIC_SHELL_IMPORT = "assets/chunk-c4Rd8BqM.js";
const REPORTING_PAGE_CHUNKS = {
  "src/views/Public/AgentReporting/index.tsx": "assets/chunk-rP3kTq8W.js",
  "src/views/Public/AgentReporting/PermissionsPage.tsx": "assets/chunk-mW5nJx2C.js",
};
const REPORTING_PAGE_IMPORT = "assets/chunk-Lq9vZ4Hd.js";
// The installed app's startup path, each module a lazy route of its own as in real builds.
const STARTUP_MODULE_CHUNKS = {
  "src/routes/PwaRuntime.tsx": "assets/chunk-Rt4mPw8Q.js",
  "src/routes/WalletRuntimeProviders.tsx": "assets/chunk-Wv2kLp9S.js",
  "src/routes/SessionGate.tsx": "assets/chunk-Gs6nTq3X.js",
  "src/routes/AppShell.tsx": "assets/chunk-As8vKb1M.js",
  "src/views/Home/index.tsx": "assets/chunk-Hm5cRz7D.js",
  "src/views/Login/index.tsx": "assets/chunk-Lg3wNf6P.js",
};
const SESSION_GATE_IMPORT = "assets/chunk-Sg9xDt2V.js";

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
        modules: options.pwaModules ?? ["packages/client/src/bootstrapPwa.tsx"],
      },
    };

  if (!options.withoutPublicShell) {
    manifest["src/routes/PublicShell.tsx"] = {
      file: PUBLIC_SHELL_CHUNK,
      isDynamicEntry: true,
      src: "src/routes/PublicShell.tsx",
    };
    chunks[PUBLIC_SHELL_CHUNK] = {
      imports: options.publicShellImports ? [PUBLIC_SHELL_IMPORT] : [],
      dynamicImports: [],
      modules: ["packages/client/src/routes/PublicShell.tsx"],
    };
    writeFileSync(resolve(directory, PUBLIC_SHELL_CHUNK), "export const frame = true");
    if (options.publicShellImports) {
      chunks[PUBLIC_SHELL_IMPORT] = {
        imports: [],
        dynamicImports: [],
        modules: options.publicShellImports,
      };
      writeFileSync(resolve(directory, PUBLIC_SHELL_IMPORT), "export const cards = true");
    }
  }

  if (!options.withoutReportingPages) {
    for (const [source, file] of Object.entries(REPORTING_PAGE_CHUNKS)) {
      manifest[source] = { file, isDynamicEntry: true, src: source };
      chunks[file] = {
        imports: options.reportingImports ? [REPORTING_PAGE_IMPORT] : [],
        dynamicImports: [],
        modules: [`packages/client/${source}`],
      };
      writeFileSync(resolve(directory, file), "export const page = true");
    }
    if (options.reportingImports) {
      chunks[REPORTING_PAGE_IMPORT] = {
        imports: [],
        dynamicImports: [],
        modules: options.reportingImports,
      };
      writeFileSync(resolve(directory, REPORTING_PAGE_IMPORT), "export const shared = true");
    }
  }

  for (const [source, file] of Object.entries(STARTUP_MODULE_CHUNKS)) {
    if (source === options.withoutStartupModule) continue;
    const gateImports = source === "src/routes/SessionGate.tsx" && options.sessionGateImports;
    manifest[source] = { file, isDynamicEntry: true, src: source };
    chunks[file] = {
      imports: gateImports ? [SESSION_GATE_IMPORT] : [],
      dynamicImports: [],
      modules: [`packages/client/${source}`],
    };
    writeFileSync(resolve(directory, file), "export const startup = true");
    if (gateImports) {
      chunks[SESSION_GATE_IMPORT] = { imports: [], dynamicImports: [], modules: gateImports };
      writeFileSync(resolve(directory, SESSION_GATE_IMPORT), "export const gate = true");
    }
  }

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
    ["installed entry gzip", {}, { PWA_INSTALLED_ENTRY_GZIP_MAX: "1" }],
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

  // The frame is a lazy route, outside the entry's closure, and every public page waits for it.
  it("fails a build whose website frame imports sign-in code", () => {
    const output = runFailure(
      createFixture({ publicShellImports: ["packages/shared/src/hooks/auth/useAuth.ts"] }),
      {}
    );
    expect(output).toContain("forbidden public dependencies under the website frame");
    expect(output).toContain("packages/shared/src/hooks/auth/useAuth.ts");
  });

  it("fails a build that has no website frame left to check", () => {
    const output = runFailure(createFixture({ withoutPublicShell: true }), {});
    expect(output).toContain("The website frame (src/routes/PublicShell.tsx) is missing");
  });

  // A reporting page needs sign-in and the wallet kit, so it answers to a shorter list.
  it("fails a reporting page that reaches the work queue or a work card, not sign-in", () => {
    const output = runFailure(
      createFixture({
        reportingImports: [
          "packages/shared/src/hooks/auth/useAuth.ts",
          "packages/shared/src/providers/AppKitProvider.tsx",
          "packages/shared/src/providers/JobQueue.tsx",
          "packages/client/src/components/Cards/Work/DraftCard.tsx",
        ],
      }),
      {}
    );
    expect(output).toContain(
      "forbidden dependencies under the reporting page (src/views/Public/AgentReporting/index.tsx)"
    );
    expect(output).toContain("packages/shared/src/providers/JobQueue.tsx");
    expect(output).toContain("packages/client/src/components/Cards/Work/DraftCard.tsx");
    expect(output).not.toContain("useAuth.ts");
    expect(output).not.toContain("AppKitProvider.tsx");
  });

  const voucherAndPoolingModules = [
    "packages/shared/src/modules/commitment-pooling/service-access-chain.ts",
    "packages/shared/src/modules/commitment-pooling/display-groups.ts",
  ];
  it.each([
    [
      "its entry",
      { pwaModules: ["packages/client/src/bootstrapPwa.tsx", ...voucherAndPoolingModules] },
    ],
    // The gate is a lazy route every installed start passes through, signed in or out.
    ["the session gate", { sessionGateImports: voucherAndPoolingModules }],
  ])("fails a build whose installed startup reaches voucher code through %s", (_, options) => {
    const output = runFailure(createFixture(options), {});
    expect(output).toContain("voucher code in the installed startup bundle");
    expect(output).toContain("service-access-chain.ts");
    expect(output).not.toContain("display-groups.ts");
  });

  it("fails a build whose installed startup path has a module missing", () => {
    const output = runFailure(
      createFixture({ withoutStartupModule: "src/routes/SessionGate.tsx" }),
      {}
    );
    expect(output).toContain(
      "The installed app's startup module (src/routes/SessionGate.tsx) is missing"
    );
  });

  it("fails a build that has no reporting page left to check", () => {
    const output = runFailure(createFixture({ withoutReportingPages: true }), {});
    expect(output).toContain(
      "The reporting page (src/views/Public/AgentReporting/index.tsx) is missing"
    );
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
