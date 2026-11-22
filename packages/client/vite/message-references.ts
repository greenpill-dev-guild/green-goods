import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * A message id written in source: a quoted dotted id, or the quoted start of one a template
 * literal finishes (`"app.garden.${tab}"` names every id under `app.garden.`).
 */
const MESSAGE_REFERENCE = /["'`]([A-Za-z][\w-]*\.[\w.-]*)(?:["'`]|(?=\$\{))/g;

export interface MessageReferences {
  /** Every id, and every id prefix, the source names. */
  ids: Set<string>;
  /** The source files read, for a build that watches them. */
  files: string[];
}

/** The message ids that runtime source under these files and folders names. */
export async function readMessageReferences(roots: readonly string[]): Promise<MessageReferences> {
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
  for (const root of roots) await visit(root);
  return { ids, files };
}

/** Whether the source names this message id, or a prefix of it that a template finishes. */
export function isReferencedMessage(key: string, ids: ReadonlySet<string>): boolean {
  const parts = key.split(".");
  return parts.some((_, index) => {
    const prefix = parts.slice(0, index + 1).join(".");
    return ids.has(prefix) || ids.has(`${prefix}.`);
  });
}
