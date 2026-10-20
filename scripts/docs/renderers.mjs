import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { GENERATOR_PATH, generatedFrontmatter, regenerationHint } from "./generator-core.mjs";
import { OPERATIONS } from "../../packages/contracts/script/cli/operations.mjs";
import {
  UNLISTED_AGENT_ROUTE_FAMILIES,
  collectRenderableAddresses,
  deploymentInventory,
  indexerContracts,
  isRecordedDeploymentValue,
  networkExplorers,
  networkNames,
  packageExports,
  publicAgentRoutes,
  readJson,
  readText,
  routeConstants,
  routineConnectors,
  workflowInventory,
} from "./source-readers.mjs";
import {
  EXPECTED_MUTATION_BOUNDARIES,
  readTaskRouting,
  validateTaskRouting,
} from "../quality/task-routing-contract.mjs";

const esc = (value) => String(value).replaceAll("|", "\\|").replaceAll("`", "&#96;");
const declaredSource = (sources, source) => {
  if (!sources.includes(source)) throw new Error(`Renderer read is not declared as an authority source: ${source}`);
  return source;
};

function pageHeader(meta, heading, intro, { imports = [] } = {}) {
  const importBlock = imports.length ? `${imports.join("\n")}\n\n` : "";
  return `${generatedFrontmatter(meta)}${importBlock}# ${heading}\n\n${intro}\n\n`;
}

export const COPY_COMMAND_IMPORT = 'import {CopyCommand} from "@site/src/components/docs";';

/**
 * A command a reader can copy from a table cell. The attribute form keeps the text literal in
 * MDX; the five encoded characters are decoded again by the Markdown twins and the guide audit.
 */
export function copyCommand(command) {
  if (/\n/.test(command)) throw new Error(`A copyable command cannot span lines: ${command}`);
  const attribute = String(command)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "&#124;");
  return `<CopyCommand command="${attribute}" />`;
}

// The command inventory reads root first, then the packages a contributor meets in order, then
// docs. Throws when a manifest joins or leaves so the order is a decision, not an accident.
export const COMMAND_MANIFEST_ORDER = [
  "package.json",
  "packages/client/package.json",
  "packages/admin/package.json",
  "packages/agent/package.json",
  "packages/shared/package.json",
  "packages/indexer/package.json",
  "packages/contracts/package.json",
  "packages/qa/package.json",
  "docs/package.json",
];

export function orderCommandManifests(manifestSources) {
  const missing = COMMAND_MANIFEST_ORDER.filter((source) => !manifestSources.includes(source));
  const unlisted = manifestSources.filter((source) => !COMMAND_MANIFEST_ORDER.includes(source));
  if (missing.length || unlisted.length) {
    throw new Error(
      `Command inventory order is out of date. Missing manifests: ${missing.join(", ") || "none"}. Unlisted manifests: ${unlisted.join(", ") || "none"}.`
    );
  }
  return [...COMMAND_MANIFEST_ORDER];
}

const REPO_BLOB = "https://github.com/greenpill-dev-guild/green-goods/blob/develop";

/**
 * The two ways an agent reaches a tool here: MCP servers checked into the repository, and hosted
 * services reached through a connector in the coding app. The second list joins the connector
 * catalog with what each routine declares, and refuses a routine connector the catalog lacks.
 */
export function renderMcpGuide({ root, sources, digest, connectorCatalog, routines }) {
  const config = readJson(root, declaredSource(sources, ".mcp.json"));
  const servers = Object.entries(config.mcpServers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const catalog = readJson(root, declaredSource(sources, connectorCatalog)).connectors;
  const routinesByConnector = routineConnectors(root, routines.map((source) => declaredSource(sources, source)));
  for (const connector of routinesByConnector.keys()) {
    if (!catalog[connector]) throw new Error(`A routine declares the connector "${connector}", which ${connectorCatalog} does not describe`);
  }
  let body = pageHeader(
    { title: "Agent and MCP Guide", slug: "/builders/agentic/mcp-guide", sources, digest },
    "Agent and MCP Guide",
    "An agent reaches tools in two ways here. MCP servers checked into this repository start with the project for anyone who clones it. Connected services are hosted tools, such as the backlog, telemetry, and deployments, that an agent reaches through a connector in the coding app, signed in by the person using it. Repository guidance says how each may be used."
  );
  body += "```mermaid\nflowchart LR\n  A[Repository task] --> B[Configured MCP server]\n  A --> C[Connected service]\n  B --> D[Authorized tool]\n  C --> D\n  D --> E[Evidence and review]\n```\n\n";
  body += "## MCP servers in this repository\n\nProjected from the checked-in MCP configuration, `.mcp.json`.\n\n";
  body += "| Server | Command | Arguments | Scope | Surfaces |\n|---|---|---|---|---|\n";
  for (const [name, server] of servers) {
    const access = config.agentAccess?.[name] ?? {};
    body += `| ${esc(name)} | \`${esc(server.command ?? "—")}\` | ${Array.isArray(server.args) ? server.args.map((arg) => `\`${esc(arg)}\``).join(" ") : "—"} | ${esc(access.scope ?? "—")} | ${Array.isArray(access.surfaces) ? access.surfaces.map(esc).join(", ") : "—"} |\n`;
  }
  body += "\n### Safety boundary {#safety-boundary}\n\n";
  for (const [name] of servers) {
    for (const note of config.agentAccess?.[name]?.notes ?? []) body += `- ${esc(note)}\n`;
  }
  body += "\n## Connected services\n\n";
  body += "These are not in `.mcp.json`, and the routines' rules say to keep it that way. Each person connects them once in their coding app (Claude Code or Codex), and an agent may then use them inside the limits its guide sets. The third column is read from the connectors each scheduled routine declares; working sessions use the same services under the same rules.\n\n";
  body += "| Service | What agents use it for | Routines that declare it | Rules |\n|---|---|---|---|\n";
  for (const [id, entry] of Object.entries(catalog)) {
    if (!existsSync(path.join(root, entry.rules))) throw new Error(`Connector ${id} points at a rules file that does not exist: ${entry.rules}`);
    const users = routinesByConnector.get(id) ?? [];
    body += `| ${esc(entry.display)} | ${esc(entry.purpose)} | ${users.length ? users.map((name) => `\`${esc(name)}\``).join(", ") : "none"} | [${esc(entry.rules)}](${REPO_BLOB}/${entry.rules}) |\n`;
  }
  body += `\nThe routine definitions live in [docs/routines](${REPO_BLOB.replace("/blob/", "/tree/")}/docs/routines), each with the connectors it may use in its frontmatter.\n`;
  return body;
}

export function renderApiIndex({ root, sources, digest, manifests, agentApi, routeContracts, routeSources }) {
  const declared = (paths) => paths.map((source) => declaredSource(sources, source));
  const exports = packageExports(root, declared(manifests));
  const contractSources = declared(routeContracts);
  const routes = publicAgentRoutes(root, declared(routeSources), contractSources);
  const code = (value) => `\`${esc(value)}\``;
  const list = (values, empty) => (values.length ? values.map(code).join(", ") : empty);
  let body = pageHeader(
    { title: "API Index", slug: "/builders/packages/api-index", sources, digest },
    "API Index",
    "Use package export specifiers and public route constants as the stable entrypoints. Source-file imports bypass package boundaries and are not public APIs."
  );
  body += "[Runnable command inventory](./commands) is generated from the workspace manifests.\n\n";
  body += `## Public Agent routes\n\nEvery route the agent registers under \`/public/\`, and every route a shared route contract names, with the methods registered for each. The table is read from the route registrations in \`${agentApi}/\`, so a route is listed whether or not Shared exports a constant for its path. Where a constant exists, import it instead of writing the path. Files are relative to \`${agentApi}/\`.\n\n| Path | Registered methods | Shared constant | Registered in |\n|---|---|---|---|\n`;
  for (const route of routes) {
    const files = route.sources.map((source) => source.slice(agentApi.length + 1));
    body += `| ${code(route.path)} | ${list(route.methods, "not registered")} | ${list(route.constants, "none")} | ${list(files, "none")} |\n`;
  }
  // Said only while it is true: some route groups are registered behind a startup condition.
  if (routeSources.some((source) => /\bif \([^)]*\) \{\s*register[A-Za-z]+Routes\(/.test(readText(root, source)))) {
    body += "\nA listed route can still answer 404 on a given deployment: the server leaves a route group out at startup when its feature is off or not configured.\n";
  }
  // The reader refuses an unlisted route outside these families, so this sentence stays complete.
  const unlisted = UNLISTED_AGENT_ROUTE_FAMILIES.map((family) => family.described);
  body += `\nThe agent also registers routes that are not public contracts, and this table leaves them out: ${unlisted.slice(0, -1).join("; ")}; and ${unlisted.at(-1)}.\n`;
  const symbolsBySource = new Map(contractSources.map((source) => [source, new Set()]));
  for (const [name, constant] of routeConstants(root, contractSources)) {
    symbolsBySource.get(constant.source).add(name.split(".")[0]);
  }
  body += "\nThe route constants are exported by these Shared files:\n\n";
  for (const [source, symbols] of symbolsBySource) body += `- \`${source}\`: ${list([...symbols].sort(), "none")}\n`;
  body += `\n## Package exports\n\n${renderPackageExports(exports)}`;
  return body;
}

// A package with this many specifiers or fewer is one plain table.
const FLAT_EXPORT_LIMIT = 12;
// A group smaller than this joins "Other entry points", so the page is not a column of one-row sections.
const SMALL_EXPORT_GROUP = 4;
// A group larger than this is split by its second path segment, so an opened group can still be scanned.
const LARGE_EXPORT_GROUP = 40;

function exportTable(items) {
  return `| Specifier | Target |\n|---|---|\n${items.map((item) => `| \`${esc(item.specifier)}\` | \`${esc(item.target)}\` |\n`).join("")}`;
}

/** `./hooks/auth/useAuth` has segments `hooks`, `auth`, `useAuth`; the package root `.` has none. */
const exportSegments = (specifier) => specifier.split("/").slice(1);

/**
 * The export map by package. A large package is summarized as a table of groups (the first path
 * segment under the package root) with each group collapsed beneath it, because several hundred
 * rows in one table is a page nobody can scan.
 */
export function renderPackageExports(exports) {
  const packages = Map.groupBy(exports, (item) => item.package);
  let body = `${exports.length} export specifiers across ${packages.size} ${packages.size === 1 ? "package" : "packages"}. A specifier is the import path; the target is the file it resolves to.\n\n`;
  for (const [name, items] of packages) {
    body += `### ${esc(name)}\n\n`;
    if (items.length <= FLAT_EXPORT_LIMIT) {
      body += `${exportTable(items)}\n`;
      continue;
    }
    const bySegment = Map.groupBy(items, (item) => exportSegments(item.specifier)[0] ?? "");
    const groups = [...bySegment].filter(([, members]) => members.length >= SMALL_EXPORT_GROUP);
    const others = [...bySegment].filter(([, members]) => members.length < SMALL_EXPORT_GROUP).flatMap(([, members]) => members);
    body += `${items.length} specifiers. Open a group to see its specifiers.\n\n| Group | Specifiers |\n|---|---|\n`;
    for (const [segment, members] of groups) body += `| \`./${esc(segment)}\` | ${members.length} |\n`;
    if (others.length) body += `| Other entry points | ${others.length} |\n`;
    body += "\n";
    for (const [segment, members] of groups) {
      // A code span, not a <code> tag: MDX reads the text inside a tag as Markdown, where the
      // underscores of `__tests__` would turn into bold.
      body += `<details>\n<summary>\`./${esc(segment)}\` (${members.length})</summary>\n\n`;
      if (members.length > LARGE_EXPORT_GROUP) {
        // A specifier with nothing under the group's own folder is listed with the group itself.
        const byArea = Map.groupBy(members, (item) => (exportSegments(item.specifier).length > 2 ? exportSegments(item.specifier)[1] : ""));
        for (const [area, rows] of byArea) body += `**\`./${esc(segment)}${area ? `/${esc(area)}` : ""}\`** (${rows.length})\n\n${exportTable(rows)}\n`;
      } else {
        body += `${exportTable(members)}\n`;
      }
      body += "</details>\n\n";
    }
    if (others.length) body += `<details>\n<summary>Other entry points (${others.length})</summary>\n\n${exportTable(others)}\n</details>\n\n`;
  }
  return body;
}

