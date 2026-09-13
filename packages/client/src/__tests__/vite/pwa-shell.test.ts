import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createPwaShellAssetsPlugin, createPwaShellDigest } from "../../../vite/pwa-shell";

interface EmittedAsset {
  fileName: string;
  source: string;
  type: "asset";
}

function createShellBundle({
  indexHtml = '<div id="root"></div>',
  pwaCode = "export const bootstrap = true",
}: {
  indexHtml?: string;
  pwaCode?: string;
} = {}): Record<string, unknown> {
  return {
    "assets/pwa.js": {
      type: "chunk",
      fileName: "assets/pwa.js",
      code: pwaCode,
      imports: ["assets/react.js"],
      dynamicImports: ["assets/lazy-proof.js"],
      modules: { "/repo/packages/client/src/bootstrapPwa.tsx": {} },
      viteMetadata: { importedCss: new Set(["assets/app.css"]) },
    },
    "assets/react.js": {
      type: "chunk",
      fileName: "assets/react.js",
      code: "export const react = true",
      imports: [],
      dynamicImports: [],
      modules: { "/repo/node_modules/react/index.js": {} },
    },
    "assets/lazy-proof.js": {
      type: "chunk",
      fileName: "assets/lazy-proof.js",
      code: "export const proof = true",
      imports: [],
      dynamicImports: [],
      modules: { "/repo/packages/client/src/views/Home/Garden/Proof.tsx": {} },
    },
    "assets/standalone.css": {
      type: "asset",
      fileName: "assets/standalone.css",
      source: "body{}",
    },
    "assets/app.css": {
      type: "asset",
      fileName: "assets/app.css",
      source: ":root{color:green}",
    },
    "index.html": {
      type: "asset",
      fileName: "index.html",
      source: indexHtml,
    },
  };
}

function generateShellManifest({
  indexHtml = '<div id="root"></div>',
  pwaCode = "export const bootstrap = true",
}: {
  indexHtml?: string;
  pwaCode?: string;
} = {}) {
  const emitFile = vi.fn();
  const plugin = createPwaShellAssetsPlugin();
  const generateBundle = plugin.generateBundle;
  if (typeof generateBundle !== "function") throw new Error("generateBundle hook missing");

  const bundle = createShellBundle({ indexHtml, pwaCode });
  generateBundle.call({ emitFile } as never, {} as never, bundle as never, false);

  return emitFile.mock.calls.map(([asset]) => asset as EmittedAsset);
}

