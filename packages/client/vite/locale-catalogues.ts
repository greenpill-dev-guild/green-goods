import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const KEYS_PREFIX = "virtual:green-goods-message-keys/";

/**
 * Copy the installed app can never show. Its routes hold no website page and its offline shell
 * leaves the website's pages out, so their copy would ride in every install for nothing. The
 * website reads its own catalogue (`public-locales.ts`), which keeps these messages.
 *
 * A prefix belongs here only while every reference to it sits in website-only code; the
 * catalogue test fails when one appears anywhere the installed app can reach.
 */
export const WEBSITE_ONLY_MESSAGE_PREFIXES = ["public.passport."] as const;

/**
 * Keep every message the installed app can show, sharing identical key lists across its locales.
 */
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

      const entries = Object.entries(messages).filter(
        ([key]) => !WEBSITE_ONLY_MESSAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
      );
      // Different key sets or ordering get their own table rather than losing or reordering ids.
      const keys = JSON.stringify(entries.map(([key]) => key));
      const keyId = `${KEYS_PREFIX}${createHash("sha256").update(keys).digest("hex")}`;
      keyModules.set(`\0${keyId}`, keys);
      return {
        code: `import keys from ${JSON.stringify(keyId)};
const values = ${JSON.stringify(entries.map(([, value]) => value))};
export default Object.fromEntries(keys.map((key, index) => [key, values[index]]));`,
        map: null,
        moduleType: "js",
      };
    },
  };
}
