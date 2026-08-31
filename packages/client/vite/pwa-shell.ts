import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";

const SHELL_MODULE_MARKERS = [
  "/src/bootstrapPwa.tsx",
  "/src/PwaApp.tsx",
  "/src/routes/PwaRuntime.tsx",
  "/src/routes/WalletRuntimeProviders.tsx",
  "/src/routes/RequireAuth.tsx",
  "/src/routes/AppShell.tsx",
  "/src/views/Login/index.tsx",
  "/src/views/Home/index.tsx",
  "/src/i18n/en.json",
] as const;

interface ChunkWithViteMetadata {
  type: "chunk";
  fileName: string;
  code: string;
  imports: string[];
  dynamicImports: string[];
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
  version: 1;
  digest: string;
  assets: string[];
}

export function createPwaShellAssetsPlugin(): Plugin {
  let shellAssets: string[] = [];

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
      const shellFiles = new Set<string>(["index.html"]);
      const visited = new Set<string>();

      // Vite 8's Rolldown output does not currently expose imported CSS on
      // every chunk through `viteMetadata`. CSS is part of the executable
      // shell, so include emitted stylesheets directly as a deterministic
      // fallback (the client currently emits one application stylesheet).
      for (const entry of entries) {
        if (entry.type === "asset" && entry.fileName.endsWith(".css")) {
          shellFiles.add(entry.fileName);
        }
      }

      const includeChunk = (fileName: string) => {
        if (visited.has(fileName)) return;
        visited.add(fileName);
        const chunk = chunksByFile.get(fileName);
        if (!chunk) return;

        shellFiles.add(chunk.fileName);
        chunk.viteMetadata?.importedCss?.forEach((css) => shellFiles.add(css));
        chunk.imports.forEach(includeChunk);
      };

      for (const chunk of chunks) {
        const moduleIds = Object.keys(chunk.modules);
        if (
          moduleIds.some((moduleId) =>
            SHELL_MODULE_MARKERS.some((marker) => moduleId.endsWith(marker))
          )
        ) {
          includeChunk(chunk.fileName);
        }
      }

      const assets = [...shellFiles].sort().map((file) => `/${file.replace(/^\/+/, "")}`);
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
      const manifest: PwaShellAssetsManifest = { version: 1, digest, assets };

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
        version: 1,
        digest: createPwaShellDigest(shellAssets, contents),
        assets: shellAssets,
      };
      await writeFile(
        join(options.dir, "pwa-shell-assets.json"),
        `${JSON.stringify(manifest, null, 2)}\n`
      );
    },
  };
}
