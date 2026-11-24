import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createIconLeaves, splitIconModule } from "../../../vite/icon-leaves";

type ResolveId = (
  this: { resolve: (source: string, importer?: string) => Promise<{ id: string } | null> },
  source: string,
  importer?: string
) => Promise<{ id: string; moduleSideEffects: boolean } | null>;
type Load = (
  this: { error: (message: string) => never },
  id: string
) => Promise<{ code: string; moduleSideEffects: boolean } | null>;
type Transform = (code: string, id: string) => null;

// The published package's shape: React, one const per icon, one export list.
const PACKAGE_SHAPED =
  'import t from"react";const s=({size:e=24})=>t.createElement("svg",{width:e}),l=()=>t.createElement("svg",{id:"b"});export{s as RiAddLine,l as RiCloseLine};';

describe("icon leaves", () => {
  it("resolves the icon package to a side-effect-free barrel of one module per icon", async () => {
    const directory = await mkdtemp(join(tmpdir(), "icon-leaves-"));
    try {
      const entry = join(directory, "index.mjs");
      await writeFile(entry, PACKAGE_SHAPED);
      const { plugin } = createIconLeaves([]);
      const resolveId = plugin.resolveId as ResolveId;
      const load = plugin.load as Load;
      const context = { resolve: vi.fn().mockResolvedValue({ id: entry }) };
      const errors = {
        error: (message: string): never => {
          throw new Error(message);
        },
      };

      const barrel = await resolveId.call(context, "@remixicon/react", "/repo/src/Home.tsx");
      expect(barrel?.moduleSideEffects).toBe(false);
      expect(await resolveId.call(context, "react", "/repo/src/Home.tsx")).toBeNull();

      const barrelCode = (await load.call(errors, barrel!.id))?.code ?? "";
      // The specifiers are string literals; decode them as the bundler reads them.
      const leafIds = [...barrelCode.matchAll(/from ("[^"]+")/g)].map(
        (match) => JSON.parse(match[1]) as string
      );
      expect(barrelCode).toMatch(/^export \{ RiAddLine \} from /m);
      expect(leafIds).toHaveLength(2);

      const leaf = await resolveId.call(context, leafIds[0]);
      expect(leaf).toEqual({ id: leafIds[0], moduleSideEffects: false });
      const leafCode = (await load.call(errors, leafIds[0]))?.code ?? "";
      expect(leafCode).toContain('import t from"react";');
      expect(leafCode).toContain('const s=({size:e=24})=>t.createElement("svg",{width:e});');
      expect(leafCode).toContain("export { s as RiAddLine };");
      expect(leafCode).not.toContain("RiCloseLine");
      expect(plugin.apply).toBe("build");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("gives the icons the startup screens import, and only those, one chunk", () => {
    const home = "/repo/packages/client/src/views/Home/index.tsx";
    const row = "/repo/packages/shared/src/components/Cards/ItemRow/ItemRow.tsx";
    const lazy = "/repo/packages/client/src/views/Profile/index.tsx";
    const { plugin, startupChunkGroup } = createIconLeaves([home]);
    const transform = plugin.transform as Transform;
    transform(
      'import { RiAddLine as Add, type RemixiconComponentType } from "@remixicon/react";\nimport type { RiBookLine } from "@remixicon/react";',
      home
    );
    transform('import { RiCloseLine } from "@remixicon/react";', row);
    transform('import { RiStarLine } from "@remixicon/react";', lazy);
    // Home imports the row statically and the profile page lazily.
    const imports: Record<string, string[]> = { [home]: [row], [row]: [], [lazy]: [] };
    const graph = { getModuleInfo: (id: string) => ({ importedIds: imports[id] ?? [] }) };
    const groupOf = (icon: string) => startupChunkGroup.name(`\0green-goods-icon:${icon}`, graph);

    expect(groupOf("RiAddLine")).toBe("startup-icons");
    expect(groupOf("RiCloseLine")).toBe("startup-icons");
    expect(groupOf("RiStarLine")).toBeNull();
    expect(groupOf("RiBookLine")).toBeNull();
    expect(startupChunkGroup.name(row, graph)).toBeNull();
  });

  it("refuses a package shape whose icons would lose a shared helper", () => {
    expect(() =>
      splitIconModule('import t from"react";const h=1,s=()=>h;export{s as RiAddLine};')
    ).toThrow(/`h` is declared but not exported/);
    expect(() => splitIconModule('import t from"react";t.version;export{};')).toThrow(
      /unexpected ExpressionStatement/
    );
  });

  it("splits the installed package into one module for every icon it exports", async () => {
    const require = createRequire(import.meta.url);
    const entry = join(dirname(require.resolve("@remixicon/react")), "index.mjs");
    const source = await readFile(entry, "utf8");
    const { barrel, leaves } = splitIconModule(source);
    const exported = /export\{([^}]*)\}/.exec(source)?.[1].split(",").length;

    expect(leaves.size).toBe(exported);
    expect(barrel.trim().split("\n")).toHaveLength(leaves.size);
    expect(leaves.get("RiAddLine")).toMatch(/export \{ \w+ as RiAddLine \};\n$/);
  });
});