// Each product surface, in display order, with its name on the page and what it is. The
// renderer throws on a surface a persona journey names but this table does not.
const SURFACES = [
  ["admin", "Admin cockpit", "the steward cockpit at admin.greengoods.app, where gardens, actions, reviews, and pools are run"],
  ["client", "Client app", "the installed app at greengoods.app, where work is captured, tracked, and reviewed in the field"],
  ["agent", "Messaging agent", "the Telegram bot, for people who would rather message than install anything"],
  ["public", "Public site", "the browser website at greengoods.app, where anyone reads gardens and impact and can fund them"],
  ["community", "Community channels", "the Telegram and Discord spaces around the product"],
  ["docs", "Docs", "this site"],
];

// What the page says about an interaction that relies on something people cannot use yet, from
// the furthest away to the nearest. An interaction takes the furthest status among its terms.
const UNAVAILABLE_NOTES = [
  ["vision", "An idea, not planned yet."],
  ["planned", "Planned, not built yet."],
  ["in-build", "Still being built."],
  ["deployed-not-available", "Deployed, not switched on yet."],
];

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/**
 * The personas page: who each persona is, then what they do, when, and on which surface. The
 * sidecar owns a persona's name, hat and definition; the projection data owns the plain-language
 * context and the journey, and each interaction's availability comes from the capabilities it
 * names, so the page cannot call something usable that the ontology says is still planned.
 */
