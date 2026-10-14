import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, stringToHex, toHex } from "viem";

interface NamespaceBaseline {
  contract: string;
  source: string;
  namespace: string;
  struct: string;
  constant: string;
  slot: `0x${string}`;
  members: string[];
  referencedStructs?: StructBaseline[];
}

interface StructBaseline {
  source: string;
  struct: string;
  members: string[];
}

interface NamespaceManifest {
  namespaces: NamespaceBaseline[];
}

interface Identifier {
  value: string;
  end: number;
}

interface StructRange {
  bodyStart: number;
  bodyEnd: number;
}

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "../..");
const manifestPath = path.join(projectRoot, "storage-layouts/ERC7201Namespaces.json");

function normalizeDeclaration(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function derivedSlot(namespace: string): `0x${string}` {
  const namespaceHash = BigInt(keccak256(stringToHex(namespace)));
  const inner = toHex(namespaceHash - 1n, { size: 32 });
  const outer = BigInt(keccak256(inner));
  const mask = (1n << 256n) - 256n;
  return toHex(outer & mask, { size: 32 });
}

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_$]/.test(character);
}

function isIdentifierPart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_$]/.test(character);
}

function readIdentifier(source: string, index: number): Identifier | undefined {
  if (!isIdentifierStart(source[index])) return undefined;
  let end = index + 1;
  while (isIdentifierPart(source[end])) ++end;
  return { value: source.slice(index, end), end };
}

function skipQuoted(source: string, index: number): number {
  const quote = source[index];
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) return cursor + 1;
    ++cursor;
  }
  throw new Error("Unterminated string while parsing Solidity source");
}

function skipTrivia(source: string, index: number): number {
  let cursor = index;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor] ?? "")) {
      ++cursor;
      continue;
    }
    if (source.startsWith("//", cursor)) {
      const lineEnd = source.indexOf("\n", cursor + 2);
      cursor = lineEnd === -1 ? source.length : lineEnd + 1;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      const commentEnd = source.indexOf("*/", cursor + 2);
      if (commentEnd === -1) throw new Error("Unterminated block comment while parsing Solidity source");
      cursor = commentEnd + 2;
      continue;
    }
    return cursor;
  }
  return cursor;
}

function findMatchingBrace(source: string, openBrace: number): number {
  let depth = 0;
  let cursor = openBrace;
  while (cursor < source.length) {
    if (source.startsWith("//", cursor) || source.startsWith("/*", cursor)) {
      cursor = skipTrivia(source, cursor);
      continue;
    }
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipQuoted(source, cursor);
      continue;
    }
    if (source[cursor] === "{") ++depth;
    if (source[cursor] === "}" && --depth === 0) return cursor;
    ++cursor;
  }
  throw new Error("Unterminated struct while parsing Solidity source");
}

function parseStructAt(source: string, index: number, sourceName: string, expectedName: string): StructRange {
  let cursor = skipTrivia(source, index);
  const keyword = readIdentifier(source, cursor);
  if (keyword?.value !== "struct") {
    throw new Error(`${sourceName}: struct ${expectedName} must be the next declaration after its annotation`);
  }
  cursor = skipTrivia(source, keyword.end);
  const name = readIdentifier(source, cursor);
  if (name?.value !== expectedName) {
    throw new Error(`${sourceName}: struct ${expectedName} must be the next declaration after its annotation`);
  }
  cursor = skipTrivia(source, name.end);
  if (source[cursor] !== "{") throw new Error(`${sourceName}: malformed struct ${expectedName}`);
  return { bodyStart: cursor + 1, bodyEnd: findMatchingBrace(source, cursor) };
}

function commentEndContaining(source: string, annotationIndex: number, sourceName: string): number {
  const blockStart = source.lastIndexOf("/*", annotationIndex);
  const precedingBlockEnd = source.lastIndexOf("*/", annotationIndex);
  if (blockStart > precedingBlockEnd) {
    const blockEnd = source.indexOf("*/", annotationIndex);
    if (blockEnd === -1) throw new Error(`${sourceName}: unterminated storage-location comment`);
    return blockEnd + 2;
  }

  const lineStart = source.lastIndexOf("\n", annotationIndex) + 1;
  const lineComment = source.indexOf("//", lineStart);
  if (lineComment !== -1 && lineComment < annotationIndex) {
    const lineEnd = source.indexOf("\n", annotationIndex);
    return lineEnd === -1 ? source.length : lineEnd + 1;
  }
  throw new Error(`${sourceName}: storage-location annotation must be in a Solidity comment`);
}

function membersFromRange(source: string, range: StructRange): string[] {
  const body = source
    .slice(range.bodyStart, range.bodyEnd)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
  return body.split(";").map(normalizeDeclaration).filter(Boolean);
}

export function extractAnnotatedStructMembers(
  source: string,
  sourceName: string,
  namespace: string,
  structName: string,
): string[] {
  const annotation = `@custom:storage-location erc7201:${namespace}`;
  const annotationIndex = source.indexOf(annotation);
  if (annotationIndex === -1) {
    throw new Error(`${sourceName}: ${structName} is not bound to erc7201:${namespace}`);
  }
  if (source.indexOf(annotation, annotationIndex + annotation.length) !== -1) {
    throw new Error(`${sourceName}: erc7201:${namespace} annotation is ambiguous`);
  }
  const range = parseStructAt(
    source,
    commentEndContaining(source, annotationIndex, sourceName),
    sourceName,
    structName,
  );
  return membersFromRange(source, range);
}

