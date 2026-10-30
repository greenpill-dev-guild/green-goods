import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const KEYS_PREFIX = "virtual:green-goods-message-keys/";

/** Keep every message while sharing identical key lists across installed-app locales. */
export function createLocaleCataloguesPlugin(): Plugin {
  let catalogues = new Set<string>();
  const keyModules = new Map<string, string>();

  return {
    name: "green-goods-locale-catalogues",
    apply: "build",
    // Replace Vite's JSON output, retaining the source ids used by the offline-shell tiers.
    enforce: "post",
    configResolved(config) {
      catalogues = new Set(
        ["en", "es", "pt"].map((locale) =>
          resolve(config.root, `../shared/src/i18n/${locale}.json`)
        )
      );
    },
    resolveId(id) {
      if (id.startsWith(KEYS_PREFIX)) return `\0${id}`;
    },
    load(id) {
      const keys = keyModules.get(id);
      if (keys !== undefined) return `export default ${keys};`;
    },
    async transform(_code, id) {
      if (!catalogues.has(id)) return;
      const messages: unknown = JSON.parse(await readFile(id, "utf8"));
      if (messages === null || typeof messages !== "object" || Array.isArray(messages))
        this.error(`Expected a message catalogue object: ${id}`);

      // Different key sets or ordering get their own table rather than losing or reordering ids.
      const keys = JSON.stringify(Object.keys(messages));
      const keyId = `${KEYS_PREFIX}${createHash("sha256").update(keys).digest("hex")}`;
      keyModules.set(`\0${keyId}`, keys);
      return {
        code: `import keys from ${JSON.stringify(keyId)};
const values = ${JSON.stringify(Object.values(messages))};
export default Object.fromEntries(keys.map((key, index) => [key, values[index]]));`,
        map: null,
        moduleType: "js",
      };
    },
  };
}