export function renderPersonas({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  const projections = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-projections.json"));
  const surfaceNames = new Map(SURFACES.map(([id, name]) => [id, name]));
  const conceptByRef = new Map(projections.human_concepts.map((item) => [item.ref, item]));
  const journeyByRef = new Map(projections.persona_journeys.map((item) => [item.ref, item]));
  const availabilityByRef = new Map(projections.capabilities.map((item) => [item.ref, item.availability]));
  const personas = ontology.personas.map((persona) => {
    const ref = `persona:${persona.id}`;
    const concept = conceptByRef.get(ref);
    const journey = journeyByRef.get(ref);
    if (!concept || !journey) throw new Error(`Persona ${persona.id} has no ${concept ? "journey" : "human concept"} in the projection data`);
    for (const engagement of journey.engagements) {
      for (const surface of engagement.where) {
        if (!surfaceNames.has(surface)) throw new Error(`Persona ${persona.id} works on a surface without a name: ${surface}`);
      }
    }
    return { persona, concept, journey };
  });
  const usedBy = (journey) => SURFACES.filter(([id]) => journey.engagements.some((engagement) => engagement.where.includes(id)));
  const used = SURFACES.filter(([id]) => personas.some(({ journey }) => usedBy(journey).some(([surface]) => surface === id)));
  const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
  const names = (list) => list.map(([, name]) => name).join(", ");

  let body = pageHeader(
    { title: "Personas and Surfaces", slug: "/builders/architecture/personas", sources, digest },
    "Personas and Surfaces",
    `Green Goods is built for ${COUNT_WORDS[personas.length] ?? personas.length} kinds of people. Each one is tied to an on-chain hat, which is how the contracts know who may do what. This page says who each of them is, what they do, when they do it, and on which surface. It is generated from the ontology, so it stays in step with the product's own vocabulary. Read it before the work-submission trace, which names these actors at every step.`
  );
  body += "## At a glance\n\n| Persona | In one line | Works in |\n|---|---|---|\n";
  for (const { persona, concept, journey } of personas) {
    body += `| [${esc(persona.display)}](#${persona.id}) | ${esc(concept.plain_name)} | ${names(usedBy(journey))} |\n`;
  }
  body += "\nThe surfaces are:\n\n";
  for (const [, name, blurb] of used) body += `- **${name}**: ${blurb}.\n`;
  body += "\n";

  for (const { persona, concept, journey } of personas) {
    body += `## ${esc(persona.display)} {#${persona.id}}\n\n`;
    body += `${journey.context} ${sentence(concept.why_it_matters)}\n\n`;
    body += `- **On-chain role:** the \`${esc(persona.hat)}\` hat.\n`;
    body += `- **Definition:** ${esc(persona.definition)}\n`;
    if (concept.aliases.length) body += `- **Also called:** ${concept.aliases.map(esc).join(", ")}.\n`;
    if (concept.not_confused_with.length) body += `- **Not the same as:** ${concept.not_confused_with.map(esc).join(", ")}.\n`;
    body += "\n| When | What they do | Where |\n|---|---|---|\n";
    for (const engagement of journey.engagements) {
      const statuses = (engagement.term_refs ?? []).map((ref) => availabilityByRef.get(ref));
      const note = UNAVAILABLE_NOTES.find(([status]) => statuses.includes(status))?.[1];
      const guide = engagement.guide ? ` [Guide](${engagement.guide}).` : "";
      const where = names(SURFACES.filter(([id]) => engagement.where.includes(id))) || "None";
      body += `| ${esc(engagement.when)} | ${esc(sentence(engagement.what))}${note ? ` *${note}*` : ""}${guide} | ${where} |\n`;
    }
    const anchored = journey.engagements.filter((engagement) => engagement.code.length);
    if (anchored.length) {
      body += `\n<details>\n<summary>Where this lives in the code</summary>\n\n`;
      for (const engagement of anchored) {
        body += `- **${esc(engagement.when)}**: ${engagement.code.map((file) => `\`${esc(file)}\``).join(", ")}\n`;
      }
      body += "\n</details>\n";
    }
    body += "\n";
  }

  if (ontology.personas_note) body += `## The owner\n\n${ontology.personas_note}\n\n`;
  body += "Which surfaces may *name* a persona, in copy and in data, is a separate vocabulary rule. The [formal ontology](/reference/ontology#personas) carries it in its surfaces column.\n";
  return body;
}


function deploymentState(values, fields) {
  const present = fields.filter((field) => isRecordedDeploymentValue(values[field]));
  if (present.length === fields.length) return "Deployed";
  if (present.length > 0) return "Partial";
  return "Not deployed";
}

// EAS runs one explorer per network. A network with recorded EAS data and no entry here fails
// the generator rather than printing a UID nobody can open.
const EAS_EXPLORERS = new Map([
  [1, "https://easscan.org"],
  [42161, "https://arbitrum.easscan.org"],
  [42220, "https://celo.easscan.org"],
  [11155111, "https://sepolia.easscan.org"],
]);

// Production networks first, then the testnet; a newly supported chain lands at the end by id.
const NETWORK_ORDER = [42161, 42220, 1, 11155111];

// Every top-level address field in an artifact must land in exactly one group, so a new
// contract fails loudly here instead of appearing unlabelled or not at all.
const ADDRESS_GROUPS = [
  {
    title: "Core protocol",
    intro: "Gardens, their accounts, the registries, and the guardian.",
    fields: [
      "gardenToken",
      "accountProxy",
      "gardenAccountImpl",
      "rootGarden.address",
      "actionRegistry",
      "deploymentRegistry",
      "guardian",
      "gardenerRegistry",
      "gardenerAccountLogic",
      "unifiedPowerRegistry",
      "yieldSplitter",
      "greenGoodsENS",
      "ensReceiver",
      "previousEnsReceiver",
    ],
  },
  {
    title: "EAS resolvers",
    intro: "The contracts that check authorization before EAS records a Work, Work Approval, Assessment, or Testimony.",
    fields: ["workResolver", "workApprovalResolver", "assessmentResolver", "testimonyResolver", "testimonyResolverImpl"],
  },
  {
    title: "EAS core",
    intro: "The Ethereum Attestation Service contracts this network's records live in.",
    fields: ["eas.address", "eas.schemaRegistry"],
  },
  { title: "EAS schemas", intro: "The schema each record kind is written against.", kind: "schema", fields: [] },
  {
    title: "Modules and integrations",
    intro: "Capabilities wired to the garden token on this network, and the partner contracts behind them.",
    fields: [
      "hatsModule",
      "karmaGAPModule",
      "gardensModule",
      "octantModule",
      "octantFactory",
      "cookieJarModule",
      "cookieJarFactory",
      "hypercertsModule",
      "hypercertMinter",
      "hypercertExchange",
      "marketplaceAdapter",
      "transferManager",
      "strategyHypercertFractionOffer",
      "greenWill",
      "greenWillBadges.implementation",
      "unlock.factory",
    ],
    prefixes: ["unlock.locks."],
  },
  {
    title: "Commitment pooling and settlement",
    intro: "Pools, registries, settlement, and their upgradeable implementations.",
    fields: [
      "commitmentPoolingModule",
      "commitmentPoolingModuleImpl",
      "commitmentRegistry",
      "commitmentRegistryImpl",
      "creditRegistry",
      "creditRegistryImpl",
      "settlementModule",
      "settlementModuleImpl",
      "celoSettlementExecutor",
      "celoSettlementExecutorImpl",
    ],
  },
  {
    title: "Linked libraries",
    intro: "External libraries the pooling and settlement modules link against.",
    fields: [],
    prefixes: ["poolingLibraries.", "settlementLibraries."],
    collapsed: true,
  },
];

export function assignAddressGroups(entries, groups = ADDRESS_GROUPS) {
  const groupOf = new Map();
  const problems = [];
  for (const entry of entries) {
    const matches = groups.filter(
      (group) => group.fields.includes(entry.key) || (group.prefixes ?? []).some((prefix) => entry.key.startsWith(prefix))
    );
    if (matches.length === 1) groupOf.set(entry.key, matches[0].title);
    else problems.push(`${entry.key} (${matches.length} groups)`);
  }
  if (problems.length > 0) throw new Error(`Deployment address grouping is out of date: ${problems.join(", ")}.`);
  return groupOf;
}

const explorerHost = (url) => new URL(url).host;

// Reader-facing names for the artifact keys. Schemas, libraries and locks already carry their own
// names from the artifact; a top-level key missing here falls back to its words.
const CONTRACT_LABELS = {
  accountProxy: "ERC-6551 account proxy",
  actionRegistry: "Action registry",
  assessmentResolver: "Assessment resolver",
  celoSettlementExecutor: "Celo settlement executor",
  commitmentPoolingModule: "Commitment pooling module",
  commitmentRegistry: "Commitment registry",
  cookieJarFactory: "Cookie Jar factory (1Hive)",
  cookieJarModule: "Cookie Jar module",
  creditRegistry: "Credit registry",
  deploymentRegistry: "Deployment registry",
  ensReceiver: "ENS receiver",
  gardenAccountImpl: "Garden account implementation (ERC-6551)",
  gardenToken: "Garden token (ERC-721)",
  gardensModule: "Gardens module",
  greenGoodsENS: "Green Goods ENS registry",
  greenWill: "GreenWill badge registry",
  "greenWillBadges.implementation": "GreenWill badges (implementation)",
  guardian: "Guardian",
  hatsModule: "Hats module",
  hypercertExchange: "Hypercert exchange",
  hypercertMinter: "Hypercert minter",
  hypercertsModule: "Hypercerts module",
  karmaGAPModule: "Karma GAP module",
  marketplaceAdapter: "Marketplace adapter",
  octantFactory: "Octant vault factory",
  octantModule: "Octant module",
  previousEnsReceiver: "ENS receiver (previous)",
  rootGarden: "Root garden",
  "rootGarden.address": "Root garden",
  settlementModule: "Settlement module",
  strategyHypercertFractionOffer: "Hypercert fraction offer strategy",
  testimonyResolver: "Testimony resolver",
  transferManager: "Transfer manager",
  unifiedPowerRegistry: "Unified power registry",
  "unlock.factory": "Unlock factory",
  workApprovalResolver: "Work approval resolver",
  workResolver: "Work resolver",
  yieldSplitter: "Yield splitter",
};

const wordsOf = (key) => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^[a-z]/, (c) => c.toUpperCase());
const baseLabel = (key) => CONTRACT_LABELS[key] ?? wordsOf(key);

function contractLabel(entry, keys) {
  if (entry.key.endsWith("Impl") && keys.has(entry.key.slice(0, -4))) return `${baseLabel(entry.key.slice(0, -4))} (implementation)`;
  if (keys.has(`${entry.key}Impl`)) return `${baseLabel(entry.key)} (proxy)`;
  if (CONTRACT_LABELS[entry.key]) return CONTRACT_LABELS[entry.key];
  if (entry.label === entry.key && /^[a-z][A-Za-z0-9]*$/.test(entry.key)) return wordsOf(entry.key);
  return entry.label;
}

export function renderDeploymentStatus({ root, sources, digest }) {
  const networksSource = declaredSource(sources, "packages/contracts/deployments/networks.json");
  const names = networkNames(root, networksSource);
  const explorers = networkExplorers(root, networksSource);
  const rank = (chainId) => (NETWORK_ORDER.includes(chainId) ? NETWORK_ORDER.indexOf(chainId) : NETWORK_ORDER.length + chainId);
  const networks = sources
    .filter((source) => /deployments\/\d+-latest\.json$/.test(source))
    .map((source) => ({ chainId: Number(/(\d+)-latest\.json$/.exec(source)[1]), entries: collectRenderableAddresses(readJson(root, source)) }))
    .sort((a, b) => rank(a.chainId) - rank(b.chainId));
  let body = pageHeader(
    { title: "Deployments & Addresses", slug: "/builders/reference/deployments", sources, digest },
    "Deployments & Addresses",
    "Every address below comes from the checked-in deployment artifacts (`packages/contracts/deployments/<chainId>-latest.json`), not from live RPC state. A recorded address means a deployment was written down; activation and operational health need their own evidence. The zero address is the artifacts' sentinel for no usable contract, and such fields are listed, not linked. Operator identities, lock managers, safes, and transaction receipts stay off this page by design.",
    { imports: [COPY_COMMAND_IMPORT] }
  );
  for (const network of networks) {
    const name = names.get(network.chainId) ?? String(network.chainId);
    const explorer = explorers.get(network.chainId);
    if (!explorer) throw new Error(`No block explorer configured for chain ${network.chainId} in networks.json`);
    const addresses = network.entries.filter((entry) => entry.kind === "address");
    const schemas = network.entries.filter((entry) => entry.kind === "schema" && entry.recorded);
    const groupOf = assignAddressGroups(addresses);
    const keys = new Set(addresses.map((entry) => entry.key));
    const recorded = addresses.filter((entry) => entry.recorded);
    const eas = EAS_EXPLORERS.get(network.chainId);
    if ((schemas.length > 0 || recorded.some((entry) => entry.key.startsWith("eas."))) && !eas) {
      throw new Error(`No EAS explorer known for chain ${network.chainId}; add it to EAS_EXPLORERS`);
    }
    body += `## ${esc(name)} (${network.chainId})\n\n`;
    body += `${recorded.length} recorded contracts and ${schemas.length} schemas. Addresses open on [${explorerHost(explorer)}](${explorer})${eas ? `; schema UIDs open on [${explorerHost(eas)}](${eas})` : ""}.\n\n`;
    for (const group of ADDRESS_GROUPS) {
      if (group.kind === "schema") {
        if (schemas.length === 0) continue;
        body += `### ${group.title}\n\n${group.intro}\n\n| Schema | UID | Explorer |\n|---|---|---|\n`;
        for (const entry of schemas) body += `| ${esc(entry.label)} | ${copyCommand(entry.value)} | [${explorerHost(eas)}](${eas}/schema/view/${entry.value}) |\n`;
        body += "\n";
        continue;
      }
      const members = recorded.filter((entry) => groupOf.get(entry.key) === group.title);
      if (members.length === 0) continue;
      body += `### ${group.title}\n\n${group.intro}\n\n`;
      if (group.collapsed) body += `<details>\n<summary>${members.length} linked libraries</summary>\n\n`;
      body += "| Contract | Address | Explorer |\n|---|---|---|\n";
      for (const entry of members) {
        body += `| ${esc(contractLabel(entry, keys))} | ${copyCommand(entry.value)} | [${explorerHost(explorer)}](${explorer}/address/${entry.value}) |\n`;
      }
      body += group.collapsed ? "\n</details>\n\n" : "\n";
    }
    const zero = addresses.filter((entry) => !entry.recorded);
    if (zero.length > 0) body += `Recorded as the zero address on this network: ${zero.map((entry) => `\`${esc(entry.key)}\``).join(", ")}.\n\n`;
  }
  body += "Regenerate after a checked-in deployment artifact, schema configuration, indexer configuration, or capability projection changes.\n";
  return body;
}

/** Per-integration deployment state from the artifacts: the same records the projection JSON carries. */
export function integrationNetworkRecords({ root, sources, ontology }) {
  const deploymentSources = sources.filter((source) => /deployments\/\d+-latest\.json$/.test(source));
  const names = networkNames(root, declaredSource(sources, "packages/contracts/deployments/networks.json"));
  const indexed = indexerContracts(root, declaredSource(sources, "packages/indexer/config.yaml"));
  const integrations = {};
  for (const integration of [...(ontology.integrations ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
    const fields = integration.deployment_fields;
    const rows = deploymentInventory(root, deploymentSources, fields);
    const valuesByChain = new Map(rows.map((row) => [Number(row.chainId), row.values]));
    // A cross-chain integration keeps one of its contracts on another network: the ENS receiver
    // for Arbitrum lives on Ethereum. That network's artifact answers for the field, and a network
    // that only hosts such a component is part of the other deployment, not one of its own.
    const remote = integration.remote_deployment_fields ?? {};
    const hostOf = (field, chainId) => remote[field]?.[chainId] ?? chainId;
    const hosted = new Set(
      Object.entries(remote).flatMap(([field, hosts]) => Object.values(hosts).map((host) => `${host}:${field}`)),
    );
    const networks = [];
    for (const row of rows) {
      const chainId = Number(row.chainId);
      const values = {};
      const remoteHosts = {};
      for (const field of fields) {
        const host = hostOf(field, chainId);
        if (!valuesByChain.has(host)) {
          throw new Error(`Integration ${integration.id}: ${field} is hosted on chain ${host}, which has no deployment artifact among the sources`);
        }
        values[field] = valuesByChain.get(host)[field];
        if (host !== chainId && isRecordedDeploymentValue(values[field])) remoteHosts[field] = names.get(host) ?? String(host);
      }
      const recorded = fields.filter((field) => isRecordedDeploymentValue(values[field]));
      const own = fields.filter((field) => isRecordedDeploymentValue(row.values[field]));
      if (recorded.length === 0 || (own.length > 0 && own.every((field) => hosted.has(`${chainId}:${field}`)))) continue;
      networks.push({
        chainId,
        name: names.get(chainId) ?? String(chainId),
        status: deploymentState(values, fields),
        recorded,
        ...(Object.keys(remoteHosts).length > 0 ? { remote: remoteHosts } : {}),
      });
    }
    integrations[integration.id] = {
      display: integration.display,
      definition: integration.definition,
      networks,
      totalNetworks: rows.length,
      indexedContracts: integration.indexer_contracts.filter((name) => indexed.includes(name)),
    };
  }
  return integrations;
}

export function renderIntegrationProjections({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  const integrations = integrationNetworkRecords({ root, sources, ontology });
  const payload = {
    $generated: `GENERATED FILE: do not edit. ${regenerationHint("integration")}`,
    generator: GENERATOR_PATH,
    digest,
    integrations,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

// Diagram grouping is a rendering choice, not ontology data: every entity must be
// placed in exactly one group, so an ontology addition fails loudly here instead
// of silently bloating a diagram past legibility.
const ERD_GROUPS = [
  {
    title: "Core protocol",
    intro: "Gardens, actions, and the attested work loop.",
    members: ["garden", "action", "work", "work-approval", "assessment", "attestation", "hat", "season", "need"],
  },
  {
    title: "Funding and recognition",
    intro: "How approved work connects to certificates, vaults, and distributions.",
    members: ["hypercert", "vault", "cookie-jar"],
  },
  {
    title: "Commitment pooling",
    intro: "The commitment subsystem: pools, cycles, series, and settlement records.",
    members: [
      "commitment-pool",
      "commitment-cycle",
      "commitment-series",
      "commitment-provider-exposure",
      "commitment-unit-summary",
      "commitment-series-cycle-summary",
      "commitment",
      "commitment-contributor",
      "commitment-payout-plan",
    ],
  },
];

/**
 * Places every ontology entity in exactly one diagram group. Throws when an entity is missing, is
 * listed in two groups (it would render twice), or a group names an entity the ontology lacks.
 */
export function assignDataModelGroups(entityIds, groups) {
  const groupOf = new Map();
  const duplicated = new Set();
  for (const group of groups) {
    for (const member of group.members) {
      if (groupOf.has(member)) duplicated.add(member);
      groupOf.set(member, group.title);
    }
  }
  const known = new Set(entityIds);
  const unassigned = entityIds.filter((id) => !groupOf.has(id));
  const unknown = [...groupOf.keys()].filter((id) => !known.has(id));
  if (unassigned.length || unknown.length || duplicated.size) {
    throw new Error(
      `Data model grouping is out of date. Unassigned entities: ${unassigned.join(", ") || "none"}. Unknown group members: ${unknown.join(", ") || "none"}. Listed in more than one group: ${[...duplicated].join(", ") || "none"}.`
    );
  }
  return groupOf;
}

/**
 * The arrow label for a lifecycle transition: the mechanism's first clause, kept short enough to
 * read on a diagram. Mermaid ends a state-diagram label at `;` and `:`, so neither may survive; the
 * full mechanism text belongs in the table under the diagram.
 */
export function stateLabel(mechanism, max = 60) {
  const flat = String(mechanism).replaceAll("\n", " ").replace(/\s+/g, " ").trim();
  let clause = flat.split(/;|\s—\s|\.\s/)[0].trim();
  if (clause.length > max) clause = clause.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (clause.length > max) clause = `${clause.slice(0, max - 1).trimEnd()}…`;
  return clause.replaceAll(";", ",").replaceAll(":", "-");
}

export function renderDataModel({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  const byId = new Map(ontology.entities.map((entity) => [entity.id, entity]));
  assignDataModelGroups(ontology.entities.map((entity) => entity.id), ERD_GROUPS);
  const node = (id) => id.replaceAll("-", "_");
  let body = pageHeader(
    { title: "Data Model & Ontology", slug: "/builders/architecture/data-model", sources, digest },
    "Data Model & Ontology",
    "This page projects the ontology: entity relationships in three layers, then the lifecycle state machines that govern how records change. Solid nodes belong to a layer; dashed nodes are context from another layer. Use a diagram's Expand control to open it full screen and zoom. Relationships here are semantic, not database foreign keys."
  );
  for (const group of ERD_GROUPS) {
    const members = new Set(group.members);
    body += `## ${group.title}\n\n${group.intro}\n\n`;
    body += "```mermaid\nflowchart LR\n";
    for (const id of group.members) body += `  ${node(id)}["${byId.get(id).display}"]:::member\n`;
    const contextIds = new Set();
    const edges = [];
    for (const id of group.members) {
      for (const relationship of byId.get(id).relationships ?? []) {
        if (!members.has(relationship.to)) contextIds.add(relationship.to);
        edges.push(`  ${node(id)} -->|${relationship.kind}| ${node(relationship.to)}\n`);
      }
    }
    for (const id of [...contextIds].sort()) body += `  ${node(id)}["${byId.get(id).display}"]:::context\n`;
    for (const edge of edges) body += edge;
    body += "  classDef member stroke-width:2px\n";
    body += "  classDef context opacity:0.55,stroke-dasharray:4 3\n";
    body += "```\n\n";
    body += "| Entity | Definition | Surfaces |\n|---|---|---|\n";
    for (const id of group.members) {
      const entity = byId.get(id);
      body += `| ${esc(entity.display)} | ${esc(entity.definition)} | ${entity.surfaces.map(esc).join(", ")} |\n`;
    }
    body += "\n";
  }
  body += "## Lifecycles\n\nThese state machines project lifecycle transitions from the ontology. Each arrow carries the first clause of its mechanism; the table under the diagram carries the full text, which points back to the code or configuration that enforces the transition.\n\n";
  for (const machine of ontology.state_machines) {
    body += `### ${machine.id} {#${machine.id}}\n\n${machine.note ? `${machine.note}\n\n` : ""}\`\`\`mermaid\nstateDiagram-v2\n`;
    // Declare every state up front so a state no transition reaches yet still appears.
    for (const state of machine.states) body += `  ${state.name.replaceAll("-", "_")}\n`;
    for (const transition of machine.transitions) {
      const label = stateLabel(transition.mechanism);
      for (const from of transition.from) for (const to of transition.to) body += `  ${from.replaceAll("-", "_")} --> ${to.replaceAll("-", "_")}: ${label}\n`;
    }
    body += "```\n\n| From | To | Layer | Mechanism |\n|---|---|---|---|\n";
    for (const transition of machine.transitions) {
      body += `| ${transition.from.map(esc).join(", ")} | ${transition.to.map(esc).join(", ")} | ${esc(transition.layer ?? "—")} | ${esc(transition.mechanism.replaceAll("\n", " "))} |\n`;
    }
    body += "\n";
  }
  return body;
}

