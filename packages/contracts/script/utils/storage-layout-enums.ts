import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

interface AstNode {
  type?: string;
  name?: string;
  members?: AstNode[];
  [key: string]: unknown;
}

interface SolidityParser {
  parse(source: string, options?: Record<string, unknown>): AstNode;
}

export type EnumCatalog = Record<string, string[]>;

const rootRequire = createRequire(import.meta.url);
const solhintRequire = createRequire(rootRequire.resolve("solhint"));
const parser = solhintRequire("@solidity-parser/parser") as SolidityParser;

function addEnum(catalog: EnumCatalog, canonicalName: string, members: string[]): void {
  const existing = catalog[canonicalName];
  if (existing && JSON.stringify(existing) !== JSON.stringify(members)) {
    throw new Error(`Conflicting enum definitions found for ${canonicalName}`);
  }
  catalog[canonicalName] = members;
}

function visitAst(value: unknown, scope: string[], catalog: EnumCatalog): void {
  if (Array.isArray(value)) {
    for (const item of value) visitAst(item, scope, catalog);
    return;
  }
  if (!value || typeof value !== "object") return;

  const node = value as AstNode;
  const nodeScope = node.type === "ContractDefinition" && typeof node.name === "string" ? [...scope, node.name] : scope;

  if (node.type === "EnumDefinition" && typeof node.name === "string") {
    const members = (node.members ?? []).map((member) => {
      if (member.type !== "EnumValue" || typeof member.name !== "string") {
        throw new Error(`Invalid member in enum ${[...nodeScope, node.name].join(".")}`);
      }
      return member.name;
    });
    addEnum(catalog, [...nodeScope, node.name].join("."), members);
  }

  for (const [key, child] of Object.entries(node)) {
    if (key === "loc" || key === "range") continue;
    visitAst(child, nodeScope, catalog);
  }
}

export function extractEnumDefinitionsFromSource(source: string): EnumCatalog {
  const catalog: EnumCatalog = {};
  visitAst(parser.parse(source), [], catalog);
  return catalog;
}

function listSolidityFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listSolidityFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".sol") ? [entryPath] : [];
    });
}

export function collectEnumDefinitions(sourceRoot: string): EnumCatalog {
  const catalog: EnumCatalog = {};
  for (const sourcePath of listSolidityFiles(sourceRoot)) {
    let sourceCatalog: EnumCatalog;
    try {
      sourceCatalog = extractEnumDefinitionsFromSource(fs.readFileSync(sourcePath, "utf8"));
    } catch (error) {
      throw new Error(
        `Could not parse Solidity enums in ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    for (const [canonicalName, members] of Object.entries(sourceCatalog)) {
      addEnum(catalog, canonicalName, members);
    }
  }
  return catalog;
}

if (import.meta.main) {
  const sourceRoot = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : undefined;
  if (!sourceRoot || !fs.statSync(sourceRoot, { throwIfNoEntry: false })?.isDirectory()) {
    process.stderr.write("Usage: bun script/utils/storage-layout-enums.ts <source-root>\n");
    process.exit(1);
  }

  process.stdout.write(`${JSON.stringify(collectEnumDefinitions(sourceRoot), null, 2)}\n`);
}