describe("PWA shell asset manifest", () => {
  it("caches route facades, drawers, and wizard dependencies without public or wallet-only chunks", async () => {
    const emitFile = vi.fn();
    const plugin = createPwaShellAssetsPlugin();
    const generateBundle = plugin.generateBundle;
    if (typeof generateBundle !== "function") throw new Error("generateBundle hook missing");

    const bundle = createShellBundle();
    // Use the actual lazy entry inventory so adding a signed-in route cannot
    // silently leave it outside the first-install shell.
    const routes = await readFile(new URL("../../config/routes.tsx", import.meta.url), "utf8");
    const viewPaths = [...routes.matchAll(/import\("@\/(views\/[^"\n]+)"\)/g)].map(
      (match) => match[1]
    );
    const signedInViews = viewPaths.filter((path) => !path.startsWith("views/Public/"));
    const lazyModules = [
      ...viewPaths,
      "views/Home/GardenFilters/index",
      "views/Home/WalletSheet/index",
      "views/Home/CommitmentsSheet/index",
      "views/Garden/Media",
      "routes/Root",
      "routes/SessionGate",
      "routes/WalletRuntimeProviders",
    ];
    for (const moduleId of lazyModules) {
      const fileName = `assets/${moduleId.replaceAll("/", "-")}.js`;
      bundle[fileName] = {
        type: "chunk",
        fileName,
        code: "export default true",
        imports: ["assets/react.js"],
        dynamicImports: ["assets/wallet-connect.js"],
        modules: {},
        facadeModuleId: `/repo/packages/client/src/${moduleId}${moduleId.startsWith("views/") && moduleId.split("/").length === 2 ? "/index" : ""}.tsx`,
      };
    }
    bundle["assets/wallet-connect.js"] = {
      type: "chunk",
      fileName: "assets/wallet-connect.js",
      code: "export default true",
      imports: [],
      dynamicImports: [],
      modules: { "/repo/node_modules/wallet/connect.js": {} },
    };
    generateBundle.call({ emitFile } as never, {} as never, bundle as never, false);
    const shell = JSON.parse(
      (
        emitFile.mock.calls.find(
          ([asset]) => asset.fileName === "pwa-shell-assets.json"
        )?.[0] as EmittedAsset
      ).source
    ) as { assets: string[] };

    expect(signedInViews.length).toBeGreaterThan(0);
    for (const moduleId of lazyModules) {
      const asset = `/assets/${moduleId.replaceAll("/", "-")}.js`;
      if (moduleId.startsWith("views/Public/")) expect(shell.assets).not.toContain(asset);
      else expect(shell.assets).toContain(asset);
    }
    expect(shell.assets).toContain("/assets/react.js");
    expect(shell.assets).not.toContain("/assets/wallet-connect.js");
  });

  it("precaches the media step's on-demand image compressor with its facade", () => {
    const emitFile = vi.fn();
    const plugin = createPwaShellAssetsPlugin();
    const generateBundle = plugin.generateBundle;
    if (typeof generateBundle !== "function") throw new Error("generateBundle hook missing");

    const bundle = createShellBundle();
    bundle["assets/Garden.js"] = {
      type: "chunk",
      fileName: "assets/Garden.js",
      code: "export default true",
      imports: ["assets/react.js"],
      // Rolldown emits the dynamic entry as an empty facade over the code chunk.
      dynamicImports: ["assets/image-compression.js", "assets/wallet-connect.js"],
      modules: { "/repo/packages/client/src/views/Garden/Media.tsx": {} },
      facadeModuleId: "/repo/packages/client/src/views/Garden/index.tsx",
    };
    bundle["assets/image-compression.js"] = {
      type: "chunk",
      fileName: "assets/image-compression.js",
      code: "export * from './image-compression-impl.js'",
      imports: ["assets/image-compression-impl.js"],
      dynamicImports: [],
      modules: {},
      facadeModuleId: "/repo/packages/shared/src/utils/work/image-compression.ts",
    };
    bundle["assets/image-compression-impl.js"] = {
      type: "chunk",
      fileName: "assets/image-compression-impl.js",
      code: "export const imageCompressor = true",
      imports: [],
      dynamicImports: [],
      modules: {
        "/repo/node_modules/browser-image-compression/dist/browser-image-compression.mjs": {},
        "/repo/packages/shared/src/utils/work/image-compression.ts": {},
      },
    };
    bundle["assets/wallet-connect.js"] = {
      type: "chunk",
      fileName: "assets/wallet-connect.js",
      code: "export default true",
      imports: [],
      dynamicImports: [],
      modules: { "/repo/node_modules/wallet/connect.js": {} },
    };
    generateBundle.call({ emitFile } as never, {} as never, bundle as never, false);
    const shell = JSON.parse(
      (
        emitFile.mock.calls.find(
          ([asset]) => asset.fileName === "pwa-shell-assets.json"
        )?.[0] as EmittedAsset
      ).source
    ) as { assets: string[] };

    expect(shell.assets).toContain("/assets/Garden.js");
    expect(shell.assets).toContain("/assets/image-compression.js");
    expect(shell.assets).toContain("/assets/image-compression-impl.js");
    expect(shell.assets).not.toContain("/assets/wallet-connect.js");
  });

  it("follows first-party and offline vendor dynamic imports but leaves public and telemetry entries lazy", () => {
    const emitFile = vi.fn();
    const plugin = createPwaShellAssetsPlugin();
    const generateBundle = plugin.generateBundle;
    if (typeof generateBundle !== "function") throw new Error("generateBundle hook missing");

    const bundle = createShellBundle();
    const chunk = (
      fileName: string,
      modules: string[],
      extra: Partial<{ imports: string[]; dynamicImports: string[]; facadeModuleId: string }> = {}
    ) => {
      bundle[fileName] = {
        type: "chunk",
        fileName,
        code: `export default "${fileName}"`,
        imports: extra.imports ?? [],
        dynamicImports: extra.dynamicImports ?? [],
        modules: Object.fromEntries(modules.map((moduleId) => [moduleId, {}])),
        ...(extra.facadeModuleId ? { facadeModuleId: extra.facadeModuleId } : {}),
      };
    };
    (bundle["assets/pwa.js"] as { dynamicImports: string[] }).dynamicImports.push(
      "assets/job-queue.js",
      "assets/es.js",
      "assets/sentry.js",
      "assets/Impact.js",
      "assets/wallet-ui.js",
      "assets/wallet-submission.js",
      "assets/heic-to.js"
    );
    // The queue barrel is an empty facade over code that a second facade,
    // reached only through it, still has to bring along.
    chunk("assets/job-queue.js", [], {
      facadeModuleId: "/repo/packages/shared/src/modules/job-queue/index.ts",
      dynamicImports: ["assets/work-submission.js"],
    });
    chunk("assets/work-submission.js", [], {
      facadeModuleId: "/repo/packages/shared/src/modules/work/work-submission.ts",
      imports: ["assets/work-submission-impl.js"],
    });
    chunk("assets/work-submission-impl.js", [
      "/repo/packages/shared/src/modules/work/work-submission.ts",
    ]);
    chunk("assets/es.js", ["/repo/packages/shared/src/i18n/es.json"]);
    chunk("assets/sentry.js", ["/repo/packages/shared/src/modules/app/sentry.ts"], {
      imports: ["assets/sentry-vendor.js"],
    });
    chunk("assets/sentry-vendor.js", ["/repo/node_modules/@sentry/browser/index.js"]);
    chunk("assets/Impact.js", [
      "/repo/packages/client/src/components/Public/PublicCommitmentsBand.tsx",
      "/repo/packages/client/src/views/Public/Impact.tsx",
    ]);
    chunk("assets/wallet-ui.js", ["/repo/node_modules/@reown/appkit/dist/modal.js"]);
    // HEIC decoding is vendor-only code the media step needs offline.
    chunk("assets/heic-to.js", ["/repo/node_modules/heic-to/dist/csp/heic-to.js"]);
    // Send-time code is first-party too, so the shell carries it and the EAS
    // SDK behind it: a reconnect send must not depend on fetching a chunk.
    chunk("assets/wallet-submission.js", [], {
      facadeModuleId: "/repo/packages/shared/src/modules/work/wallet-submission/index.ts",
      imports: ["assets/encoders.js"],
    });
    chunk("assets/encoders.js", [
      "/repo/node_modules/@ethereum-attestation-service/eas-sdk/dist/index.js",
      "/repo/packages/shared/src/utils/eas/encoders.ts",
    ]);
    generateBundle.call({ emitFile } as never, {} as never, bundle as never, false);
    const shell = JSON.parse(
      (
        emitFile.mock.calls.find(
          ([asset]) => asset.fileName === "pwa-shell-assets.json"
        )?.[0] as EmittedAsset
      ).source
    ) as { assets: string[] };

    for (const needed of [
      "/assets/job-queue.js",
      "/assets/work-submission.js",
      "/assets/work-submission-impl.js",
      "/assets/wallet-submission.js",
      "/assets/encoders.js",
      "/assets/es.js",
      "/assets/heic-to.js",
    ]) {
      expect(shell.assets).toContain(needed);
    }
    for (const optional of [
      "/assets/sentry.js",
      "/assets/sentry-vendor.js",
      "/assets/Impact.js",
      "/assets/wallet-ui.js",
    ]) {
      expect(shell.assets).not.toContain(optional);
    }
  });

  it("includes signed-in lazy views before their first visit", () => {
    const emitted = generateShellManifest();
    const shell = JSON.parse(
      emitted.find((asset) => asset.fileName === "pwa-shell-assets.json")?.source ?? "{}"
    ) as { version: number; digest: string; assets: string[] };

    expect(shell.version).toBe(1);
    expect(shell.digest).toMatch(/^[a-f0-9]{16}$/);
    expect(shell.assets).toEqual([
      "/assets/app.css",
      "/assets/lazy-proof.js",
      "/assets/pwa.js",
      "/assets/react.js",
      "/assets/standalone.css",
      "/index.html",
    ]);
  });

  it("emits the same digest for the same shell graph", () => {
    const readDigest = () => {
      const asset = generateShellManifest().find(
        (candidate) => candidate.fileName === "pwa-shell-assets.json"
      );
      return (JSON.parse(asset?.source ?? "{}") as { digest?: string }).digest;
    };

    expect(readDigest()).toBe(readDigest());
  });

  it("changes the digest when shell contents change without changing filenames", () => {
    const readDigest = (options: Parameters<typeof generateShellManifest>[0]) => {
      const asset = generateShellManifest(options).find(
        (candidate) => candidate.fileName === "pwa-shell-assets.json"
      );
      return (JSON.parse(asset?.source ?? "{}") as { digest?: string }).digest;
    };

    const original = readDigest({});
    expect(readDigest({ pwaCode: "export const bootstrap = false" })).not.toBe(original);
    expect(readDigest({ indexHtml: '<main id="root"></main>' })).not.toBe(original);
    expect(createPwaShellDigest(["/index.html"], new Map([["/index.html", "release-b"]]))).not.toBe(
      createPwaShellDigest(["/index.html"], new Map([["/index.html", "release-a"]]))
    );
  });

  it("rewrites the manifest digest from the final files written to disk", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gg-pwa-shell-"));
    try {
      const emitFile = vi.fn();
      const plugin = createPwaShellAssetsPlugin();
      const generateBundle = plugin.generateBundle;
      const writeBundle = plugin.writeBundle;
      const writeBundleHandler =
        typeof writeBundle === "function" ? writeBundle : writeBundle?.handler;
      if (typeof generateBundle !== "function") throw new Error("generateBundle hook missing");
      if (typeof writeBundleHandler !== "function") throw new Error("writeBundle hook missing");

      const bundle = createShellBundle();
      delete bundle["index.html"];
      generateBundle.call({ emitFile } as never, {} as never, bundle as never, false);
      const provisionalManifest = JSON.parse(
        (
          emitFile.mock.calls.find(
            ([asset]) => (asset as EmittedAsset).fileName === "pwa-shell-assets.json"
          )?.[0] as EmittedAsset | undefined
        )?.source ?? "{}"
      ) as { digest?: string };

      const finalFiles = new Map<string, string>([
        ["/assets/app.css", ":root{color:green}"],
        ["/assets/lazy-proof.js", "export const proof = true"],
        ["/assets/pwa.js", "export const bootstrap = true"],
        ["/assets/react.js", "export const react = true"],
        ["/assets/standalone.css", "body{}"],
        ["/index.html", '<main id="root">final</main>'],
      ]);
      await mkdir(join(directory, "assets"), { recursive: true });
      await Promise.all(
        [...finalFiles].map(([asset, contents]) =>
          writeFile(join(directory, asset.replace(/^\/+/, "")), contents)
        )
      );

      await writeBundleHandler.call({} as never, { dir: directory } as never, {} as never);
      const manifest = JSON.parse(
        await readFile(join(directory, "pwa-shell-assets.json"), "utf8")
      ) as { digest: string; assets: string[] };

      expect(manifest.digest).toBe(createPwaShellDigest(manifest.assets, finalFiles));
      expect(manifest.digest).not.toBe(provisionalManifest.digest);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