function skillFrontmatterDescription(root, source) {
  const text = readText(root, source);
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text);
  const match = frontmatter ? /^description:\s*(.+)$/m.exec(frontmatter[1]) : null;
  if (!match) throw new Error(`Skill source has no frontmatter description: ${source}`);
  return match[1].trim().replace(/^["']|["']$/g, "");
}

// The labeled README paragraphs a catalog entry shows, in reading order.
const SKILL_README_FIELDS = ["When to use it", "What you get", "How to invoke"];

/** A skill README's lead paragraph is its purpose; `**Label:** text` paragraphs are its fields. */
function readSkillReadme(root, source) {
  const text = readText(root, source).replace(/^---\n[\s\S]*?\n---\n/, "");
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((block) => block.trim().replaceAll("\n", " "))
    .filter((block) => block && !block.startsWith("#"));
  const fields = {};
  for (const paragraph of paragraphs) {
    const match = /^\*\*([^*]+):\*\*\s*(.+)$/.exec(paragraph);
    if (match) fields[match[1]] = match[2];
  }
  const purpose = paragraphs.find((paragraph) => !/^\*\*[^*]+:\*\*/.test(paragraph));
  if (!purpose) throw new Error(`Skill README has no lead paragraph: ${source}`);
  return { purpose, fields };
}

export function renderSkills({ root, sources, digest }) {
  const byName = new Map();
  for (const source of sources) {
    const match = /^\.claude\/skills\/([^/]+)\/(SKILL|README)\.md$/.exec(source);
    if (!match) continue;
    const entry = byName.get(match[1]) ?? {};
    entry[match[2] === "README" ? "readme" : "skill"] = source;
    byName.set(match[1], entry);
  }
  const skills = [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entry]) => {
      if (!entry.skill) throw new Error(`Skill ${name} is missing SKILL.md`);
      const { purpose, fields } = entry.readme
        ? readSkillReadme(root, declaredSource(sources, entry.readme))
        : { purpose: skillFrontmatterDescription(root, declaredSource(sources, entry.skill)), fields: {} };
      return { name, purpose, fields };
    });
  let body = pageHeader(
    { title: "Skills Catalog", slug: "/builders/agentic/skills", sources, digest },
    "Skills Catalog",
    `Skills are packaged workflows. A coding agent, or you driving one, runs a skill by name for a specific kind of task. The catalog below is the quick index; each skill's own section follows, projected from its folder, where the README and SKILL.md stay the source of truth. ${skills.length} skills are cataloged; the [task routing](/builders/agentic/task-routing) page says which one a kind of task should reach for.`
  );
  // Table cells keep inline code but cannot carry a pipe.
  const cell = (value) => String(value).replaceAll("|", "\\|");
  body += "## Catalog\n\n| Skill | Use it when | How to invoke |\n|---|---|---|\n";
  for (const skill of skills) {
    body += `| [${skill.name}](#${skill.name}) | ${cell(skill.fields["When to use it"] ?? skill.purpose)} | ${cell(skill.fields["How to invoke"] ?? "See the entry below")} |\n`;
  }
  body += "\n";
  for (const skill of skills) {
    body += `## ${skill.name} {#${skill.name}}\n\n${skill.purpose}\n\n`;
    const fieldLines = SKILL_README_FIELDS.filter((label) => skill.fields[label]).map((label) => `- **${label}:** ${skill.fields[label]}`);
    if (fieldLines.length) body += `${fieldLines.join("\n")}\n\n`;
    body += `[Skill folder](https://github.com/greenpill-dev-guild/green-goods/tree/develop/.claude/skills/${skill.name})\n\n`;
  }
  return body;
}

