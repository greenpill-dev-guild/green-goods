import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";
import type { ResolvedConfig } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLocaleCataloguesPlugin,
  HUB_MESSAGE_PREFIXES,
  WEBSITE_ONLY_MESSAGE_PREFIXES,
} from "../../../vite/locale-catalogues";

const websiteOnly = (key: string) =>
  WEBSITE_ONLY_MESSAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
const hubOnly = (key: string) => HUB_MESSAGE_PREFIXES.some((prefix) => key.startsWith(prefix));

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
  const result = await plugin.transform.call(
    {
      error(message: string): never {
        throw new Error(message);
      },
      addWatchFile() {},
    } as never,
    "",
    path,
    { moduleType: "json" }
  );
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
  it("preserves every message the installed app can show and shares keys to reduce the payload", async () => {
    const root = resolve(import.meta.dirname, "../../..");
    const plugin = await configure(root);
    // Hub ids the installed app's own source writes out whole, read without the plugin's scanner.
    const written = new Set<string>();
    const visit = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== "__tests__") await visit(path);
        } else if (/\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name)) {
          for (const match of (await readFile(path, "utf8")).matchAll(
            /["'`]((?:hub|admin)\.[\w.-]+)["'`]/g
          ))
            written.add(match[1]);
        }
      }
    };
    await visit(resolve(root, "src"));
    await visit(resolve(root, "../shared/src"));
    const tables = new Map<string, string>();
    let originalBytes = 0;
    let packedBytes = 0;
    for (const locale of ["en", "es", "pt"]) {
      const path = resolve(root, `../shared/src/i18n/${locale}.json`);
      const source: Record<string, string> = JSON.parse(await readFile(path, "utf8"));
      const output = await emit(plugin, path);
      const messages = output.messages!;
      // Every message that is not website-only or Hub copy is kept, with its value, in order.
      const shown = Object.entries(source).filter(([key]) => !websiteOnly(key) && !hubOnly(key));
      expect(Object.entries(messages).filter(([key]) => !hubOnly(key))).toEqual(shown);
      // No website-only message rides along.
      expect(Object.keys(messages).filter(websiteOnly)).toEqual([]);
      // Hub copy the installed app writes out is kept; the rest of the Hub's copy stays out.
      const hub = Object.keys(source).filter(hubOnly);
      for (const key of hub.filter((key) => written.has(key))) {
        expect(messages[key]).toBe(source[key]);
      }
      const keptHub = Object.keys(messages).filter(hubOnly);
      expect(keptHub.length).toBeGreaterThanOrEqual(hub.filter((key) => written.has(key)).length);
      expect(keptHub.length).toBeLessThan(hub.length / 10);
      tables.set(output.keyId, output.keyCode);
      originalBytes += gzipSync(JSON.stringify(Object.fromEntries(shown))).length;
      packedBytes += gzipSync(output.code).length;
    }
    expect(tables.size).toBe(1);
    packedBytes += [...tables.values()].reduce((sum, code) => sum + gzipSync(code).length, 0);
    expect(packedBytes).toBeLessThan(originalBytes);
  });

  it("keeps a Hub message only while installed-app source names it, whole or by its start", async () => {
    const root = await mkdtemp(join(tmpdir(), "gg-hub-messages-"));
    roots.push(root);
    const client = join(root, "client");
    for (const directory of [
      "shared/src/i18n",
      "shared/src/hooks",
      "client/src/views",
      "client/src/__tests__",
    ])
      await mkdir(join(root, directory), { recursive: true });
    await writeFile(
      join(root, "client/src/views/Garden.tsx"),
      'export const title = formatMessage({ id: "hub.garden.title" });\n' +
        "export const tab = (name: string) => formatMessage({ id: `hub.tabs.${name}` });\n"
    );
    await writeFile(
      join(root, "shared/src/hooks/useRoles.ts"),
      'export const LABELS = { steward: "admin.roles" } as const;\n'
    );
    // Tests, stories and declarations do not run in the installed app.
    await writeFile(
      join(root, "client/src/views/Garden.test.tsx"),
      'it("hub.unused.test", () => {});\n'
    );
    await writeFile(
      join(root, "client/src/__tests__/fixture.ts"),
      'export const id = "hub.unused.fixture";\n'
    );
    const catalogue = {
      "app.always": "Always",
      "public.passport.title": "Website only",
      "hub.garden.title": "Named whole",
      "hub.garden.subtitle": "Never named",
      "hub.tabs.work": "Started by a template",
      "hub.tabs.review": "Started by a template",
      "admin.roles.steward": "Named by its start",
      "admin.members.add": "Never named",
      "hub.unused.test": "Named only in a test",
      "hub.unused.fixture": "Named only in a fixture",
    };
    const path = join(root, "shared/src/i18n/en.json");
    await writeFile(path, JSON.stringify(catalogue));
    const output = await emit(await configure(client), path);
    expect(output.messages).toEqual({
      "app.always": "Always",
      "hub.garden.title": "Named whole",
      "hub.tabs.work": "Started by a template",
      "hub.tabs.review": "Started by a template",
      "admin.roles.steward": "Named by its start",
    });
  });

  // A tripwire, not a proof. It reads literal message ids and literal import specifiers, so an id
  // assembled at run time, a glob import or a computed specifier outside the route table passes
  // unseen. The route test holds the other end: no passport route in the installed app's tree.
  it("leaves out only copy that no code the installed app can reach refers to", async () => {
    const root = resolve(import.meta.dirname, "../../..");
    const client = resolve(root, "src");
    // The website's pages and pieces. The installed app's routes omit the pages, but its code
    // does import some of the pieces, so a folder alone does not keep copy out of the app.
    const websiteOnlyCode = /\/client\/src\/(views\/Public|components\/Public)\//;
    const sources = new Map<string, string>();
    const visit = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== "__tests__") await visit(path);
        } else if (/\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name)) {
          sources.set(path, await readFile(path, "utf8"));
        }
      }
    };
    for (const folder of ["src", "../shared/src", "../admin/src"]) {
      await visit(resolve(root, folder));
    }
    const refers = (path: string) =>
      WEBSITE_ONLY_MESSAGE_PREFIXES.some((prefix) => sources.get(path)?.includes(prefix));
    const paths = [...sources.keys()];
    expect(paths.filter((path) => refers(path) && !websiteOnlyCode.test(path))).toEqual([]);

    // Space between tokens, comments included: `import /* note */ (` is still a call.
    const gap = String.raw`(?:\s|/\*[\s\S]*?\*/|//[^\n]*\n)*`;
    // The client files each file imports, with where in the file and whether on demand.
    const references = (path: string) =>
      [
        ...(sources.get(path) ?? "").matchAll(
          new RegExp(`(?:from|import)${gap}(\\()?${gap}["']([^"']+)["']`, "g")
        ),
      ].flatMap((match) => {
        // The path as the runtime reads it: escapes decoded, a `.js` suffix naming its source.
        const specifier = match[2]
          .replace(/\\(x[0-9a-f]{2}|u\{[0-9a-f]+\}|u[0-9a-f]{4}|[\s\S])/gi, (_, escape: string) =>
            /^[xu]/i.test(escape) && escape.length > 1
              ? String.fromCodePoint(Number.parseInt(escape.replace(/[xu{}]/gi, ""), 16))
              : escape
          )
          .replace(/\.js$/, "");
        const base = specifier.startsWith("@/")
          ? join(client, specifier.slice(2))
          : specifier.startsWith(".")
            ? resolve(dirname(path), specifier)
            : null;
        if (!base) return [];
        const file = [
          base,
          `${base}.ts`,
          `${base}.tsx`,
          join(base, "index.ts"),
          join(base, "index.tsx"),
        ].find((candidate) => sources.has(candidate));
        return file ? [{ file, at: match.index, lazy: match[1] === "(" }] : [];
      });
    const imports = (path: string) => references(path).map((reference) => reference.file);
    // The website's files that show the copy, themselves or through one another.
    const carrying = new Set(paths.filter(refers));
    for (let grew = true; grew; ) {
      grew = false;
      for (const path of paths.filter((candidate) => websiteOnlyCode.test(candidate))) {
        if (!carrying.has(path) && imports(path).some((imported) => carrying.has(imported))) {
          carrying.add(path);
          grew = true;
        }
      }
    }
    // Only the route table reaches them from the rest of the client, and only through the
    // website's lazy routes.
    const routeTable = resolve(client, "config/routes.tsx");
    expect(
      paths.filter(
        (path) =>
          path.startsWith(client) &&
          !websiteOnlyCode.test(path) &&
          imports(path).some((imported) => carrying.has(imported))
      )
    ).toEqual([routeTable]);
    // The table lists the website's routes, then the installed app's. However an import is
    // spelled, a page that shows the copy is loaded on demand and only from the website's part.
    const table = sources.get(routeTable) ?? "";
    const start = table.indexOf("id: CLIENT_ROUTE_IDS.publicShell,");
    const end = table.indexOf("id: CLIENT_ROUTE_IDS.pwaRuntime,");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // A computed specifier is one this scan cannot follow, so the table may not use one: every
    // import() there takes one string literal and nothing else.
    expect(table).not.toMatch(new RegExp(`import${gap}\\((?!${gap}(["'])[^"'\`]+\\1${gap}\\))`));
    const reached = references(routeTable).filter((reference) => carrying.has(reference.file));
    expect(reached.length).toBeGreaterThan(0);
    for (const reference of reached) {
      expect(reference.lazy).toBe(true);
      expect(reference.at).toBeGreaterThan(start);
      expect(reference.at).toBeLessThan(end);
    }
  });

  it("keeps distinct keys, order, Unicode and ICU placeholders intact", async () => {
    const root = await mkdtemp(join(tmpdir(), "gg-locale-catalogues-"));
    roots.push(root);
    const client = join(root, "client");
    const directory = join(root, "shared/src/i18n");
    await mkdir(directory, { recursive: true });
    await mkdir(join(client, "src"), { recursive: true });
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

  it.each([null, [], "not a catalogue"])("rejects a non-object catalogue: %j", async (value) => {
    const root = await mkdtemp(join(tmpdir(), "gg-invalid-locale-"));
    roots.push(root);
    const directory = join(root, "shared/src/i18n");
    await mkdir(directory, { recursive: true });
    const path = join(directory, "en.json");
    await writeFile(path, JSON.stringify(value));
    const plugin = await configure(join(root, "client"));
    await expect(emit(plugin, path)).rejects.toThrow("Expected a message catalogue object:");
  });
});
