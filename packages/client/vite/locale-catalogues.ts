import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import {
  isReferencedMessage,
  type MessageReferences,
  readMessageReferences,
} from "./message-references";

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
 * Copy written for the Hub, which reads the catalogues directly and never through this build.
 * A Hub message stays in the installed app only while client or Shared source names it, as a
 * whole id or as the quoted start of one a template finishes; the rest would ride in every
 * install's offline shell, in every locale, for nothing.
 */
export const HUB_MESSAGE_PREFIXES = ["hub.", "admin."] as const;

const isHubMessage = (key: string) => HUB_MESSAGE_PREFIXES.some((prefix) => key.startsWith(prefix));

/**
 * Keep every message the installed app can show, sharing identical key lists across its locales.
 */
export function createLocaleCataloguesPlugin(): Plugin {
  let catalogues = new Set<string>();
  let sourceRoots: string[] = [];
  let references: Promise<MessageReferences> | undefined;
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
      sourceRoots = [resolve(config.root, "../shared/src"), join(config.root, "src")];
    },
    // Each build reads the source again, so a watched rebuild sees a reference added since.
    buildStart() {
      references = undefined;
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

      const { ids, files } = await (references ??= readMessageReferences(sourceRoots));
      for (const file of files) this.addWatchFile(file);
      const entries = Object.entries(messages).filter(
        ([key]) =>
          !WEBSITE_ONLY_MESSAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
          (!isHubMessage(key) || isReferencedMessage(key, ids))
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