// The terms a community reader meets in the guides, in the order the work happens: the place,
// the work, the review, the plan, the claim, the two funds, then the people. Each leads the
// glossary with its plain-language record from the projection data and links to its guide.
// This is a list of terms, not a rule. The ontology's `surfaces` field says where a term may
// appear in product copy; it does not say who reads it.
// Released promise terms use product-facing names; formal implementation terms stay in Builders.
const GLOSSARY_EVERYDAY = [
  { ref: "entity:commitment-pool", guide: ["Open a Pool", "/community/steward-guide/open-a-pool"] },
  { ref: "entity:season", guide: ["Open a Pool", "/community/steward-guide/open-a-pool"] },
  { ref: "entity:commitment-contributor", heading: "Contributor", availabilityNote: "Team membership and contributions are available; contributor payouts remain deferred.", guide: ["Keep a Promise", "/community/gardener-guide/keep-a-promise"] },
  { ref: "entity:garden", guide: ["How It Works", "/community/how-it-works"] },
  { ref: "entity:action", guide: ["Manage Actions", "/community/steward-guide/managing-actions"] },
  // Every surface calls a commitment a promise; the word stays only in the feature's name. Offer
  // and request are its two kinds, not other names for it, so the entry words that line itself.
  {
    ref: "entity:commitment",
    heading: "Promise",
    alsoCalled: ["commitment, as in the feature name Commitment Pooling"],
    guide: ["Make a Promise", "/community/gardener-guide/make-a-promise"],
  },
  { ref: "entity:work", guide: ["Submit Work", "/community/gardener-guide/uploading-your-work"] },
  { ref: "entity:work-approval", guide: ["Review Work", "/community/steward-guide/reviewing-work"] },
  { ref: "entity:assessment", guide: ["Make an Initial Assessment", "/community/evaluator-guide/making-an-assessment"] },
  // The public site and the guides call it an impact certificate; the cockpit says Hypercert.
  { ref: "entity:hypercert", heading: "Impact Certificate", guide: ["Mint Impact Certificate", "/community/steward-guide/creating-impact-certificates"] },
  { ref: "entity:vault", guide: ["Endow a Garden", "/community/funder-guide/funding-a-garden"] },
  { ref: "entity:cookie-jar", guide: ["Donate to a Garden", "/community/funder-guide/donating-to-a-garden"] },
  { ref: "persona:gardener", guide: ["Gardener Guide", "/community/gardener-guide/"] },
  { ref: "persona:steward", guide: ["Steward Guide", "/community/steward-guide/"] },
  { ref: "persona:evaluator", guide: ["Evaluator Guide", "/community/evaluator-guide/"] },
  { ref: "persona:funder", guide: ["Funder Guide", "/community/funder-guide/"] },
  { ref: "persona:community-member", guide: ["How It Works", "/community/how-it-works"] },
];

// Anchors older links use for a term. They stay on the page wherever the term's heading lands.
const GLOSSARY_LEGACY_ANCHORS = {
  "persona:steward": ["operator"],
  "supporting:pwa": ["pwa-progressive-web-app"],
  "supporting:smart-account": ["smart-account-account-abstraction"],
};

const headingAnchor = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * The glossary's everyday entries: each selected term with the plain-language record the
 * projection data holds for it. A selection the ontology cannot back fails here, so the page
 * never shows a term without plain words or under a name nobody declared.
 */
export function glossaryEverydayEntries(ontology, projections, selection = GLOSSARY_EVERYDAY) {
  const terms = new Map([
    ...ontology.entities
      .filter((entity) => entity.semantic_status === "canonical")
      .map((entity) => [`entity:${entity.id}`, entity]),
    ...ontology.personas.map((persona) => [`persona:${persona.id}`, persona]),
  ]);
  const conceptByRef = new Map(projections.human_concepts.map((concept) => [concept.ref, concept]));
  const availabilityByRef = new Map((projections.capabilities ?? []).map((item) => [item.ref, item.availability]));
  return selection.map(({ ref, heading, alsoCalled, guide, availabilityNote }) => {
    const term = terms.get(ref);
    if (!term) throw new Error(`Glossary everyday term ${ref} is not a canonical entity or persona`);
    const concept = conceptByRef.get(ref);
    if (!concept) throw new Error(`Glossary everyday term ${ref} has no human concept in the projection data`);
    const aliases = concept.aliases ?? [];
    const title = heading ?? term.display;
    if (title !== term.display && !aliases.some((alias) => alias.toLowerCase() === title.toLowerCase())) {
      throw new Error(`Glossary heading "${title}" is neither the display name nor a declared alias of ${ref}`);
    }
    // An entry may word its "Also called" line, but each item still opens with a declared name.
    const names = [term.display, ...aliases].map((name) => name.toLowerCase());
    for (const text of alsoCalled ?? []) {
      const opening = text.toLowerCase();
      if (!names.some((name) => opening === name || opening.startsWith(`${name},`))) {
        throw new Error(`Glossary "Also called" item "${text}" does not open with a declared name of ${ref}`);
      }
    }
    const anchor = title === term.display ? term.id : headingAnchor(title);
    return {
      ref,
      heading: title,
      anchor,
      // The canonical id and any older anchor keep resolving when the heading is an alias.
      aliasAnchors: [...(anchor === term.id ? [] : [term.id]), ...(GLOSSARY_LEGACY_ANCHORS[ref] ?? [])],
      concept,
      alsoCalled: alsoCalled ?? [
        ...(title === term.display ? [] : [term.display]),
        ...aliases.filter((alias) => alias.toLowerCase() !== title.toLowerCase()),
      ],
      availabilityNote: availabilityNote ?? UNAVAILABLE_NOTES.find(([status]) => status === availabilityByRef.get(ref))?.[1] ?? null,
      guide,
    };
  });
}

// Stable published links: removing or renaming a source term needs an explicit replacement.
const PUBLISHED_GLOSSARY_TERMS = [
  ["entity:garden", "garden"],
  ["entity:action", "action"],
  ["entity:work", "work"],
  ["entity:work-approval", "work-approval"],
  ["entity:assessment", "assessment"],
  ["entity:hypercert", "hypercert"],
  ["entity:vault", "vault"],
  ["entity:cookie-jar", "cookie-jar"],
  ["entity:attestation", "attestation"],
  ["entity:hat", "hat"],
  ["entity:season", "season"],
  ["entity:need", "need"],
  ["entity:commitment-pool", "commitment-pool"],
  ["entity:commitment-cycle", "commitment-cycle"],
  ["entity:commitment-series", "commitment-series"],
  ["entity:commitment-provider-exposure", "commitment-provider-exposure"],
  ["entity:commitment-unit-summary", "commitment-unit-summary"],
  ["entity:commitment-series-cycle-summary", "commitment-series-cycle-summary"],
  ["entity:commitment", "commitment"],
  ["entity:commitment-contributor", "commitment-contributor"],
  ["entity:commitment-payout-plan", "commitment-payout-plan"],
  ["persona:gardener", "gardener"],
  ["persona:steward", "steward"],
  ["persona:evaluator", "evaluator"],
  ["persona:funder", "funder"],
  ["persona:community-member", "community-member"],
  ["supporting:domain", "domain"],
  ["supporting:eas", "eas"],
  ["supporting:eight-forms-of-capital", "eight-forms-of-capital"],
  ["supporting:impact-token", "impact-token"],
  ["supporting:indicator", "indicator"],
  ["supporting:ipfs", "ipfs"],
  ["supporting:karma-gap", "karma-gap"],
  ["supporting:mdr", "mdr"],
  ["supporting:on-chain", "on-chain"],
  ["supporting:outcome", "outcome"],
  ["supporting:owner", "owner"],
  ["supporting:passkey", "passkey"],
  ["supporting:pwa", "pwa"],
  ["supporting:resolver", "resolver"],
  ["supporting:schema", "schema"],
  ["supporting:smart-account", "smart-account"],
];

export function renderGlossary({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  const projections = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-projections.json"));
  const vocabulary = readJson(root, declaredSource(sources, "scripts/data/banned-vocabulary.json"));
  const everyday = glossaryEverydayEntries(ontology, projections);
  const everydayRefs = new Set(everyday.map((entry) => entry.ref));
  const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
  let body = pageHeader(
    { title: "Glossary", slug: "/glossary", audience: "all", sources, digest },
    "Glossary",
    "The words you will meet in Green Goods, in plain language. Each entry says what the word means, why it matters, and what it is easy to mix it up with. Formal definitions and technical reference live in the [Builders ontology](/reference/ontology)."
  );
  body = body.replace(/^# Glossary$/m, 'import TermAnchor from "@site/src/components/docs/TermAnchor";\n\n<TermAnchor id="glossary" />\n\n# Glossary');
  body += "## Everyday terms\n\n";
  for (const entry of everyday) {
    for (const id of entry.aliasAnchors) body += `<a id="${id}"></a>\n\n`;
    body += `### ${entry.heading} {#${entry.anchor}}\n\n`;
    body += `**${esc(sentence(entry.concept.plain_name))}** ${esc(sentence(entry.concept.why_it_matters))}\n\n`;
    body += `- **For example:** ${esc(sentence(entry.concept.example))}\n`;
    if (entry.alsoCalled.length) body += `- **Also called:** ${entry.alsoCalled.map(esc).join(", ")}.\n`;
    if (entry.concept.not_confused_with?.length) body += `- **Not the same as:** ${entry.concept.not_confused_with.map(esc).join(", ")}.\n`;
    if (entry.availabilityNote) body += `- **Availability:** ${entry.availabilityNote}\n`;
    body += `- **Read more:** [${entry.guide[0]}](${entry.guide[1]}).\n\n`;
  }
  const communityTerms = projections.community_terms ?? [];
  const usedAnchors = new Set(everyday.flatMap(entry => [entry.anchor, ...entry.aliasAnchors]));
  body += "## Words in the app\n\n";
  for (const term of communityTerms) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(term.id) || usedAnchors.has(term.id)) throw new Error(`Duplicate or invalid community glossary anchor: ${term.id}`);
    if (!term.meaning?.trim() || !term.example?.trim() || !term.guide?.startsWith("/")) throw new Error(`Incomplete community glossary term: ${term.id}`);
    if (!term.source_of_truth?.length) throw new Error(`Missing glossary authority: ${term.id}`);
    for (const source of term.source_of_truth) if (!existsSync(path.join(root, source))) throw new Error(`Missing glossary authority: ${source}`);
    usedAnchors.add(term.id);
    const publishedRef = PUBLISHED_GLOSSARY_TERMS.find(([, anchor]) => anchor === term.id)?.[0];
    for (const id of GLOSSARY_LEGACY_ANCHORS[publishedRef] ?? []) {
      if (usedAnchors.has(id)) throw new Error(`Duplicate community glossary alias: ${id}`);
      usedAnchors.add(id);
      body += `<a id="${id}"></a>\n\n`;
    }
    body += `### ${esc(term.label)} {#${term.id}}\n\n${esc(term.meaning)}\n\n${esc(term.example)} [Guide](${term.guide}).\n\n`;
  }
  // Preserve historical fragments without displaying a second technical glossary.
  for (const [id, target] of [["formal-definitions", "entities"], ["domain-entities", "entities"], ["personas", "personas"], ["term-reference", "entities"], ["language-policy", "language-policy"], ["lint-enforced-terms", "language-policy"], ["admin-prompt-vocabulary", "language-policy"], ["client-prompt-vocabulary", "language-policy"]]) {
    body += `<TermAnchor id="${id}" to="/reference/ontology#${target}" />\n`;
  }
  const terms = new Map([
    ...ontology.entities.map(term => [`entity:${term.id}`, term]),
    ...ontology.personas.map(term => [`persona:${term.id}`, term]),
    ...ontology.supporting_terms.map(term => [`supporting:${term.id}`, term]),
  ]);
  for (const [ref, anchor] of PUBLISHED_GLOSSARY_TERMS) {
    const term = terms.get(ref);
    if (!term) throw new Error(`Published glossary link ${anchor} needs a declared replacement for ${ref}`);
    if (everydayRefs.has(ref) || usedAnchors.has(anchor)) continue;
    for (const id of [...(GLOSSARY_LEGACY_ANCHORS[ref] ?? []), anchor]) {
      body += `<TermAnchor id="${id}" to="/reference/ontology#${term.id}" />\n`;
    }
  }
  return body;
}

