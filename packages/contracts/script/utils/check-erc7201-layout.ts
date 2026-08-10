import fs from "node:fs";
import path from "node:path";
import { keccak256, stringToHex, toHex } from "viem";

interface NamespaceBaseline {
  contract: string;
  source: string;
  namespace: string;
  struct: string;
  constant: string;
  slot: `0x${string}`;
  members: string[];
}

interface NamespaceManifest {
  namespaces: NamespaceBaseline[];
}

const projectRoot = path.resolve(import.meta.dir, "../..");
const manifestPath = path.join(projectRoot, "storage-layouts/ERC7201Namespaces.json");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDeclaration(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function derivedSlot(namespace: string): `0x${string}` {
  const namespaceHash = BigInt(keccak256(stringToHex(namespace)));
  const inner = toHex(namespaceHash - 1n, { size: 32 });
  const outer = BigInt(keccak256(inner));
  const mask = (1n << 256n) - 256n;
  return toHex(outer & mask, { size: 32 });
}

function extractStructMembers(source: string, baseline: NamespaceBaseline): string[] {
  const annotation = new RegExp(
    `@custom:storage-location\\s+erc7201:${escapeRegExp(baseline.namespace)}[\\s\\S]{0,240}?struct\\s+${escapeRegExp(baseline.struct)}\\s*\\{`,
  );
  if (!annotation.test(source)) {
    throw new Error(`${baseline.source}: ${baseline.struct} is not bound to erc7201:${baseline.namespace}`);
  }

  const struct = new RegExp(`struct\\s+${escapeRegExp(baseline.struct)}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`);
  const match = source.match(struct);
  if (!match) throw new Error(`${baseline.source}: could not find struct ${baseline.struct}`);
  return (match[1] ?? "").split(";").map(normalizeDeclaration).filter(Boolean);
}

function verifyNamespace(baseline: NamespaceBaseline): void {
  const sourcePath = path.join(projectRoot, baseline.source);
  const source = fs.readFileSync(sourcePath, "utf8");
  const expectedSlot = derivedSlot(baseline.namespace).toLowerCase();
  if (baseline.slot.toLowerCase() !== expectedSlot) {
    throw new Error(`${baseline.namespace}: committed slot ${baseline.slot} does not match ERC-7201 ${expectedSlot}`);
  }

  const constantPattern = new RegExp(`\\b${escapeRegExp(baseline.constant)}\\s*=\\s*(0x[0-9a-fA-F]{64})\\s*;`);
  const constantMatch = source.match(constantPattern);
  if (!constantMatch) throw new Error(`${baseline.source}: could not find ${baseline.constant}`);
  if (constantMatch[1]?.toLowerCase() !== expectedSlot) {
    throw new Error(`${baseline.source}: ${baseline.constant} does not match ERC-7201 ${expectedSlot}`);
  }

  const actualMembers = extractStructMembers(source, baseline);
  const expectedMembers = baseline.members.map(normalizeDeclaration);
  if (JSON.stringify(actualMembers) !== JSON.stringify(expectedMembers)) {
    throw new Error(
      `${baseline.source}: ${baseline.struct} member order changed\n` +
        `  committed: ${JSON.stringify(expectedMembers)}\n` +
        `  current:   ${JSON.stringify(actualMembers)}`,
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

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as NamespaceManifest;
  const filter = contractFilter();
  const baselines = filter
    ? manifest.namespaces.filter((baseline) => baseline.contract === filter)
    : manifest.namespaces;
  if (filter && baselines.length === 0) {
    throw new Error(`No ERC-7201 namespace baseline found for contract ${filter}`);
  }
  for (const baseline of baselines) verifyNamespace(baseline);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
