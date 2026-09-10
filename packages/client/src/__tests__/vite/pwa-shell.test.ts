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
      "views/Home/WalletDrawer/index",
      "views/Home/CommitmentsDrawer/index",
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
