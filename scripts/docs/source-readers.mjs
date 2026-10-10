import { readFileSync, readdirSync } from "node:fs";
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

const BLOCKED_FIELD = /(secret|private.?key|password|mnemonic|api.?key|auth.?token|access.?token)/i;
const ADDRESS_VALUE = /^0x[a-fA-F0-9]{40}$/;
const ZERO_ADDRESS = /^0x0{40}$/i;

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