function findNamedStructs(source: string, structName: string): StructRange[] {
  const ranges: StructRange[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    cursor = skipTrivia(source, cursor);
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipQuoted(source, cursor);
      continue;
    }
    const keyword = readIdentifier(source, cursor);
    if (!keyword) {
      ++cursor;
      continue;
    }
    cursor = keyword.end;
    if (keyword.value !== "struct") continue;

    const name = readIdentifier(source, skipTrivia(source, cursor));
    if (!name) continue;
    const openBrace = skipTrivia(source, name.end);
    if (source[openBrace] !== "{") continue;
    const range = { bodyStart: openBrace + 1, bodyEnd: findMatchingBrace(source, openBrace) };
    if (name.value === structName) ranges.push(range);
    cursor = range.bodyEnd + 1;
  }
  return ranges;
}

export function extractUniqueStructMembers(source: string, sourceName: string, structName: string): string[] {
  const ranges = findNamedStructs(source, structName);
  if (ranges.length === 0) throw new Error(`${sourceName}: could not find struct ${structName}`);
  if (ranges.length > 1) throw new Error(`${sourceName}: multiple structs named ${structName}`);
  return membersFromRange(source, ranges[0] as StructRange);
}

function isOutsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

export function resolveProjectSourcePath(source: string): string {
  if (path.isAbsolute(source)) throw new Error(`Manifest source path must be relative: ${source}`);
  const resolved = path.resolve(projectRoot, source);
  if (isOutsideRoot(projectRoot, resolved))
    throw new Error(`Manifest source path must stay within projectRoot: ${source}`);

  const canonicalRoot = fs.realpathSync(projectRoot);
  const canonicalSource = fs.realpathSync(resolved);
  if (isOutsideRoot(canonicalRoot, canonicalSource)) {
    throw new Error(`Manifest source path must stay within projectRoot: ${source}`);
  }
  return canonicalSource;
}

function verifyMembers(sourceName: string, structName: string, actual: string[], committed: string[]): void {
  const expected = committed.map(normalizeDeclaration);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${sourceName}: ${structName} member order changed\n` +
        `  committed: ${JSON.stringify(expected)}\n` +
        `  current:   ${JSON.stringify(actual)}`,
    );
  }
}

function extractConstantValue(source: string, sourceName: string, constantName: string): string {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(constantName)) {
    throw new Error(`${sourceName}: invalid constant name ${constantName}`);
  }

  const values: string[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    cursor = skipTrivia(source, cursor);
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipQuoted(source, cursor);
      continue;
    }
    const identifier = readIdentifier(source, cursor);
    if (!identifier) {
      ++cursor;
      continue;
    }
    cursor = identifier.end;
    if (identifier.value !== constantName) continue;

    const equals = skipTrivia(source, cursor);
    if (source[equals] !== "=") continue;
    const valueStart = skipTrivia(source, equals + 1);
    const value = source.slice(valueStart).match(/^(0x[0-9a-fA-F]{64})\s*;/)?.[1];
    if (value) values.push(value);
  }

  if (values.length === 0) throw new Error(`${sourceName}: could not find ${constantName}`);
  if (values.length > 1) throw new Error(`${sourceName}: multiple assignments found for ${constantName}`);
  return values[0] as string;
}

function verifyNamespace(baseline: NamespaceBaseline): void {
  const source = fs.readFileSync(resolveProjectSourcePath(baseline.source), "utf8");
  const expectedSlot = derivedSlot(baseline.namespace).toLowerCase();
  if (baseline.slot.toLowerCase() !== expectedSlot) {
    throw new Error(`${baseline.namespace}: committed slot ${baseline.slot} does not match ERC-7201 ${expectedSlot}`);
  }

  if (extractConstantValue(source, baseline.source, baseline.constant).toLowerCase() !== expectedSlot) {
    throw new Error(`${baseline.source}: ${baseline.constant} does not match ERC-7201 ${expectedSlot}`);
  }

  verifyMembers(
    baseline.source,
    baseline.struct,
    extractAnnotatedStructMembers(source, baseline.source, baseline.namespace, baseline.struct),
    baseline.members,
  );

  for (const referenced of baseline.referencedStructs ?? []) {
    const referencedSource = fs.readFileSync(resolveProjectSourcePath(referenced.source), "utf8");
    verifyMembers(
      referenced.source,
      referenced.struct,
      extractUniqueStructMembers(referencedSource, referenced.source, referenced.struct),
      referenced.members,
    );
  }

  process.stdout.write(`OK: erc7201:${baseline.namespace}\n`);
}

function contractFilter(): string | undefined {
  const args = process.argv.slice(2);
  if (args.length === 0) return undefined;
  if (args[0] !== "--contract") throw new Error(`Unknown argument: ${args[0]}`);
  if (args.length !== 2 || !args[1]) throw new Error("--contract requires exactly one contract name");
  return args[1];
}

function run(): void {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as NamespaceManifest;
  const filter = contractFilter();
  const baselines = filter
    ? manifest.namespaces.filter((baseline) => baseline.contract === filter)
    : manifest.namespaces;
  if (filter && baselines.length === 0) {
    throw new Error(`No ERC-7201 namespace baseline found for contract ${filter}`);
  }
  for (const baseline of baselines) verifyNamespace(baseline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
