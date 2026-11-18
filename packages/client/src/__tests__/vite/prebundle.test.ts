// TEST-QUALITY: allow-small-test-file - one config invariant: Shared's bare runtime imports stay pre-bundled.
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "vite";
import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
const sharedRoot = fileURLToPath(new URL("../../../../shared/", import.meta.url));
const VIA_SHARED = "@green-goods/shared > ";
const NOT_A_PACKAGE = /^(\.|\/|@\/|@green-goods\/|node:|virtual:)/;

type AstNode = Record<string, unknown> & { type?: string };

function visit(node: unknown, enter: (node: AstNode) => boolean | undefined): void {
  if (Array.isArray(node)) {
    for (const child of node) visit(child, enter);
    return;
  }
  if (!node || typeof node !== "object") return;
  if (enter(node as AstNode) === false) return;
  for (const value of Object.values(node)) visit(value, enter);
}

function parse(path: string): unknown {
  const { program, errors } = parseSync(path, readFileSync(path, "utf8"), {
    lang: path.endsWith(".tsx") ? "tsx" : "ts",
    sourceType: "module",
  });
  expect(errors, path).toEqual([]);
  return program;
}

/**
 * Packages a module loads at run time: value imports and re-exports, and dynamic imports of a
 * literal. Shared compiles with verbatimModuleSyntax, so only `import type` and `export type`
 * are erased, and `import("x")` in a type position never loads.
 */
function addRuntimeImports(path: string, found: Set<string>): void {
  visit(parse(path), (node) => {
    if (node.type === "TSImportType") return false;
    const source = node.source as AstNode | undefined;
    if (!source) return undefined;
    const declaration = /^(Import|ExportNamed|ExportAll)Declaration$/.test(node.type ?? "");
    if (declaration && node.importKind !== "type" && node.exportKind !== "type") {
      found.add(source.value as string);
    }
    if (node.type === "ImportExpression") {
      if (source.type === "Literal" && typeof source.value === "string") found.add(source.value);
      const [quasi] = (source.quasis as { value: { cooked: string } }[] | undefined) ?? [];
      if (
        source.type === "TemplateLiteral" &&
        (source.expressions as unknown[]).length === 0 &&
        quasi
      ) {
        found.add(quasi.value.cooked);
      }
    }
    return undefined;
  });
}

function sharedRuntimeImports(directory = join(sharedRoot, "src"), found = new Set<string>()) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sharedRuntimeImports(path, found);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec|stories|d)\.tsx?$/.test(entry.name)) {
      addRuntimeImports(path, found);
    }
  }
  return found;
}

/** The entries of `optimizeDeps.include`, read from the config's syntax so a comment never counts. */
function includedDependencies(): string[] {
  const keyOf = (property: AstNode) => {
    const key = property.key as AstNode | undefined;
    return key?.name ?? key?.value;
  };
  const lists: unknown[][] = [];
  visit(parse(join(packageRoot, "vite.config.ts")), (node) => {
    if (node.type !== "Property" || keyOf(node) !== "optimizeDeps") return undefined;
    for (const property of ((node.value as AstNode).properties as AstNode[] | undefined) ?? []) {
      const list = property.value as AstNode;
      if (keyOf(property) === "include" && list.type === "ArrayExpression") {
        lists.push(list.elements as unknown[]);
      }
    }
    return undefined;
  });
  expect(lists).toHaveLength(1);
  return lists[0].map((element) => {
    const entry = element as AstNode;
    expect(entry.type, "each entry is a string literal").toBe("Literal");
    return entry.value as string;
  });
}

describe("dependency pre-bundling", () => {
  const included = includedDependencies();

  it("names every bare runtime import of @green-goods/shared, which the startup scan skips", () => {
    const names = new Set(included.map((entry) => entry.replace(VIA_SHARED, "")));
    const missing = [...sharedRuntimeImports()].filter(
      (specifier) => !NOT_A_PACKAGE.test(specifier) && !names.has(specifier)
    );
    expect(missing.sort()).toEqual([]);
  });

  it("names only entries that resolve, through Shared when the entry says so", () => {
    // Vite only warns about an entry it cannot resolve, then discovers the package late again.
    const fromApp = createRequire(join(packageRoot, "package.json"));
    const fromShared = createRequire(join(sharedRoot, "package.json"));
    const unresolved = included.filter((entry) => {
      const viaShared = entry.startsWith(VIA_SHARED);
      try {
        (viaShared ? fromShared : fromApp).resolve(
          viaShared ? entry.slice(VIA_SHARED.length) : entry
        );
        return false;
      } catch {
        return true;
      }
    });
    expect(unresolved).toEqual([]);
  });
});
