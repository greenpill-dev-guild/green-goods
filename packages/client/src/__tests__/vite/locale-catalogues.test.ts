import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";
import type { ResolvedConfig } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { createLocaleCataloguesPlugin } from "../../../vite/locale-catalogues";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function configure(root: string) {
  const plugin = createLocaleCataloguesPlugin();
  if (typeof plugin.configResolved !== "function") throw new Error("config hook missing");
  await plugin.configResolved.call({} as never, { root } as ResolvedConfig);
  return plugin;
}

async function emit(plugin: ReturnType<typeof createLocaleCataloguesPlugin>, path: string) {
  if (
    typeof plugin.transform !== "function" ||
    typeof plugin.resolveId !== "function" ||
    typeof plugin.load !== "function"
  )
    throw new Error("catalogue hooks missing");
  const result = await plugin.transform.call({} as never, "", path, { moduleType: "json" });
  if (!result || typeof result === "string" || typeof result.code !== "string")
    throw new Error("catalogue output missing");
  expect(result.moduleType).toBe("js");
  const imported = /^import keys from ("[^"]+");/m.exec(result.code);
  if (!imported) throw new Error("key module import missing");
  const keyId = await plugin.resolveId.call(
    {} as never,
    JSON.parse(imported[1]),
    path,
    {} as never
  );
  if (typeof keyId !== "string") throw new Error("key module id missing");
  const keyCode = await plugin.load.call({} as never, keyId, {});
  if (typeof keyCode !== "string") throw new Error("key module missing");
  const keys: string[] = JSON.parse(keyCode.slice("export default ".length, -1));
  // Execute the emitted reconstruction, supplying its imported table as the bundler does.
  const code = result.code
    .replace(imported[0], "")
    .replace("export default ", "globalThis.messages = ");
  const context: { keys: string[]; messages?: Record<string, string> } = { keys };
  runInNewContext(code, context);
  return { keyId, keyCode, code: result.code, messages: context.messages };
}

describe("locale catalogue bundles", () => {
  it("preserves every canonical message and shares keys to reduce the complete payload", async () => {
    const root = resolve(import.meta.dirname, "../../..");
    const plugin = await configure(root);
    const tables = new Map<string, string>();
    let originalBytes = 0;
    let packedBytes = 0;
    for (const locale of ["en", "es", "pt"]) {
      const path = resolve(root, `../shared/src/i18n/${locale}.json`);
      const messages = JSON.parse(await readFile(path, "utf8"));
      const output = await emit(plugin, path);
      expect(output.messages).toEqual(messages);
      expect(Object.keys(output.messages!)).toEqual(Object.keys(messages));
      tables.set(output.keyId, output.keyCode);
      originalBytes += gzipSync(JSON.stringify(messages)).length;
      packedBytes += gzipSync(output.code).length;
    }
    expect(tables.size).toBe(1);
    packedBytes += [...tables.values()].reduce((sum, code) => sum + gzipSync(code).length, 0);
    expect(packedBytes).toBeLessThan(originalBytes);
  });

  it("keeps distinct keys, order, Unicode and ICU placeholders intact", async () => {
    const root = await mkdtemp(join(tmpdir(), "gg-locale-catalogues-"));
    roots.push(root);
    const client = join(root, "client");
    const directory = join(root, "shared/src/i18n");
    await mkdir(directory, { recursive: true });
    const variants = [
      { "app.second": "Olá {name}\n'\"\\", "app.first": "{n, plural, one {uno} other {#}}" },
      { "app.first": "ẹ ọ ị ụ", "app.second": "Second", "app.extra": "Extra" },
      {},
    ];
    const plugin = await configure(client);
    const ids = new Set<string>();
    for (const [index, locale] of ["en", "es", "pt"].entries()) {
      const path = join(directory, `${locale}.json`);
      await writeFile(path, JSON.stringify(variants[index]));
      const output = await emit(plugin, path);
      expect(output.messages).toEqual(variants[index]);
      expect(Object.keys(output.messages!)).toEqual(Object.keys(variants[index]));
      ids.add(output.keyId);
    }
    expect(ids.size).toBe(3);
  });

  it("leaves other JSON and explicit raw imports to their original loaders", async () => {
    const root = resolve(import.meta.dirname, "../../..");
    const plugin = await configure(root);
    if (typeof plugin.transform !== "function") throw new Error("transform hook missing");
    for (const path of [
      resolve(root, "src/config/other.json"),
      `${resolve(root, "../shared/src/i18n/en.json")}?raw`,
    ])
      expect(
        await plugin.transform.call({} as never, "", path, { moduleType: "js" })
      ).toBeUndefined();
  });
});