// Reader-facing names for the mutation boundaries the routing contract declares. Every token in
// the contract needs one, so an added boundary fails here instead of rendering as a raw token.
const MUTATION_BOUNDARY_LABELS = {
  "direct-bounded": "Direct, bounded edits",
  "read-only-unless-persistence-requested": "Read only unless you ask it to persist",
  "plan-artifacts-before-implementation": "Plan artifacts first; implementation after approval",
  "diagnose-first-fix-when-requested": "Diagnose first; fix when asked",
  "read-only-pinned-diff": "Read only, pinned to the diff under review",
  "read-only-until-human-selection": "Read only until a person picks an option",
  "read-only-pinned-proof": "Read only, pinned to the proof it certifies",
  "read-only-numbered-findings": "Read only; returns numbered findings",
  "approved-finding-ids-only": "Edits only the finding ids you approved",
  "session-bounded-fix-and-revalidate": "Fixes bounded to the QA session, then revalidates",
  "authorized-product-records-and-private-qa-rows": "Writes only authorized product records and private QA rows",
  "current-actionable-feedback-and-bounded-siblings": "Current, actionable review feedback plus bounded sibling fixes",
  "readiness-and-user-authorized-publish-actions": "Readiness checks; publishes only what you authorize",
  "advisory-until-explicit-polish-scope": "Advisory until you name a polish scope",
  "triage-then-scope-locked-edits": "Triage first, then edits locked to the agreed scope",
};

// Reading order for the task table. Every core task must appear in exactly one group.
const TASK_GROUPS = [
  { title: "Everyday work", intro: "Where most sessions start: answer, research, plan, or debug.", tasks: ["lookup-or-bounded-edit", "research", "planning", "debugging"] },
  { title: "Review and readiness", intro: "Getting a change reviewed, answering review feedback, and deciding whether it can ship.", tasks: ["change-review", "pr-feedback", "pre-merge-readiness"] },
  { title: "Architecture and repository health", intro: "Larger questions about structure, and the audits and cleanups that keep the repository honest.", tasks: ["architecture-discovery", "architecture-certification", "repository-audit", "approved-cleanup"] },
  { title: "Product QA", intro: "Walking the product with a tester and turning what they find into records.", tasks: ["live-product-qa", "qa-notes-and-backlog"] },
  { title: "Design and documents", intro: "Design direction and documentation feedback, both advisory until a scope is agreed.", tasks: ["design-direction", "doc-review-feedback"] },
];

export function assignTaskGroups(taskIds, groups = TASK_GROUPS) {
  const seen = new Map();
  const duplicated = [];
  for (const group of groups) for (const id of group.tasks) { if (seen.has(id)) duplicated.push(id); seen.set(id, group.title); }
  const unassigned = taskIds.filter((id) => !seen.has(id));
  const unknown = [...seen.keys()].filter((id) => !taskIds.includes(id));
  if (unassigned.length || unknown.length || duplicated.length) {
    throw new Error(`Task routing grouping is out of date. Unassigned tasks: ${unassigned.join(", ") || "none"}. Unknown group members: ${unknown.join(", ") || "none"}. Listed twice: ${duplicated.join(", ") || "none"}.`);
  }
  return seen;
}

export function mutationBoundaryLabel(token) {
  const label = MUTATION_BOUNDARY_LABELS[token];
  if (!label) throw new Error(`Mutation boundary has no reader-facing label: ${token}`);
  return label;
}

export function renderTaskRouting({ root, sources, digest }) {
  declaredSource(sources, ".claude/context/task-routing.json");
  const contract = readTaskRouting(root);
  const errors = validateTaskRouting(root, contract);
  if (errors.length) throw new Error(`Invalid task-routing authority:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  for (const token of Object.values(EXPECTED_MUTATION_BOUNDARIES)) mutationBoundaryLabel(token);
  assignTaskGroups(contract.tasks.map((task) => task.id));
  const byId = new Map(contract.tasks.map((task) => [task.id, task]));

  let body = pageHeader(
    { title: "Agent Task Routing", slug: "/builders/agentic/task-routing", sources, digest },
    "Agent Task Routing",
    "Routing is how a coding agent picks the right workflow for a request and stays inside it. Each core task below names the skill that handles it, what the agent may change while doing so (its mutation boundary), what it hands back, and where it sends work that turns out to be something else. The skills' own frontmatter decides activation; this page is the map."
  );
  body += "## How an agent uses this\n\n1. Match the request to one task below; the smallest workflow that fits wins.\n2. Stay inside that task's mutation boundary. A read-only task reports; a bounded task edits only what the boundary names.\n3. Produce the task's output, and route anything else through its handoff instead of absorbing it.\n\n## Core tasks\n\n";
  for (const group of TASK_GROUPS) {
    body += `### ${group.title}\n\n${group.intro}\n\n| Task | Skill | What the agent may change | Output | Handoff |\n|---|---|---|---|---|\n`;
    for (const id of group.tasks) {
      const task = byId.get(id);
      body += `| ${esc(task.label)} | ${task.skill ? `[\`${esc(task.skill)}\`](/builders/agentic/skills#${task.skill})` : "No skill"} | ${esc(mutationBoundaryLabel(task.mutationBoundary))} (\`${esc(task.mutationBoundary)}\`) | ${esc(task.output)} | ${esc(task.handoff)} |\n`;
    }
    body += "\n";
  }
  body += "## Authority order\n\nWhen sources disagree, the earlier one wins.\n\n";
  for (const [index, authority] of contract.authorityOrder.entries()) body += `${index + 1}. ${esc(authority)}\n`;
  body += "\n## Ownership and synchronization\n\n";
  body += "The upstream surface owns truth. Public documentation explains or projects that truth; it does not publish live Plan Hub state, Linear status, or private QA evidence.\n\n";
  body += "| Surface | Role | Owns | Visibility |\n|---|---|---|---|\n";
  for (const surface of contract.authoritySurfaces) {
    body += `| ${esc(surface.label)} | \`${esc(surface.role)}\` | ${esc(surface.owns)} | \`${esc(surface.visibility)}\` |\n`;
  }
  body += "\n```mermaid\nflowchart LR\n";
  for (const surface of contract.authoritySurfaces) {
    body += `  ${surface.id.replaceAll("-", "_")}["${esc(surface.label)}"]\n`;
  }
  for (const flow of contract.authorityFlows) {
    body += `  ${flow.from.replaceAll("-", "_")} -->|${esc(flow.relationship)}| ${flow.to.replaceAll("-", "_")}\n`;
  }
  body += "```\n";
  body += "\nA routed skill must not absorb neighboring work. When the requested outcome changes, follow the task's handoff instead of expanding the active workflow.\n";
  return body;
}

function describeTriggers(triggers) {
  const code = (value) => `\`${esc(value)}\``;
  const parts = [];
  if (triggers.pull_request) {
    parts.push(triggers.pull_request.paths.length ? `pull requests that touch its paths (${triggers.pull_request.paths.length} path filters)` : "every pull request");
  }
  if (triggers.push) {
    const { branches, tags, paths } = triggers.push;
    if (tags.length) parts.push(`pushed tags matching ${tags.map(code).join(", ")}`);
    else parts.push(`pushes to ${branches.map(code).join(" and ") || "any branch"}${paths.length ? " that touch its paths" : ""}`);
  }
  if (triggers.schedule) parts.push(`a schedule (${triggers.schedule.crons.map((cron) => `${code(cron)} UTC`).join(", ")})`);
  if (triggers.workflow_dispatch) parts.push("manual dispatch");
  if (triggers.workflow_call) parts.push("a call from another workflow");
  return parts.length ? parts.join("; ") : "no declared trigger";
}

export function renderGitHubActions({ root, sources, digest }) {
  const workflows = workflowInventory(root, sources.filter((source) => source.startsWith(".github/workflows/")));
  const catalog = readJson(root, declaredSource(sources, "scripts/data/workflow-catalog.json")).workflows ?? {};
  const rootManifest = readJson(root, declaredSource(sources, "package.json"));
  // The CI Gate waits only for the workflows the validation policy gives a path rule; a workflow
  // with no rule (scheduled, manual, or tag-only) is never part of that wait set.
  const gated = new Set(Object.keys(readJson(root, declaredSource(sources, "scripts/data/validation-policy.json")).workflowRules ?? {}));
  const requiredStatus = (workflow, entry) => {
    if (entry.required) return "yes, branch protection waits for it";
    if (gated.has(workflow.display)) return "no, but the CI Gate waits for it on a pull request that touches its paths";
    return "no, and the CI Gate never waits for it: it has no pull request path rule";
  };
  const missing = workflows.filter((workflow) => !catalog[workflow.source]).map((workflow) => workflow.source);
  const orphaned = Object.keys(catalog).filter((source) => !workflows.some((workflow) => workflow.source === source));
  if (missing.length || orphaned.length) {
    throw new Error(`Workflow catalog is out of date. Missing entries: ${missing.join(", ") || "none"}. Entries without a workflow: ${orphaned.join(", ") || "none"}.`);
  }
  const required = workflows.filter((workflow) => catalog[workflow.source].required);
  let body = pageHeader(
    { title: "CI & GitHub Actions", slug: "/builders/quality/gh-actions", sources, digest },
    "CI & GitHub Actions",
    `${workflows.length} workflows run the repository's continuous integration. Only ${required.map((workflow) => workflow.display).join(", ") || "none"} is a required status: the per-package workflows are path-filtered, so each runs only when its files change and the gate waits for exactly the set a pull request should trigger. Scheduled and manual workflows cover the slow or operator-driven checks that do not belong on every pull request. Purpose and use case come from \`scripts/data/workflow-catalog.json\`; triggers and jobs are read from the workflow files, and this page says nothing about whether a run is currently passing.`,
    { imports: [COPY_COMMAND_IMPORT] }
  );
  body += "## Workflows\n\n| Workflow | Purpose | Runs on | Required |\n|---|---|---|---|\n";
  for (const workflow of workflows) {
    const entry = catalog[workflow.source];
    body += `| [${esc(workflow.display)}](#${workflow.name.replace(/\.ya?ml$/, "")}) | ${esc(entry.purpose)} | ${describeTriggers(workflow.triggers)} | ${entry.required ? "Yes" : "No"} |\n`;
  }
  body += "\n";
  for (const workflow of workflows) {
    const entry = catalog[workflow.source];
    const anchor = workflow.name.replace(/\.ya?ml$/, "");
    body += `### ${esc(workflow.display)} {#${anchor}}\n\n${entry.purpose}\n\n`;
    body += `- **Use it when:** ${entry.useCase}\n`;
    body += `- **Runs on:** ${describeTriggers(workflow.triggers)}.\n`;
    body += `- **Jobs:** ${workflow.jobs.map((job) => `\`${esc(job)}\``).join(", ") || "none"}.\n`;
    body += `- **Required status:** ${requiredStatus(workflow, entry)}.\n`;
    body += `- **File:** [${esc(workflow.source)}](https://github.com/greenpill-dev-guild/green-goods/blob/develop/${workflow.source})\n\n`;
  }
  body += "## Root quality and build scripts\n\nThe workflows call these root scripts, so running one locally reproduces that step.\n\n| Run it | What it runs |\n|---|---|\n";
  for (const [name, command] of Object.entries(rootManifest.scripts).filter(([name]) => /^(build|check|test|lint|format)/.test(name)).sort(([a], [b]) => a.localeCompare(b))) {
    body += `| ${copyCommand(`bun run ${name}`)} | \`${esc(command)}\` |\n`;
  }
  return body;
}

