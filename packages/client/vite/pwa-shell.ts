import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";

const SHELL_MODULE_MARKERS = [
  "/src/main.tsx",
  "/src/bootstrapPwa.tsx",
  "/src/PwaApp.tsx",
  "/src/routes/PwaRuntime.tsx",
  "/src/routes/WalletRuntimeProviders.tsx",
  "/src/routes/Root.tsx",
  "/src/routes/SessionGate.tsx",
  "/src/routes/AppShell.tsx",
  "/src/routes/ENSClaimReminder.tsx",
  "/src/hooks/blockchain/prefetch.ts",
  "/src/i18n/en.json",
] as const;

// Signed-in code also loads modules on demand: the wizard's image compressor
// and HEIC decoder, the submission adapters and attestation encoder behind the
// work command, the queue barrel behind the dashboard's offline reader, and
// the other locales. Rolldown emits each as its own facade or vendor chunk that
// no static closure reaches, so without following them the first offline use
// fails at the import. The installed app is meant to work like a native one,
// so the shell follows every first-party dynamic entry and the vendor chunks
// it needs offline, and leaves lazy only what has no offline value: public
// pages, telemetry, and the wallet connection UI.
const FIRST_PARTY_MODULE = /\/packages\/(client|shared)\/src\//;
const SHELL_OPTIONAL_MODULE =
  /\/src\/(views\/Public|components\/Public|routes\/PublicShell|modules\/app\/sentry|modules\/app\/posthog-browser)\b|\/src\/(PublicApp|bootstrapPublic)\.tsx$/;
const SHELL_TAIL_MODULE =
  /\/packages\/shared\/src\/(?:i18n\/(?:es|pt)\.json|utils\/eas\/encoders\.ts|modules\/work\/(?:simulate\.ts|wallet-submission\/))|\/node_modules\/(?:heic-to|@ethereum-attestation-service\/eas-sdk)\//;
const SHELL_OFFLINE_VENDOR_MODULE =
  /\/node_modules\/(?:heic-to|viem|@noble\/curves|@scure\/base)\//;

// Include nested views too: drawers and wizard steps can be separate lazy
// entries even though the router does not name them. Public pages stay lazy.
const SHELL_VIEW_MODULE = /\/packages\/client\/src\/views\/(Login|Home|Garden|Profile)\//;

interface ChunkWithViteMetadata {
  type: "chunk";
  fileName: string;
  code: string;
  imports: string[];
  dynamicImports: string[];
  facadeModuleId?: string | null;
  modules: Record<string, unknown>;
  viteMetadata?: {
    importedCss?: Set<string>;
  };
}

interface AssetWithSource {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
}

type ShellBundleEntry = ChunkWithViteMetadata | AssetWithSource;

function shellEntryContent(entry: ShellBundleEntry): string | Uint8Array {
  return entry.type === "chunk" ? entry.code : entry.source;
}

export function createPwaShellDigest(
  assets: string[],
  contents: ReadonlyMap<string, string | Uint8Array>
): string {
  const digestInput = assets
    .map((asset) => {
      const content = contents.get(asset);
      if (content === undefined) throw new Error(`PWA shell asset content is unavailable: ${asset}`);
      const contentDigest = createHash("sha256").update(content).digest("hex");
      return `${asset}\0${contentDigest}`;
    })
    .join("\n");
  return createHash("sha256").update(digestInput).digest("hex").slice(0, 16);
}

export interface PwaShellAssetsManifest {
  version: 2;
  digest: string;
  assets: string[];
  criticalDigest: string;
  criticalAssets: string[];
  tailDigest: string;
  tailAssets: string[];
}

