import { readFile } from "node:fs/promises";
import { type Plugin, parseAst } from "vite";

const ICON_PACKAGE = "@remixicon/react";
// Extensionless virtual ids: other plugins' transforms (Babel, React) skip them.
const BARREL_ID = "\0green-goods-icons";
const LEAF_PREFIX = "\0green-goods-icon:";
const FIRST_PARTY = /\/packages\/(?:client|shared)\/src\/.*\.[jt]sx?$/;
const ICON_IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']@remixicon\/react["']/g;

interface ModuleGraph {
  getModuleInfo(id: string): { importedIds: readonly string[] } | null;
}

export interface IconModules {
  /** Re-exports every icon from its own module. */
  barrel: string;
  /** Each icon's module, keyed by the name the package exports it under. */
  leaves: Map<string, string>;
}

function nameOf(node: { type: string; name?: string; value?: unknown }): string {
  if (node.type === "Identifier" && node.name) return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  throw new Error(`${ICON_PACKAGE}: an export name the icon split cannot read (${node.type})`);
}

/**
 * Splits the icon package's single module into one module per icon, behind a barrel that only
 * re-exports them. The package ships every icon in one file, and a module is never split across
 * chunks, so every icon any screen draws rode in the chunk the installed app starts with.
 *
 * The package's shape is checked, not assumed: the React import, one declaration per icon, and
 * one export list. Any other statement, or a declaration no icon exports (a shared helper a
 * leaf would lack), fails the build here rather than shipping a broken icon.
 */
export function splitIconModule(source: string): IconModules {
  const program = parseAst(source);
  const imports: string[] = [];
  const declarations = new Map<string, string>();
  const exported = new Map<string, string>();
  for (const node of program.body) {
    if (node.type === "ImportDeclaration") {
      imports.push(source.slice(node.start, node.end).replace(/;?$/, ";"));
    } else if (node.type === "VariableDeclaration" && node.kind === "const") {
      for (const declarator of node.declarations) {
        if (declarator.id.type !== "Identifier" || !declarator.init) {
          throw new Error(`${ICON_PACKAGE}: a declaration the icon split cannot read`);
        }
        declarations.set(declarator.id.name, source.slice(declarator.start, declarator.end));
      }
    } else if (node.type === "ExportNamedDeclaration" && !node.declaration && !node.source) {
      for (const specifier of node.specifiers) {
        exported.set(nameOf(specifier.exported), nameOf(specifier.local));
      }
    } else {
      throw new Error(`${ICON_PACKAGE}: an unexpected ${node.type}; update the icon split`);
    }
  }

  const exportedLocals = new Set(exported.values());
  for (const local of declarations.keys()) {
    if (!exportedLocals.has(local)) {
      throw new Error(`${ICON_PACKAGE}: \`${local}\` is declared but not exported as an icon`);
    }
  }

  const leaves = new Map<string, string>();
  const reexports: string[] = [];
  for (const [name, local] of exported) {
    const declaration = declarations.get(local);
    if (!declaration) throw new Error(`${ICON_PACKAGE}: \`${name}\` has no declaration`);
    leaves.set(name, `${imports.join("\n")}\nconst ${declaration};\nexport { ${local} as ${name} };\n`);
    reexports.push(`export { ${name} } from ${JSON.stringify(LEAF_PREFIX + name)};`);
  }
  return { barrel: `${reexports.join("\n")}\n`, leaves };
}

/** The icon names a module imports by value; type-only imports draw nothing. */
function importedIconNames(code: string): string[] {
  const names: string[] = [];
  for (const [, typeOnly, specifiers] of code.matchAll(ICON_IMPORT)) {
    if (typeOnly) continue;
    for (const specifier of specifiers.split(",")) {
      const [imported] = specifier.trim().split(/\s+as\s+/);
      if (imported && !imported.startsWith("type ")) names.push(imported);
    }
  }
  return names;
}

/**
 * Builds resolve `@remixicon/react` to a barrel of one module per icon, marked free of side
 * effects like the commitment-pooling barrels, so each icon loads in the chunks of the screens
 * that draw them. Source files keep importing from the package; the dev server, tests and
 * Storybook use the package as published.
 *
 * Left to entry-set chunking, the icons the installed app starts with scatter into a chunk for
 * each combination of screens that draws them, a few hundred bytes of chunk around each icon.
 * `startupChunkGroup` keeps them in one chunk instead: the icons that modules statically reachable
 * from `startupRoots` import, the same roots `scripts/check-pwa-precache-budget.mjs` measures.
 */
export function createIconLeaves(startupRoots: readonly string[]) {
  let packageEntry: string | undefined;
  let modules: Promise<IconModules> | undefined;
  const iconsByModule = new Map<string, string[]>();
  let startupIcons: Set<string> | undefined;

  const collectStartupIcons = (graph: ModuleGraph) => {
    const icons = new Set<string>();
    const seen = new Set<string>();
    const queue = [...startupRoots];
    while (queue.length) {
      const id = queue.pop() as string;
      if (seen.has(id) || id.includes("/node_modules/") || id.startsWith("\0")) continue;
      seen.add(id);
      for (const icon of iconsByModule.get(id) ?? []) icons.add(icon);
      queue.push(...(graph.getModuleInfo(id)?.importedIds ?? []));
    }
    return icons;
  };

  const plugin: Plugin = {
    name: "green-goods-icon-leaves",
    apply: "build",
    enforce: "pre",
    async resolveId(source, importer) {
      if (source === ICON_PACKAGE) {
        if (!packageEntry) {
          const resolved = await this.resolve(source, importer, { skipSelf: true });
          if (!resolved) return null;
          packageEntry = resolved.id;
        }
        return { id: BARREL_ID, moduleSideEffects: false };
      }
      if (source.startsWith(LEAF_PREFIX)) return { id: source, moduleSideEffects: false };
      return null;
    },
    async load(id) {
      if (id !== BARREL_ID && !id.startsWith(LEAF_PREFIX)) return null;
      if (!packageEntry) this.error(`${ICON_PACKAGE} was not resolved before its icons loaded`);
      modules ??= readFile(packageEntry, "utf8").then(splitIconModule);
      const { barrel, leaves } = await modules;
      if (id === BARREL_ID) return { code: barrel, moduleSideEffects: false };
      const leaf = leaves.get(id.slice(LEAF_PREFIX.length));
      if (!leaf) this.error(`${ICON_PACKAGE} has no icon named ${id.slice(LEAF_PREFIX.length)}`);
      return { code: leaf, moduleSideEffects: false };
    },
    transform(code, id) {
      if (!FIRST_PARTY.test(id) || !code.includes(ICON_PACKAGE)) return null;
      const names = importedIconNames(code);
      if (names.length) iconsByModule.set(id, names);
      return null;
    },
  };

  const startupChunkGroup = {
    name: (id: string, graph: ModuleGraph) => {
      if (!id.startsWith(LEAF_PREFIX)) return null;
      startupIcons ??= collectStartupIcons(graph);
      return startupIcons.has(id.slice(LEAF_PREFIX.length)) ? "startup-icons" : null;
    },
    test: (id: string) => id.startsWith(LEAF_PREFIX),
    priority: 15,
    includeDependenciesRecursively: false,
  };

  return { plugin, startupChunkGroup };
}