// Cases group under P0/P1/P2 bands per surface, ID-sorted within a band — the
// same shape as the QA app's Priority view, so the page and the run sheet read
// the same way. Priority meaning lives here; kind meaning lives in the catalog.
const QA_PRIORITY_MEANINGS = [
  ["P0", "walk first (the highest-priority coverage for an applicable session)"],
  ["P1", "walk next (important coverage after the P0 band)"],
  ["P2", "walk after P0 and P1 when the session scope allows"],
];

export function renderQaCatalog({ root, sources, digest }) {
  const catalog = readJson(root, declaredSource(sources, "scripts/data/qa-test-catalog.json"));
  const active = catalog.cases.filter((item) => item.status === "active").sort((a, b) => a.id.localeCompare(b.id));
  const kindLabels = new Map(catalog.kinds.map((kind) => [kind.id, kind.label]));
  let body = pageHeader(
    { title: "Test Cases", slug: "/builders/quality/test-cases", featureStatus: "In progress", sources, digest },
    "Test Cases",
    "This page projects scenario definitions only. Live results, identities, owners, defect links, and session evidence are intentionally excluded."
  );
  body += "Each surface groups its cases by priority (the same P0/P1/P2 bands as the [QA app's](https://qa.greengoods.app) Priority view) and sorts by ID within a band. IDs are permanent addresses: never renumbered, never reused; retired cases keep their ID in the catalog history.\n\n";
  body += QA_PRIORITY_MEANINGS.map(([priority, meaning]) => `- **${priority}**: ${meaning}.`).join("\n");
  body += "\n\nPriority sets run order only. A failure's severity is assigned separately during triage.";
  body += "\n\nEach case carries one **kind**, the category axis:\n\n";
  body += catalog.kinds.map((kind) => `- **${esc(kind.label)}**: ${esc(kind.verifies)}.`).join("\n");
  if (catalog.journeys?.length) {
    body += "\n\n## Guided journeys\n\n";
    body += "Guided journeys choreograph active Test IDs across surfaces. A case's kind still describes that individual check; a guided journey describes who acts, who verifies, and when the handoff happens.\n\n";
    for (const journey of catalog.journeys) {
      const lanes = new Map(journey.lanes.map((lane) => [lane.id, lane]));
      body += `### ${esc(journey.label)}\n\n${esc(journey.summary)}\n\n`;
      body += "**Parts**\n\n";
      body += journey.lanes.map((lane) => `- **${esc(lane.label)}**: ${esc(lane.role)}.`).join("\n");
      body += "\n\n**Phases and Test IDs**\n\n";
      let stepNumber = 0;
      for (const phase of journey.phases) {
        const phaseSteps = journey.steps.filter((step) => step.phaseId === phase.id);
        if (!phaseSteps.length) continue;
        const renderedSteps = phaseSteps.map((step) => {
          stepNumber += 1;
          const lead = lanes.get(step.leadLaneId)?.label ?? step.leadLaneId;
          const verify = (step.verifyLaneIds ?? [])
            .map((laneId) => lanes.get(laneId)?.label ?? laneId)
            .join(", ");
          const roles = `act: ${esc(lead)}${verify ? `; verify: ${esc(verify)}` : ""}`;
          const handoff = step.handoff ? `\n   - **Handoff:** ${esc(step.handoff)}` : "";
          const knownGate = step.knownGate ? `\n   - **Known gate:** ${esc(step.knownGate)}` : "";
          return `${stepNumber}. \`${esc(step.caseId)}\` (${roles})${handoff}${knownGate}`;
        });
        body += `**${esc(phase.label)}**\n\n${renderedSteps.join("\n")}\n\n`;
      }
    }
  }
  body += "\n\n## How this catalog changes {#lifecycle}\n\n";
  body += "`scripts/data/qa-test-catalog.json` is the source of truth, and it changes the way code does: by pull request. Every case carries one **status**:\n\n";
  body += catalog.statuses.map((status) => `- **${esc(status.id)}**: ${esc(status.means)}.`).join("\n");
  body += "\n\n- A new case enters as `active`, takes the next number in its surface prefix, is appended to the ID ledger (`scripts/data/qa-test-id-ledger.json`), and names where it came from in `source`.\n";
  body += "- Wording, step, and evidence edits happen in place, so the ID keeps meaning the same check.\n";
  body += "- When what a case proves changes, it is retired with `retiredOn`, `retiredReason`, and `replacedBy` when successors exist, and the new check gets a new ID, so every past verdict keeps its meaning.\n";
  body += "- After a catalog change merges, redeploy the QA app (a deployment pins the catalog revision it shipped with) and regenerate this page with `node scripts/docs/generate.mjs`; CI rejects a stale copy.\n\n";
  body += "The catalog contract test enforces all of this, and [retired cases](#retired-cases) are listed at the end of this page.\n\n";
  for (const tab of catalog.tabs) {
    const tabCases = active.filter((candidate) => candidate.tab === tab);
    const tabSlug = tab.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    let rendered = 0;
    body += `## ${tab}\n\n`;
    for (const [priority] of QA_PRIORITY_MEANINGS) {
      const band = tabCases.filter((candidate) => candidate.priority === priority);
      if (band.length === 0) continue;
      rendered += band.length;
      const bandTitle = priority === "P0" ? `${priority}: run these first` : priority;
      body += `### ${bandTitle} (${band.length}) {#${tabSlug}-${priority.toLowerCase()}}\n\n`;
      body += "| ID | Kind | Area | Scenario | Evidence requested |\n|---|---|---|---|---|\n";
      for (const item of band) body += `| \`${esc(item.id)}\` | ${esc(kindLabels.get(item.kind) ?? item.kind)} | ${esc(item.area)} | ${esc(item.scenario)} | ${esc(item.evidence)} |\n`;
      body += "\n";
    }
    if (rendered !== tabCases.length) throw new Error(`qa docs: tab "${tab}" has cases outside the P0/P1/P2 bands`);
  }
  const retired = catalog.cases.filter((item) => item.status === "retired").sort((a, b) => a.id.localeCompare(b.id));
  body += "## Retired cases {#retired-cases}\n\nRetired cases never ship to a run sheet, but their IDs stay reserved and their history stays here.\n\n";
  body += "| ID | Was | Retired on | Why | Covered now by |\n|---|---|---|---|---|\n";
  for (const item of retired) {
    const successors = (item.replacedBy ?? []).map((id) => `\`${esc(id)}\``).join(", ") || "None";
    body += `| \`${esc(item.id)}\` | ${esc(item.tab)} · ${esc(item.scenario)} | ${esc(item.retiredOn)} | ${esc(item.retiredReason)} | ${successors} |\n`;
  }
  body += "\n";
  return body;
}

// Retired command names are deliberately absent here: the migration ledgers stay machine-read
// by the docs authority audit, and a reader of this page only needs what runs today.
export function renderCommands({ root, sources, digest }) {
  const manifestSources = orderCommandManifests(sources.filter((source) => source.endsWith("package.json")));
  const validation = readJson(root, declaredSource(sources, "scripts/data/validation-policy.json"));
  const implementationSources = sources.filter((source) => /(?:scripts\/(?:dev|agents)|packages\/contracts\/script)\/.+\.(?:mjs|js)$/.test(source));
  let body = pageHeader(
    { title: "Command inventory", slug: "/builders/packages/commands", sources, digest },
    "Command inventory",
    "Generated from package manifests and owning command definitions. Start with the getting-started guide for everyday commands. Operational scripts can write to live networks; read the owning runbook before using them.",
    { imports: [COPY_COMMAND_IMPORT] }
  );
  let total = 0;
  for (const source of manifestSources) {
    const manifest = readJson(root, source);
    const names = Object.keys(manifest.scripts ?? {}).sort();
    total += names.length;
    const directory = source === "package.json" ? "" : source.slice(0, -"/package.json".length);
    body += `## ${esc(directory || "Repository root")} (${names.length})\n\n`;
    body += "| Script | Invocation from repository root |\n|---|---|\n";
    for (const name of names) {
      body += `| ${esc(name)} | ${copyCommand(`bun run ${directory ? `--cwd ${directory} ` : ""}${name}`)} |\n`;
    }
    body += "\n";
  }
  body += `Total: ${total} manifest entries across ${manifestSources.length} manifests. The root exposes ${Object.keys(readJson(root, "package.json").scripts ?? {}).length}.\n\n`;
  body += "## Selectable operations and implementation\n\n";
  body += `Manifest counts stay separate from the ${OPERATIONS.length} contract operations and ${validation.checks?.length ?? 0} stable validation checks selected behind the root interfaces. Those definitions preserve capabilities without adding aliases.\n\n`;
  body += `This projection tracks ${implementationSources.length} owning command implementation files:\n\n`;
  for (const source of implementationSources) body += `- \`${esc(source)}\`\n`;
  return body;
}

