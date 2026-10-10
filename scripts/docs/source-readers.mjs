import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export function readJson(root, source) {
  try {
    return JSON.parse(readFileSync(path.join(root, source), "utf8"));
  } catch (error) {
    throw new Error(`Malformed JSON authority ${source}: ${error.message}`);
  }
}

export function packageExports(root, manifests) {
  const rows = [];
  for (const source of manifests) {
    const manifest = readJson(root, source);
    const exports = manifest.exports && typeof manifest.exports === "object" ? manifest.exports : {};
    for (const [specifier, target] of Object.entries(exports)) {
      rows.push({ package: manifest.name, specifier, target: typeof target === "string" ? target : "conditional export" });
    }
  }
  return rows.sort((a, b) => `${a.package}:${a.specifier}`.localeCompare(`${b.package}:${b.specifier}`));
}

export function parseStringObject(root, source, symbol) {
  const text = readFileSync(path.join(root, source), "utf8");
  const match = new RegExp(`(?:const|export const)\\s+${symbol}[^=]*=\\s*\\{([\\s\\S]*?)\\}\\s+as const`).exec(text);
  if (!match) throw new Error(`Could not statically parse ${symbol} in ${source}`);
  return [...match[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*["']([^"']+)["']/g)]
    .map(([, name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function routeLiterals(root, source) {
  const text = readFileSync(path.join(root, source), "utf8");
  const values = new Set();
  for (const match of text.matchAll(/\bpath:\s*["'`]([^"'`$]+)["'`]/g)) values.add(match[1]);
  return [...values].sort();
}

export function indexerContracts(root, source) {
  const text = readFileSync(path.join(root, source), "utf8");
  return [...text.matchAll(/^\s{2}- name:\s*([^\s#]+)\s*$/gm)].map((match) => match[1]).sort();
}

// Secrets never belong in an artifact, and operator identities (owners, deployers, lock
// managers, safes, signers) never belong on a public page. `transferManager` is a contract,
// hence the anchored manager forms.
const BLOCKED_FIELD = /(secret|private.?key|password|mnemonic|api.?key|auth.?token|access.?token|owner|deployer|^manager|managers|safe|multisig|sender|signer)/i;
const ADDRESS_VALUE = /^0x[a-fA-F0-9]{40}$/;
const ZERO_ADDRESS = /^0x0{40}$/i;
const SCHEMA_UID = /^0x[a-fA-F0-9]{64}$/;
const ZERO_UID = /^0x0{64}$/i;

function assertSafePath(key) {
  for (const segment of key.split(".")) {
    if (BLOCKED_FIELD.test(segment)) throw new Error(`Unsafe deployment field requested: ${key}`);
  }
}

/**
 * The addresses and schema UIDs a public page may print from one artifact: every top-level
 * address field plus an explicit allowlist of nested records. Nothing else nested is read, so
 * operator identities under `greenWillConfig`, `unlock.managerDefaults`, or `greenWillBadges.owner`
 * never reach the page. Entries keep zero values flagged so a page can list them without linking.
 */
export function collectRenderableAddresses(artifact) {
  const entries = [];
  const addAddress = (key, value, label = key) => {
    assertSafePath(key);
    if (value === undefined || value === null) return;
    if (typeof value !== "string" || !ADDRESS_VALUE.test(value)) {
      throw new Error(`Malformed deployment address for ${key}: ${String(value)}`);
    }
    entries.push({ key, label, kind: "address", value, recorded: !ZERO_ADDRESS.test(value) });
  };
  for (const [field, value] of Object.entries(artifact)) {
    if (BLOCKED_FIELD.test(field)) continue;
    if (typeof value === "string" && ADDRESS_VALUE.test(value)) addAddress(field, value);
  }
  addAddress("eas.address", artifact.eas?.address, "EAS");
  addAddress("eas.schemaRegistry", artifact.eas?.schemaRegistry, "EAS schema registry");
  addAddress("rootGarden.address", artifact.rootGarden?.address, "rootGarden");
  addAddress("unlock.factory", artifact.unlock?.factory, "unlock.factory");
  for (const [name, lock] of Object.entries(artifact.unlock?.locks ?? {})) {
    addAddress(`unlock.locks.${name}.address`, lock?.address, `Unlock lock: ${typeof lock?.name === "string" ? lock.name : name}`);
  }
  addAddress("greenWillBadges.implementation", artifact.greenWillBadges?.implementation, "greenWillBadges (implementation)");
  for (const group of ["poolingLibraries", "settlementLibraries"]) {
    for (const [name, value] of Object.entries(artifact[group] ?? {})) addAddress(`${group}.${name}`, value, name);
  }
  for (const [field, value] of Object.entries(artifact.schemas ?? {})) {
    const match = /^(.*)SchemaUID$/.exec(field);
    if (!match) continue;
    const key = `schemas.${field}`;
    assertSafePath(key);
    if (typeof value !== "string" || !SCHEMA_UID.test(value)) throw new Error(`Malformed schema UID for ${key}: ${String(value)}`);
    const name = artifact.schemas[`${match[1]}Name`];
    entries.push({ key, label: typeof name === "string" && name ? name : match[1], kind: "schema", value, recorded: !ZERO_UID.test(value) });
  }
  return entries;
}

export function networkExplorers(root, source) {
  const config = readJson(root, source);
  const explorers = new Map();
  for (const network of Object.values(config.networks ?? {})) {
    if (Number.isInteger(network?.chainId) && typeof network?.blockExplorer === "string" && network.blockExplorer) {
      explorers.set(Number(network.chainId), network.blockExplorer.replace(/\/+$/, ""));
    }
  }
  return explorers;
}

export function selectSafeFields(value, allowlist) {
  const selected = {};
  for (const field of allowlist) {
    if (BLOCKED_FIELD.test(field)) throw new Error(`Unsafe configuration field requested: ${field}`);
    const projected = value?.[field];
    if (typeof projected === "string" || typeof projected === "number" || typeof projected === "boolean") {
      selected[field] = projected;
    }
  }
  return selected;
}

export function selectSafeAddressFields(value, allowlist) {
  const selected = {};
  for (const field of allowlist) {
    if (BLOCKED_FIELD.test(field)) throw new Error(`Unsafe configuration field requested: ${field}`);
    const projected = value?.[field];
    if (projected === undefined || projected === null) continue;
    if (typeof projected !== "string" || !ADDRESS_VALUE.test(projected)) {
      throw new Error(`Malformed deployment address for ${field}: ${String(projected)}`);
    }
    selected[field] = projected;
  }
  return selected;
}

export function deploymentAddressFields(root, sources) {
  const deployments = sources.map((source) => readJson(root, source));
  const candidates = new Set();
  for (const deployment of deployments) {
    for (const [field, value] of Object.entries(deployment)) {
      if (BLOCKED_FIELD.test(field)) continue;
      if (value === null || (typeof value === "string" && ADDRESS_VALUE.test(value))) {
        candidates.add(field);
      }
    }
  }
  const fields = [...candidates].sort();
  for (const deployment of deployments) selectSafeAddressFields(deployment, fields);
  return fields;
}

export function supportedChainIds(root, source) {
  const text = readFileSync(path.join(root, source), "utf8");
  const body = /SUPPORTED_CHAINS\s*=\s*\{([\s\S]*?)\}\s*as const/.exec(text)?.[1];
  if (!body) throw new Error(`Could not statically parse SUPPORTED_CHAINS in ${source}`);
  const ids = [...body.matchAll(/^\s*(\d+)\s*:/gm)].map((match) => Number(match[1]));
  if (ids.length === 0) throw new Error(`SUPPORTED_CHAINS in ${source} contains no numeric chain IDs`);
  return [...new Set(ids)].sort((a, b) => a - b);
}

export function networkNames(root, source) {
  const config = readJson(root, source);
  const names = new Map();
  for (const network of Object.values(config.networks ?? {})) {
    if (Number.isInteger(network?.chainId) && typeof network?.name === "string" && network.name) {
      names.set(Number(network.chainId), network.name);
    }
  }
  return names;
}

export function workflowSourcePaths(root, directory = ".github/workflows") {
  return readdirSync(path.join(root, directory))
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => `${directory}/${name}`);
}

export function sourcePathsContaining(root, directory, needle) {
  const matches = [];
  const visit = (relativeDirectory) => {
    for (const entry of readdirSync(path.join(root, relativeDirectory), { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) visit(relativePath);
      else if (entry.isFile() && entry.name.endsWith(".ts")) {
        const text = readFileSync(path.join(root, relativePath), "utf8");
        if (text.includes(needle)) matches.push(relativePath);
      }
    }
  };
  visit(directory);
  return matches.sort();
}

export function publicRouteRegistrations(root, sources) {
  const registrations = new Map();
  for (const source of sources) {
    const text = readFileSync(path.join(root, source), "utf8");
    for (const match of text.matchAll(
      /\bapp\.(get|post|put|patch|delete|options)\(\s*(?:PUBLIC_AGENT_ROUTES\.([A-Za-z_$][\w$]*)|["']([^"']+)["'])/g,
    )) {
      const route = match[2] ?? match[3];
      const methods = registrations.get(route) ?? new Set();
      methods.add(match[1].toUpperCase());
      registrations.set(route, methods);
    }
  }
  return new Map(
    [...registrations.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, methods]) => [name, [...methods].sort()]),
  );
}

export function workflowInventory(root, sources = workflowSourcePaths(root)) {
  return sources
    .map((source) => {
      const name = path.basename(source);
      const text = readFileSync(path.join(root, source), "utf8");
      const display = /^name:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? name;
      const jobsSection = text.split(/^jobs:\s*$/m)[1] ?? "";
      const jobs = [...jobsSection.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)].map((match) => match[1]).sort();
      return { source, name, display, jobs };
    });
}

export function deploymentInventory(root, sources, fields) {
  return sources.map((source) => {
    const chainId = path.basename(source).split("-")[0];
    const deployment = readJson(root, source);
    return { chainId, source, values: selectSafeAddressFields(deployment, fields) };
  });
}

export function isRecordedAddress(value) {
  return typeof value === "string" && ADDRESS_VALUE.test(value) && !ZERO_ADDRESS.test(value);
}

export function readText(root, source) {
  return readFileSync(path.join(root, source), "utf8");
}

export function skillCatalogSources(root) {
  const skillsRoot = ".claude/skills";
  const sources = [];
  for (const entry of readdirSync(path.join(root, skillsRoot), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = `${skillsRoot}/${entry.name}/SKILL.md`;
    if (!existsSync(path.join(root, skillFile))) continue;
    sources.push(skillFile);
    const readme = `${skillsRoot}/${entry.name}/README.md`;
    if (existsSync(path.join(root, readme))) sources.push(readme);
  }
  return sources.sort();
}
