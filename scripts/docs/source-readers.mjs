import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// CI Gate imports this module graph before any package is installed (the selector suite in
// scripts/quality/select-validation.test.mjs reads the projection sources), so nothing here may
// load a package at import time. The YAML parser is resolved where a workflow is parsed, which
// only the generator and its own tests do, after an install.
const requirePackage = createRequire(import.meta.url);
let yamlParser;
const parseYaml = (text) => (yamlParser ??= requirePackage("js-yaml")).load(text);

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

/**
 * The recorded values for the allowlisted fields, keyed by the field as written. A field may be
 * a dotted path into the artifact (`unlock.locks.genesis.address`); every segment is checked, so
 * a path cannot reach an operator identity through a harmless-looking parent. A field whose name
 * ends in `SchemaUID` holds a schema UID, and every other field an address.
 */
export function selectSafeDeploymentFields(value, allowlist) {
  const selected = {};
  for (const field of allowlist) {
    const segments = field.split(".");
    if (segments.some((segment) => BLOCKED_FIELD.test(segment))) {
      throw new Error(`Unsafe configuration field requested: ${field}`);
    }
    const projected = segments.reduce((node, segment) => node?.[segment], value);
    if (projected === undefined || projected === null) continue;
    const [shape, kind] = field.endsWith("SchemaUID") ? [SCHEMA_UID, "schema UID"] : [ADDRESS_VALUE, "address"];
    if (typeof projected !== "string" || !shape.test(projected)) {
      throw new Error(`Malformed deployment ${kind} for ${field}: ${String(projected)}`);
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
  for (const deployment of deployments) selectSafeDeploymentFields(deployment, fields);
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

function typeScriptSourcePaths(root, directory) {
  const paths = [];
  const visit = (relativeDirectory) => {
    for (const entry of readdirSync(path.join(root, relativeDirectory), { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) visit(relativePath);
      else if (entry.isFile() && entry.name.endsWith(".ts")) paths.push(relativePath);
    }
  };
  visit(directory);
  return paths.sort();
}

const IDENTIFIER = "[A-Za-z_$][\\w$]*";
const ROUTE_VERBS = ["get", "post", "put", "patch", "delete", "options"];
// Calls on the Hono app that configure it without registering a route. Any other call
// (`all`, `on`, `route`, `mount`) could register one, so the reader refuses it until it is taught.
const NON_ROUTE_APP_CALLS = new Set(["use", "onError", "notFound", "fetch"]);

/**
 * Route path constants the given Shared contract files export, keyed by the name a caller
 * writes: `NAME` for `export const NAME = "/path"`, and `NAME.key` for each path in a flat
 * `export const NAME = { key: "/path" } as const` map.
 */
export function routeConstants(root, sources) {
  const constants = new Map();
  const add = (name, routePath, source) => {
    if (constants.has(name)) {
      throw new Error(`Route constant ${name} is exported by both ${constants.get(name).source} and ${source}`);
    }
    constants.set(name, { path: routePath, source });
  };
  for (const source of sources) {
    const text = readFileSync(path.join(root, source), "utf8");
    for (const [, name, routePath] of text.matchAll(
      new RegExp(`export const\\s+(${IDENTIFIER})\\s*(?::[^=;]+)?=\\s*["'](/[^"']*)["']`, "g"),
    )) add(name, routePath, source);
    for (const [, name, members] of text.matchAll(
      new RegExp(`export const\\s+(${IDENTIFIER})\\s*(?::[^=;]+)?=\\s*\\{([^{}]*)\\}\\s*as const`, "g"),
    )) {
      for (const [, key, routePath] of members.matchAll(new RegExp(`(${IDENTIFIER})\\s*:\\s*["'](/[^"']*)["']`, "g"))) {
        add(`${name}.${key}`, routePath, source);
      }
    }
  }
  if (constants.size === 0) throw new Error(`No route constants found in ${sources.join(", ")}`);
  return constants;
}

/**
 * Every route one Agent API file registers on the Hono app, as `{ source, method, path }`. The
 * app is recognized by the name every route module gives it, `app`.
 *
 * The path argument is resolved statically: a string literal, a template literal, a route
 * constant from `constants`, or a name the same file binds with `const name = <literal>` or
 * `for (const name of [<paths>])`. Anything else throws, so a route cannot drop out of the
 * index because it was registered in a new way. Names are matched per file, not per scope: a
 * name bound more than once is refused rather than guessed.
 */
export function agentRouteRegistrations(root, source, constants) {
  // Whole-line comments are dropped so an example in a doc comment is not read as a route.
  const text = readFileSync(path.join(root, source), "utf8")
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join("\n");
  const fail = (message) => {
    throw new Error(`${source}: ${message}. Teach agentRouteRegistrations in scripts/docs/source-readers.mjs.`);
  };
  for (const [, call] of text.matchAll(/\bapp\.([A-Za-z_$][\w$]*)\(/g)) {
    if (!ROUTE_VERBS.includes(call) && !NON_ROUTE_APP_CALLS.has(call)) {
      fail(`app.${call}() may register a route the reader cannot see`);
    }
  }

  const bindings = new Map();
  const bind = (name, expressions) => bindings.set(name, [...(bindings.get(name) ?? []), expressions]);
  for (const [, name, expression] of text.matchAll(
    new RegExp(`\\bconst\\s+(${IDENTIFIER})\\s*=\\s*("[^"\\n]*"|'[^'\\n]*'|\`[^\`\\n]*\`)(?:\\s+as const)?\\s*;`, "g"),
  )) bind(name, [expression]);
  for (const [, name, list] of text.matchAll(
    new RegExp(`\\bfor\\s*\\(\\s*const\\s+(${IDENTIFIER})\\s+of\\s+\\[([^\\]]*)\\]\\s*\\)`, "g"),
  )) bind(name, list.split(",").map((item) => item.trim()).filter(Boolean));

  const resolve = (expression, trail = []) => {
    const literal = /^(?:"([^"]*)"|'([^']*)')$/.exec(expression);
    if (literal) return [literal[1] ?? literal[2]];
    const template = /^`([^`]*)`$/.exec(expression);
    if (template) {
      // Odd parts are the `${...}` expressions; each contributes every path it can resolve to.
      return template[1].split(/\$\{([^}]*)\}/).reduce(
        (paths, part, index) => {
          const values = index % 2 === 0 ? [part] : resolve(part.trim(), trail);
          return paths.flatMap((prefix) => values.map((value) => prefix + value));
        },
        [""],
      );
    }
    if (constants.has(expression)) return [constants.get(expression).path];
    const bound = bindings.get(expression);
    if (!bound) fail(`cannot resolve the route path \`${expression}\``);
    if (bound.length > 1) fail(`the route path name \`${expression}\` is bound ${bound.length} times in this file`);
    if (trail.includes(expression)) fail(`the route path name \`${expression}\` refers to itself`);
    return [...new Set(bound[0].flatMap((item) => resolve(item, [...trail, expression])))];
  };

  const registrations = [];
  const argument = /\s*([^,()]+?)\s*,/y;
  for (const match of text.matchAll(new RegExp(`\\bapp\\.(${ROUTE_VERBS.join("|")})\\(`, "g"))) {
    argument.lastIndex = match.index + match[0].length;
    const expression = argument.exec(text)?.[1];
    if (!expression) fail(`cannot read the path argument of app.${match[1]}()`);
    for (const routePath of resolve(expression)) {
      registrations.push({ source, method: match[1].toUpperCase(), path: routePath });
    }
  }
  return registrations;
}

/** A route is public when it sits under `/public/` or a Shared route contract names its path. */
function publicRoutePredicate(constants) {
  const contractPaths = new Set([...constants.values()].map((constant) => constant.path));
  return (routePath) => routePath.startsWith("/public/") || contractPaths.has(routePath);
}

/** The Agent API files under `directory` that register at least one public route. */
export function publicAgentRouteSources(root, directory, contractSources) {
  const constants = routeConstants(root, contractSources);
  const isPublic = publicRoutePredicate(constants);
  return typeScriptSourcePaths(root, directory).filter((source) =>
    agentRouteRegistrations(root, source, constants).some((registration) => isPublic(registration.path)),
  );
}

/**
 * One row per public route path: the methods the agent registers for it, the Shared constants
 * that name it, and the files that register it. A contract path nobody registers keeps its row
 * with no methods, which is how a contract that has drifted from the agent shows up.
 */
export function publicAgentRoutes(root, agentSources, contractSources) {
  const constants = routeConstants(root, contractSources);
  const isPublic = publicRoutePredicate(constants);
  const rows = new Map();
  const row = (routePath) => {
    if (!rows.has(routePath)) rows.set(routePath, { methods: new Set(), constants: new Set(), sources: new Set() });
    return rows.get(routePath);
  };
  for (const [name, constant] of constants) row(constant.path).constants.add(name);
  for (const source of agentSources) {
    for (const registration of agentRouteRegistrations(root, source, constants)) {
      if (!isPublic(registration.path)) continue;
      row(registration.path).methods.add(registration.method);
      row(registration.path).sources.add(source);
    }
  }
  return [...rows.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([routePath, entry]) => ({
      path: routePath,
      methods: [...entry.methods].sort(),
      constants: [...entry.constants].sort(),
      sources: [...entry.sources].sort(),
    }));
}

export function workflowInventory(root, sources = workflowSourcePaths(root)) {
  return sources.map((source) => {
    const name = path.basename(source);
    const parsed = parseYaml(readFileSync(path.join(root, source), "utf8")) ?? {};
    const display = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : name;
    const jobs = Object.keys(parsed.jobs ?? {}).sort();
    // `on` may be a string, a list of event names, or a map of event to options.
    const declared = parsed.on ?? {};
    const events = typeof declared === "string" ? { [declared]: null } : Array.isArray(declared) ? Object.fromEntries(declared.map((event) => [event, null])) : declared;
    const triggers = {};
    for (const [event, options] of Object.entries(events)) {
      const config = options && typeof options === "object" && !Array.isArray(options) ? options : {};
      triggers[event] = {
        branches: Array.isArray(config.branches) ? config.branches : [],
        tags: Array.isArray(config.tags) ? config.tags : [],
        paths: Array.isArray(config.paths) ? config.paths : [],
        crons: event === "schedule" && Array.isArray(options) ? options.map((entry) => entry?.cron).filter(Boolean) : [],
      };
    }
    return { source, name, display, jobs, triggers };
  });
}

export function deploymentInventory(root, sources, fields) {
  return sources.map((source) => {
    const chainId = path.basename(source).split("-")[0];
    const deployment = readJson(root, source);
    return { chainId, source, values: selectSafeDeploymentFields(deployment, fields) };
  });
}

export function isRecordedAddress(value) {
  return typeof value === "string" && ADDRESS_VALUE.test(value) && !ZERO_ADDRESS.test(value);
}

/** An address or a schema UID that an artifact records as set: well-formed and not all zeros. */
export function isRecordedDeploymentValue(value) {
  return isRecordedAddress(value) || (typeof value === "string" && SCHEMA_UID.test(value) && !ZERO_UID.test(value));
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

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const CONNECTOR_LIST = /^connectors:[ \t]*\n((?:[ \t]+-[^\n]*(?:\n|$))+)/m;

/**
 * Routine documents whose frontmatter declares connectors. Read without a YAML package, because
 * CI Gate lists the projection sources before anything is installed.
 */
export function routineConnectorSources(root, directory) {
  return readdirSync(path.join(root, directory))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `${directory}/${name}`)
    .filter((source) => /^connectors:[ \t]*$/m.test(FRONTMATTER.exec(readText(root, source))?.[1] ?? ""))
    .sort();
}

/**
 * Which routines use each connector, from the routines' own frontmatter: a map from connector id
 * to sorted routine names. A routine that names connectors this cannot read is an error, never
 * a silently shorter list.
 */
export function routineConnectors(root, sources) {
  const routinesByConnector = new Map();
  for (const source of sources) {
    const frontmatter = FRONTMATTER.exec(readText(root, source))?.[1] ?? "";
    const routine = /^routine-name:[ \t]*(\S+)[ \t]*$/m.exec(frontmatter)?.[1];
    const entries = CONNECTOR_LIST.exec(frontmatter)?.[1];
    if (!routine || !entries) throw new Error(`Routine ${source} has no readable routine-name and connectors list`);
    for (const line of entries.trimEnd().split("\n")) {
      const connector = /^[ \t]+-[ \t]*([a-z0-9-]+)[ \t]*(?:#.*)?$/.exec(line)?.[1];
      if (!connector) throw new Error(`Routine ${source} has an unreadable connector entry: ${line.trim()}`);
      routinesByConnector.set(connector, [...(routinesByConnector.get(connector) ?? []), routine]);
    }
  }
  return new Map([...routinesByConnector].map(([connector, routines]) => [connector, routines.sort()]));
}