// Every operation lands in the group of its first command word, so a new verb fails here
// instead of rendering without a heading.
const OPERATION_GROUPS = [
  { verb: "deploy", title: "Deploy", intro: "Bring contracts, modules, and garden fixtures onto a network." },
  { verb: "upgrade", title: "Upgrade", intro: "Move an upgradeable module to a new implementation." },
  { verb: "verify", title: "Verify", intro: "Check that what a network records matches the source and the recorded policy." },
  { verb: "status", title: "Status", intro: "Read-only reports; no mode needed." },
  { verb: "release", title: "Release", intro: "Run a release session step by step with its transaction boundaries." },
  { verb: "settlement", title: "Settlement", intro: "Operate the settlement lane." },
  { verb: "pooling", title: "Commitment pooling", intro: "Operate the commitment pooling module." },
  { verb: "migrate", title: "Migrate", intro: "Move recorded state to a newer contract version." },
  { verb: "repair", title: "Repair", intro: "Reconcile a deployment with its artifact." },
  { verb: "ens", title: "ENS", intro: "Manage garden names across the ENS registry and receiver." },
  { verb: "marketplace", title: "Hypercert marketplace", intro: "Manage the marketplace adapter and its strategies." },
  { verb: "minting", title: "Minting", intro: "Mint from approved work." },
  { verb: "ipfs", title: "IPFS", intro: "Upload content and record its identifiers." },
  { verb: "indexer", title: "Indexer", intro: "Coordinate the Envio indexer around a deployment." },
  { verb: "fork", title: "Fork", intro: "Prepare a local Arbitrum fork for rehearsal." },
];

export function assignOperationGroups(operations, groups = OPERATION_GROUPS) {
  const grouped = new Map(groups.map((group) => [group.verb, []]));
  const unknown = [];
  for (const operation of operations) {
    const verb = operation.command.split(" ")[0];
    if (grouped.has(verb)) grouped.get(verb).push(operation);
    else unknown.push(operation.command);
  }
  const empty = groups.filter((group) => grouped.get(group.verb).length === 0).map((group) => group.verb);
  if (unknown.length || empty.length) {
    throw new Error(`Contract operation grouping is out of date. Commands without a group: ${unknown.join(", ") || "none"}. Groups without a command: ${empty.join(", ") || "none"}.`);
  }
  return grouped;
}

const operationOptions = (operation) => [
  ...operation.flags.map((flag) => `--${flag}`),
  ...operation.values.map((flag) => `--${flag} <value>${operation.required?.includes(flag) ? " (required)" : ""}`),
];

export function renderContractOperations({ root, sources, digest }) {
  declaredSource(sources, "packages/contracts/script/cli/operations.mjs");
  const grouped = assignOperationGroups(OPERATIONS);
  const code = (value) => `\`${esc(value)}\``;
  let body = pageHeader(
    { title: "Contract operations", slug: "/builders/packages/contract-operations", sources, digest },
    "Contract operations",
    `Generated from the package-owned CLI definitions: ${OPERATIONS.length} operations in ${OPERATION_GROUPS.length} groups. Every command runs as \`bun run contracts -- <command>\` from the repository root; \`bun run contracts -- help\` lists them and \`--help\` after any command explains it. Deployments, upgrades, migrations, and repairs require an explicit network and execution mode.`,
    { imports: [COPY_COMMAND_IMPORT] }
  );
  body += "`--explain --json` describes resolution without credentials, service access, or execution. Broadcasts require release authorization. Planning, compilation, simulation, and upload can write artifacts. Read the owning runbook before executing an operation.\n\n";
  body += "## Execution modes\n\n| Mode | Meaning |\n|---|---|\n| preflight | Compile/artifact checks without RPC |\n| simulate | RPC simulation without broadcasting |\n| plan | Produce transaction-plan artifacts |\n| broadcast | Execute transactions |\n| upload | Upload content and write associated artifacts |\n\n";
  body += "Only the modes listed for each operation are accepted. Read-only operations do not require a mode. Release sessions retain the existing operator's stage, commit, credential, and transaction-boundary checks.\n\n";
  body += "## Operations\n\nCommands that accept the same options sit in one table under that option list, so each list appears once. A required value is marked. A copied command carries everything the operation always needs: `--network <network>` when it is network-scoped, `--mode <mode>` when a mode is required, and `--<name> <value>` for each value marked required. Replace the placeholders with a network and mode from its row and your own values. A few operations need more in one mode only (a nonce to plan or broadcast, for instance); `--help` after the command says which.\n\n";
  for (const group of OPERATION_GROUPS) {
    const operations = grouped.get(group.verb);
    body += `### ${group.title} (${operations.length})\n\n${group.intro}\n\n`;
    const clusters = new Map();
    for (const operation of operations) {
      const key = operationOptions(operation).join("\u0000");
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(operation);
    }
    const ordered = [...clusters.values()].sort((a, b) => b.length - a.length || a[0].command.localeCompare(b[0].command));
    for (const cluster of ordered) {
      const options = operationOptions(cluster[0]);
      body += options.length ? `Options: ${options.map(code).join(", ")}.\n\n` : "No options beyond the command itself.\n\n";
      body += "| Command | Networks | Modes |\n|---|---|---|\n";
      for (const operation of cluster) {
        const required = (operation.required ?? []).map((key) => ` --${key} <value>`).join("");
        const command = `bun run contracts -- ${operation.command}${operation.positional ? " <input>" : ""}${operation.network ? " --network <network>" : ""}${operation.modes && !operation.modeOptional ? " --mode <mode>" : ""}${required}`;
        const modes = operation.modes ? `${Object.keys(operation.modes).join(", ")}${operation.modeOptional ? " (optional)" : ""}` : "none";
        body += `| ${copyCommand(command)} | ${operation.network ? operation.networks.join(", ") : "not network-scoped"} | ${modes} |\n`;
      }
      body += "\n";
    }
  }
  return body;
}

/** The core DesignMD tokens as data for the docs design page: colors, type, radii, spacing. */
export function renderDesignTokens({ root, sources, digest }) {
  declaredSource(sources, "DESIGN.md");
  const tokens = readJson(root, declaredSource(sources, "packages/shared/src/styles/design-md.generated.json"));
  for (const key of ["colors", "typography", "rounded", "spacing"]) {
    if (!tokens[key] || typeof tokens[key] !== "object") throw new Error(`Design tokens are missing ${key}`);
  }
  const payload = {
    $generated: `GENERATED FILE: do not edit. ${regenerationHint("design")}`,
    generator: GENERATOR_PATH,
    digest,
    source: tokens.source ?? "DESIGN.md",
    name: tokens.name,
    colors: tokens.colors,
    typography: tokens.typography,
    rounded: tokens.rounded,
    spacing: tokens.spacing,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** The repository's onboarding procedure as data, so a page can embed it with a copy button. */
export function renderOnboardingData({ root, sources, digest }) {
  const text = readText(root, declaredSource(sources, "ONBOARDING.md"));
  const payload = {
    $generated: `GENERATED FILE: do not edit. ${regenerationHint("agentic")}`,
    generator: GENERATOR_PATH,
    digest,
    source: "ONBOARDING.md",
    text,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

const requireSource = createRequire(import.meta.url);
const SUMMARY_OUTPUTS = [
  "totalAnnualRevenue",
  "onchainRevenue",
  "offchainRevenue",
  "totalExpenses",
  "netMargin",
  "coverageRatio",
  "runwayMonths",
  "treasuryAfterOneYear",
  "requiredTvl",
  "requiredPrincipal",
  "impliedValuation",
  "tokenPrice",
];

/**
 * The economics explorer's model as data: every input, each preset's assumptions, and what each
 * preset computes. The explorer page's Markdown twin is written from this, so an agent reads the
 * model without running React. The model is TypeScript that imports nothing, which the pinned
 * Node loads as it is; it is loaded here, when the projection is rendered, and not with the module.
 */
export function renderRevenueExplorerData({ root, sources, digest }) {
  const source = declaredSource(sources, "docs/src/components/docs/protocolRevenueModel.ts");
  const model = requireSource(path.join(root, source));
  const presets = Object.values(model.REVENUE_PRESETS).map((preset) => {
    const summary = model.calculateRevenueSummary(model.getPresetInputs(preset.id));
    return {
      id: preset.id,
      label: preset.label,
      description: preset.description,
      stage: summary.stage.label,
      inputs: preset.inputs,
      // A value JSON cannot carry (an endless runway) is recorded as null.
      outputs: Object.fromEntries(SUMMARY_OUTPUTS.map((key) => [key, Number.isFinite(summary[key]) ? summary[key] : null])),
      streams: summary.streams.map(({ label, category, amount }) => ({ label, category, amount })),
    };
  });
  const sections = model.INPUT_SECTIONS.map((section) => ({
    title: section.title,
    description: section.description,
    fields: section.fields.map(({ key, label, description, prefix, suffix }) => ({ key, label, description, prefix, suffix })),
  }));
  for (const field of sections.flatMap((section) => section.fields)) {
    for (const preset of presets) {
      if (typeof preset.inputs[field.key] !== "number") throw new Error(`Preset ${preset.id} has no value for the input ${field.key}`);
    }
  }
  const payload = {
    $generated: `GENERATED FILE: do not edit. ${regenerationHint("design")}`,
    generator: GENERATOR_PATH,
    digest,
    source,
    sections,
    presets,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