export function createPwaShellAssetsPlugin(): Plugin {
  let shellAssets: string[] = [];
  let criticalAssets: string[] = [];
  let tailAssets: string[] = [];

  return {
    name: "green-goods-pwa-shell-assets",
    apply: "build",
    generateBundle(_options, bundle) {
      const entries = Object.values(bundle) as unknown as ShellBundleEntry[];
      const entriesByFile = new Map(entries.map((entry) => [entry.fileName, entry]));
      const chunks = entries.filter(
        (entry) => entry.type === "chunk"
      ) as ChunkWithViteMetadata[];
      const chunksByFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      const criticalFiles = new Set<string>(["index.html"]);
      const tailFiles = new Set<string>();

      // Vite 8's Rolldown output does not currently expose imported CSS on
      // every chunk through `viteMetadata`. CSS is part of the executable
      // shell, so include emitted stylesheets directly as a deterministic
      // fallback (the client currently emits one application stylesheet).
      for (const entry of entries) {
        if (entry.type === "asset" && entry.fileName.endsWith(".css")) {
          criticalFiles.add(entry.fileName);
        }
      }

      const includeChunk = (fileName: string, destination: Set<string>) => {
        if (destination.has(fileName)) return;
        const chunk = chunksByFile.get(fileName);
        if (!chunk) return;

        destination.add(chunk.fileName);
        chunk.viteMetadata?.importedCss?.forEach((css) => destination.add(css));
        chunk.imports.forEach((dependency) => includeChunk(dependency, destination));
      };

      for (const chunk of chunks) {
        // Rolldown can emit an empty facade for a dynamic entry whose code lives
        // in another chunk. Cache that entry URL as well as its static closure.
        const moduleIds = [...Object.keys(chunk.modules), chunk.facadeModuleId ?? ""];
        if (
          moduleIds.some((moduleId) => {
            const cleanId = moduleId.split("?")[0].replaceAll("\\", "/");
            return (
              SHELL_VIEW_MODULE.test(cleanId) ||
              SHELL_MODULE_MARKERS.some((marker) => cleanId.endsWith(marker))
            );
          })
        ) {
          includeChunk(chunk.fileName, criticalFiles);
        }
      }

      const cleanModuleIds = (chunk: ChunkWithViteMetadata) =>
        [...Object.keys(chunk.modules), chunk.facadeModuleId ?? ""].map((moduleId) =>
          moduleId.split("?")[0].replaceAll("\\", "/")
        );
      const isOfflineShellDependency = (chunk: ChunkWithViteMetadata) => {
        const ids = cleanModuleIds(chunk);
        // Rolldown may emit a pure forwarding facade with no module inventory.
        // If an included offline chunk imports it, cache the facade URL; its
        // static closure is classified independently below.
        if (ids.every((id) => !id)) return true;
        if (ids.some((id) => SHELL_OFFLINE_VENDOR_MODULE.test(id))) return true;
        const firstParty = ids.filter((id) => FIRST_PARTY_MODULE.test(id));
        return firstParty.length > 0 && !firstParty.some((id) => SHELL_OPTIONAL_MODULE.test(id));
      };
      const isTailDependency = (chunk: ChunkWithViteMetadata) =>
        cleanModuleIds(chunk).some((id) => SHELL_TAIL_MODULE.test(id));
      let followed = true;
      while (followed) {
        followed = false;
        for (const fileName of [...criticalFiles, ...tailFiles]) {
          for (const target of chunksByFile.get(fileName)?.dynamicImports ?? []) {
            if (criticalFiles.has(target) || tailFiles.has(target)) continue;
            const targetChunk = chunksByFile.get(target);
            if (!targetChunk || !isOfflineShellDependency(targetChunk)) continue;
            includeChunk(target, isTailDependency(targetChunk) ? tailFiles : criticalFiles);
            followed = true;
          }
        }
      }

      // Anything required by the boot and signed-in route closure remains
      // critical even when a deferred feature happens to share the chunk.
      for (const fileName of criticalFiles) tailFiles.delete(fileName);

      criticalAssets = [...criticalFiles].sort().map((file) => `/${file.replace(/^\/+/, "")}`);
      tailAssets = [...tailFiles].sort().map((file) => `/${file.replace(/^\/+/, "")}`);
      const assets = [...criticalAssets, ...tailAssets].sort();
      const contents = new Map<string, string | Uint8Array>();
      for (const asset of assets) {
        const fileName = asset.replace(/^\/+/, "");
        const entry = entriesByFile.get(fileName);
        if (entry) contents.set(asset, shellEntryContent(entry));
        else if (fileName === "index.html") contents.set(asset, "pending-write-bundle");
        else throw new Error(`PWA shell asset content is unavailable: ${asset}`);
      }
      const digest = createPwaShellDigest(assets, contents);
      shellAssets = assets;
      const manifest: PwaShellAssetsManifest = {
        version: 2,
        digest,
        assets,
        criticalDigest: createPwaShellDigest(criticalAssets, contents),
        criticalAssets,
        tailDigest: createPwaShellDigest(tailAssets, contents),
        tailAssets,
      };

      this.emitFile({
        type: "asset",
        fileName: "pwa-shell-assets.json",
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });

      const normalizeModuleId = (moduleId: string) => {
        const clean = moduleId.split("?")[0];
        for (const marker of ["/packages/client/", "/packages/shared/", "/node_modules/"]) {
          const index = clean.lastIndexOf(marker);
          if (index >= 0) return clean.slice(index + 1);
        }
        return clean.startsWith("\0") ? clean : clean.split("/").slice(-3).join("/");
      };
      const graphEntries: Array<[
        string,
        { imports: string[]; dynamicImports: string[]; modules: string[] },
      ]> = chunks
          .map((chunk) => [
            chunk.fileName,
            {
              imports: [...chunk.imports].sort(),
              dynamicImports: [...chunk.dynamicImports].sort(),
              modules: Object.keys(chunk.modules).map(normalizeModuleId).sort(),
            },
          ] as [string, { imports: string[]; dynamicImports: string[]; modules: string[] }])
          .sort(([left], [right]) => left.localeCompare(right));
      const graph = Object.fromEntries(graphEntries);
      this.emitFile({
        type: "asset",
        fileName: ".vite/pwa-build-graph.json",
        source: `${JSON.stringify({ version: 1, chunks: graph }, null, 2)}\n`,
      });
    },
    async writeBundle(options) {
      if (!options.dir || shellAssets.length === 0) return;
      const contents = new Map<string, Uint8Array>();
      await Promise.all(
        shellAssets.map(async (asset) => {
          const fileName = asset.replace(/^\/+/, "");
          contents.set(asset, await readFile(join(options.dir as string, fileName)));
        })
      );
      const manifest: PwaShellAssetsManifest = {
        version: 2,
        digest: createPwaShellDigest(shellAssets, contents),
        assets: shellAssets,
        criticalDigest: createPwaShellDigest(criticalAssets, contents),
        criticalAssets,
        tailDigest: createPwaShellDigest(tailAssets, contents),
        tailAssets,
      };
      await writeFile(
        join(options.dir, "pwa-shell-assets.json"),
        `${JSON.stringify(manifest, null, 2)}\n`
      );
    },
  };
}
