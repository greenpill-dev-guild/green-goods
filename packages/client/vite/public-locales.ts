import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

const PUBLIC_LOCALE_ID = /^virtual:green-goods-public-locale\/(en|es|pt)$/;
const RESOLVED_PREFIX = "\0green-goods-public-locale/";
const MESSAGE_REFERENCE = /["'`]([A-Za-z][\w-]*(?:\.[\w.-]*)+)(?:["'`]|(?=\$\{))/g;

/** Public copy and shared UI copy come from the same canonical catalogues.
 * Include all Shared runtime references conservatively: wallet, install and
 * recovery UI can appear on a public route without mounting the installed app. */
export function createPublicLocalesPlugin(): Plugin {
  let clientRoot = "";
  let references: Promise<{ ids: Set<string>; files: string[] }> | undefined;

  const sourceRoots = () => [
    resolve(clientRoot, "../shared/src"),
    join(clientRoot, "src/components"),
    join(clientRoot, "src/views/Public"),
    join(clientRoot, "src/views/Login"),
    join(clientRoot, "src/routes"),
    join(clientRoot, "src/config"),
    join(clientRoot, "src/bootstrapPublic.tsx"),
    join(clientRoot, "src/PublicApp.tsx"),
  ];

  async function readReferences() {
    const ids = new Set<string>();
    const files: string[] = [];
    async function visit(path: string) {
      if (/\.(?:ts|tsx)$/.test(path)) {
        if (/\.(?:test|stories|d)\.tsx?$/.test(path)) return;
        const source = await readFile(path, "utf8");
        files.push(path);
        for (const match of source.matchAll(MESSAGE_REFERENCE)) ids.add(match[1]);
        return;
      }
      for (const entry of await readdir(path, { withFileTypes: true })) {
        if (entry.name.startsWith("__")) continue;
        if (entry.isDirectory() || /\.tsx?$/.test(entry.name)) {
          await visit(join(path, entry.name));
        }
      }
    }
    for (const root of sourceRoots()) await visit(root);
    return { ids, files };
  }

  return {
    name: "green-goods-public-locales",
    configResolved(config) {
      clientRoot = config.root;
    },
    resolveId(id) {
      const match = PUBLIC_LOCALE_ID.exec(id);
      return match ? `${RESOLVED_PREFIX}${match[1]}` : undefined;
    },
    async load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return;
      const locale = id.slice(RESOLVED_PREFIX.length);
      const path = resolve(clientRoot, `../shared/src/i18n/${locale}.json`);
      const catalogue = JSON.parse(await readFile(path, "utf8")) as Record<string, string>;
      const { ids, files } = await (references ??= readReferences());
      this.addWatchFile(path);
      for (const file of files) this.addWatchFile(file);
      const messages = Object.fromEntries(
        Object.entries(catalogue).filter(([key]) => {
          if (key.startsWith("public.")) return true;
          const parts = key.split(".");
          return parts.some((_, index) => {
            const prefix = parts.slice(0, index + 1).join(".");
            return ids.has(prefix) || ids.has(`${prefix}.`);
          });
        })
      );
      return `export default ${JSON.stringify(messages)};`;
    },
    handleHotUpdate(context) {
      if (!sourceRoots().some((root) => context.file === root || context.file.startsWith(`${root}/`))) {
        return;
      }
      references = undefined;
      const catalogues = ["en", "es", "pt"]
        .map((locale) => context.server.moduleGraph.getModuleById(`${RESOLVED_PREFIX}${locale}`))
        .filter((module) => module !== undefined);
      for (const module of catalogues) context.server.moduleGraph.invalidateModule(module);
      return [...context.modules, ...catalogues];
    },
  };
}
