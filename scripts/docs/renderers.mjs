import { GENERATOR_PATH, generatedFrontmatter, regenerationHint } from "./generator-core.mjs";
import { OPERATIONS } from "../../packages/contracts/script/cli/operations.mjs";
import {
  collectRenderableAddresses,
  deploymentInventory,
  indexerContracts,
  isRecordedAddress,
  networkExplorers,
  networkNames,
  packageExports,
  parseStringObject,
  publicRouteRegistrations,
  readJson,
  readText,
  routeLiterals,
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

export function renderMcpGuide({ root, sources, digest }) {
  const config = readJson(root, declaredSource(sources, ".mcp.json"));
  const servers = Object.entries(config.mcpServers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  let body = pageHeader(
    { title: "Agent and MCP Guide", slug: "/builders/agentic/mcp-guide", sources, digest },
    "Agent and MCP Guide",
    "This inventory is projected from the checked-in MCP configuration. Repository guidance defines how each server may be used; user-level tools are outside this project contract."
  );
  body += "| Server | Command | Arguments | Scope | Surfaces |\n|---|---|---|---|---|\n";
  for (const [name, server] of servers) {
    const access = config.agentAccess?.[name] ?? {};
    body += `| ${esc(name)} | \`${esc(server.command ?? "—")}\` | ${Array.isArray(server.args) ? server.args.map((arg) => `\`${esc(arg)}\``).join(" ") : "—"} | ${esc(access.scope ?? "—")} | ${Array.isArray(access.surfaces) ? access.surfaces.map(esc).join(", ") : "—"} |\n`;
  }
  body += "\n## Safety boundary\n\n";
  for (const [name] of servers) {
    for (const note of config.agentAccess?.[name]?.notes ?? []) body += `- ${esc(note)}\n`;
  }
  return body;
}

export function renderApiIndex({ root, sources, digest }) {
  const manifests = sources.filter((source) => source.endsWith("package.json"));
  const exports = packageExports(root, manifests);
  const routes = parseStringObject(root, declaredSource(sources, "packages/shared/src/public-contracts/routes.ts"), "PUBLIC_AGENT_ROUTES");
  const routeRegistrations = publicRouteRegistrations(
    root,
    sources.filter((source) => source.startsWith("packages/agent/src/api/")),
  );
  let body = pageHeader(
    { title: "API Index", slug: "/builders/packages/api-index", sources, digest },
    "API Index",
    "Use package export specifiers and public route constants as the stable entrypoints. Source-file imports bypass package boundaries and are not public APIs."
  );
  body += "[Runnable command inventory](./commands) is generated from the workspace manifests.\n\n";
  body += "## Public Agent routes\n\n| Name | Path | Registered methods |\n|---|---|---|\n";
  for (const route of routes) {
    const methods = routeRegistrations.get(route.name) ?? routeRegistrations.get(route.value) ?? [];
    body += `| ${esc(route.name)} | \`${esc(route.value)}\` | ${methods.length ? methods.map((method) => `\`${method}\``).join(", ") : "not found in Agent API sources"} |\n`;
  }
  body += "\n## Package exports\n\n| Package | Specifier | Target |\n|---|---|---|\n";
  for (const item of exports) body += `| ${esc(item.package)} | \`${esc(item.specifier)}\` | \`${esc(item.target)}\` |\n`;
  return body;
}

// Where a persona's surface id lands in prose. Throws on an id the ontology check does not know.
const SURFACE_LABELS = {
  admin: "the admin cockpit",
  client: "the client app",
  agent: "the messaging agent",
  community: "community channels",
  public: "the public site",
  docs: "these docs",
};

const listInProse = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

export function renderPersonaSurfaces({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  const clientRoutes = routeLiterals(root, declaredSource(sources, "packages/client/src/config/routes.tsx"));
  const clientPwaRoutes = parseStringObject(
    root,
    declaredSource(sources, "packages/client/src/config/pwaRouting.ts"),
    "APP_ROUTES",
  ).map((route) => route.value);
  const adminShellRoutes = routeLiterals(root, declaredSource(sources, "packages/admin/src/router.tsx"));
  const adminCanvasRoutes = routeLiterals(root, declaredSource(sources, "packages/admin/src/routes/views.tsx"));
  let body = pageHeader(
    { title: "Personas and Surfaces", slug: "/builders/architecture/personas", sources, digest },
    "Personas and Surfaces",
    "Green Goods has five personas. Each one is tied to an on-chain hat, which is how the contracts know who may do what, and to the surfaces where its work happens. The ontology owns what a persona means; the route definitions own the paths it navigates. Read this page before the work-submission trace, which names these actors at every step."
  );
  body += "## Personas\n\n| Persona | Hat | Surfaces | Definition |\n|---|---|---|---|\n";
  for (const persona of ontology.personas) body += `| ${esc(persona.display)} | \`${esc(persona.hat)}\` | ${persona.surfaces.map(esc).join(", ")} | ${esc(persona.definition)} |\n`;
  body += "\n## Where each persona works\n\n";
  for (const persona of ontology.personas) {
    const surfaces = persona.surfaces.map((surface) => {
      const label = SURFACE_LABELS[surface];
      if (!label) throw new Error(`Persona ${persona.id} names a surface without a prose label: ${surface}`);
      return label;
    });
    body += `**${persona.display}** holds the \`${persona.hat}\` hat. ${persona.definition} This persona works in ${listInProse(surfaces)}.\n\n`;
  }
  if (ontology.personas_note) body += `${ontology.personas_note}\n\n`;
  body += "<details>\n<summary>Declared route literals</summary>\n\nPaths below are literals as declared in the route definitions and may be nested under a parent route.\n\n| Authority | Paths or segments |\n|---|---|\n";
  body += `| Client route tree | ${clientRoutes.map((value) => `\`${esc(value)}\``).join(", ")} |\n`;
  body += `| Client canonical PWA routes | ${clientPwaRoutes.map((value) => `\`${esc(value)}\``).join(", ")} |\n`;
  body += `| Admin shell route tree | ${adminShellRoutes.map((value) => `\`${esc(value)}\``).join(", ")} |\n`;
  body += `| Admin canvas route segments | ${adminCanvasRoutes.map((value) => `\`${esc(value)}\``).join(", ")} |\n`;
  body += "\n</details>\n";
  return body;
}

function deploymentState(values, fields) {
  const present = fields.filter((field) => isRecordedAddress(values[field]));
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
    intro: "Capabilities a garden opts into, and the partner contracts behind them.",
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

function contractLabel(entry, keys) {
  if (entry.key.endsWith("Impl") && keys.has(entry.key.slice(0, -4))) return `${entry.key.slice(0, -4)} (implementation)`;
  if (keys.has(`${entry.key}Impl`)) return `${entry.key} (proxy)`;
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
    const rows = deploymentInventory(root, deploymentSources, integration.deployment_fields);
    const networks = rows
      .map((row) => ({
        chainId: Number(row.chainId),
        name: names.get(Number(row.chainId)) ?? String(row.chainId),
        status: deploymentState(row.values, integration.deployment_fields),
        recorded: integration.deployment_fields.filter((field) => isRecordedAddress(row.values[field])),
      }))
      .filter((network) => network.recorded.length > 0);
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
    `Skills are packaged workflows. A coding agent, or you driving one, runs a skill by name for a specific kind of task. The catalog below is the quick index; each skill's own section follows, projected from its folder, where the README and SKILL.md stay the source of truth. ${skills.length} skills are catalogued; the [task routing](/builders/agentic/task-routing) page says which one a kind of task should reach for.`
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

export function renderGlossary({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  const projections = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-projections.json"));
  const vocabulary = readJson(root, declaredSource(sources, "scripts/data/banned-vocabulary.json"));
  const capabilityByRef = new Map((projections.capabilities ?? []).map((capability) => [capability.ref, capability]));
  const canonicalEntities = ontology.entities.filter((entity) => entity.semantic_status === "canonical");
  const capital = ontology.vocabularies.find((item) => item.id === "capital");
  let body = pageHeader(
    { title: "Glossary", slug: "/glossary", audience: "all", sources, digest },
    "Glossary",
    "The ontology owns domain entities, personas, and supporting terms. Capability projections keep current availability separate from meaning, while the vocabulary policy records language that Green Goods does not use."
  );
  body += `The ontology currently declares ${canonicalEntities.length} canonical concepts. Availability is projected separately and does not change what a term means.\n\n`;
  body += "## Domain Entities\n\n| Term | Type | Availability | Allowed surfaces | Definition |\n|---|---|---|---|---|\n";
  for (const entity of canonicalEntities) {
    const capability = capabilityByRef.get(`entity:${entity.id}`);
    body += `| **${esc(entity.display)}** | entity | ${esc(capability?.availability ?? "not projected")} | ${entity.surfaces.map(esc).join(" · ")} | ${esc(entity.definition)} |\n`;
  }
  body += "\n## Personas\n\n| Term | Type | Allowed surfaces | Definition |\n|---|---|---|---|\n";
  for (const persona of ontology.personas) {
    body += `| **${esc(persona.display)}** | persona | ${persona.surfaces.map(esc).join(" · ")} | ${esc(persona.definition)} |\n`;
  }
  if (capital) {
    const ordering = capital.canonical.members
      .map((member, index) => `${member[0]}${member.slice(1).toLowerCase()} (${index})`)
      .join(", ");
    body += `\nThe canonical machine ordering is the \`Capital\` enum: ${ordering}.\n\n`;
  }
  body += "## Term Reference\n\n";
  for (const entity of canonicalEntities) {
    if (entity.id === "hypercert") body += '<a id="impact-certificate"></a>\n\n';
    body += `### ${entity.display} {#${entity.id}}\n\n${entity.definition}\n\n`;
    const capability = capabilityByRef.get(`entity:${entity.id}`);
    if (capability?.availability) body += `**Availability:** ${esc(capability.availability)}.\n\n`;
  }
  for (const persona of ontology.personas) {
    if (persona.id === "steward") body += '<a id="operator"></a>\n\n';
    body += `### ${persona.display} {#${persona.id}}\n\n${persona.definition}\n\n`;
  }
  for (const term of ontology.supporting_terms ?? []) {
    if (term.id === "pwa") body += '<a id="pwa-progressive-web-app"></a>\n\n';
    if (term.id === "smart-account") body += '<a id="smart-account-account-abstraction"></a>\n\n';
    body += `### ${term.display ?? term.id} {#${term.id}}\n\n${term.reason}\n\n`;
  }
  body += "## Language policy\n\n";
  body += `${vocabulary.linter_enforced.rationale}\n\n`;
  body += "### Lint-enforced terms\n\n";
  for (const term of vocabulary.linter_enforced.terms) body += `- \`${esc(term)}\`\n`;
  body += "\n### Admin prompt vocabulary\n\n";
  body += `${vocabulary.prompt_vocabulary_admin_banned.rationale}\n\n`;
  for (const term of vocabulary.prompt_vocabulary_admin_banned.terms) body += `- \`${esc(term)}\`\n`;
  body += "\n### Client prompt vocabulary\n\n";
  body += `${vocabulary.prompt_vocabulary_client_banned.rationale}\n\n`;
  for (const term of vocabulary.prompt_vocabulary_client_banned.terms) body += `- \`${esc(term)}\`\n`;
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
    body += `- **Required status:** ${entry.required ? "yes, branch protection waits for it" : "no, the CI Gate waits for it only when its paths change"}.\n`;
    body += `- **File:** [${esc(workflow.source)}](https://github.com/greenpill-dev-guild/green-goods/blob/develop/${workflow.source})\n\n`;
  }
  body += "## Root quality and build scripts\n\nThe workflows call these root scripts, so running one locally reproduces that step.\n\n| Script | Run it | What it runs |\n|---|---|---|\n";
  for (const [name, command] of Object.entries(rootManifest.scripts).filter(([name]) => /^(build|check|test|lint|format)/.test(name)).sort(([a], [b]) => a.localeCompare(b))) {
    body += `| \`${esc(name)}\` | ${copyCommand(`bun run ${name}`)} | \`${esc(command)}\` |\n`;
  }
  return body;
}

// Cases group under P0/P1/P2 bands per surface, ID-sorted within a band — the
// same shape as the QA app's Priority view, so the page and the run sheet read
// the same way. Priority meaning lives here; kind meaning lives in the catalog.
const QA_PRIORITY_MEANINGS = [
  ["P0", "walk first — the highest-priority coverage for an applicable session"],
  ["P1", "walk next — important coverage after the P0 band"],
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
  body += "Each surface groups its cases by priority — the same P0/P1/P2 bands as the [QA app's](https://qa.greengoods.app) Priority view — and sorts by ID within a band. IDs are permanent addresses: never renumbered, never reused; retired cases keep their ID in the catalog history.\n\n";
  body += QA_PRIORITY_MEANINGS.map(([priority, meaning]) => `- **${priority}** — ${meaning}.`).join("\n");
  body += "\n\nPriority sets run order only. A failure's severity is assigned separately during triage.";
  body += "\n\nEach case carries one **kind**, the category axis:\n\n";
  body += catalog.kinds.map((kind) => `- **${esc(kind.label)}** — ${esc(kind.verifies)}.`).join("\n");
  if (catalog.journeys?.length) {
    body += "\n\n## Guided journeys\n\n";
    body += "Guided journeys choreograph active Test IDs across surfaces. A case's kind still describes that individual check; a guided journey describes who acts, who verifies, and when the handoff happens.\n\n";
    for (const journey of catalog.journeys) {
      const lanes = new Map(journey.lanes.map((lane) => [lane.id, lane]));
      body += `### ${esc(journey.label)}\n\n${esc(journey.summary)}\n\n`;
      body += "**Parts**\n\n";
      body += journey.lanes.map((lane) => `- **${esc(lane.label)}** — ${esc(lane.role)}.`).join("\n");
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
          const roles = `Act: ${esc(lead)}${verify ? `; verify: ${esc(verify)}` : ""}`;
          const handoff = step.handoff ? `\n   - **Handoff:** ${esc(step.handoff)}` : "";
          const knownGate = step.knownGate ? `\n   - **Known gate:** ${esc(step.knownGate)}` : "";
          return `${stepNumber}. \`${esc(step.caseId)}\` — ${roles}${handoff}${knownGate}`;
        });
        body += `**${esc(phase.label)}**\n\n${renderedSteps.join("\n")}\n\n`;
      }
    }
  }
  body += "\n\n## How this catalog changes {#lifecycle}\n\n";
  body += "`scripts/data/qa-test-catalog.json` is the source of truth, and it changes the way code does: by pull request. Every case carries one **status**:\n\n";
  body += catalog.statuses.map((status) => `- **${esc(status.id)}** — ${esc(status.means)}.`).join("\n");
  body += "\n\n- A new case enters as `active`, takes the next number in its surface prefix, is appended to the ID ledger (`scripts/data/qa-test-id-ledger.json`), and names where it came from in `source`.\n";
  body += "- Wording, step, and evidence edits happen in place — the ID keeps meaning the same check.\n";
  body += "- When what a case proves changes, it is retired with `retiredOn`, `retiredReason`, and `replacedBy` when successors exist, and the new check gets a new ID — so every past verdict keeps its meaning.\n";
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
      const bandTitle = priority === "P0" ? `${priority} — run these first` : priority;
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
    const successors = (item.replacedBy ?? []).map((id) => `\`${esc(id)}\``).join(", ") || "—";
    body += `| \`${esc(item.id)}\` | ${esc(item.tab)} · ${esc(item.scenario)} | ${esc(item.retiredOn)} | ${esc(item.retiredReason)} | ${successors} |\n`;
  }
  body += "\n";
  return body;
}

// The ledger stores manifest -> name -> replacement; flatten it back to rows.
function migrationRows(migration, status) {
  return Object.entries(migration[status === "replacement" ? "replacements" : "retained"] ?? {}).flatMap(
    ([manifest, names]) => Object.entries(names).map(([name, replacement]) => ({ manifest, name, replacement, status })),
  );
}

export function renderCommands({ root, sources, digest }) {
  const manifestSources = orderCommandManifests(sources.filter((source) => source.endsWith("package.json")));
  const migration = readJson(root, declaredSource(sources, "scripts/data/command-migration.json"));
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
  body += "\n## Removed command replacements\n\nThe former names below are not runnable aliases. Use the replacement exactly as shown, including its working directory and flags.\n\n";
  body += "| Previous manifest | Previous name | Replacement |\n|---|---|---|\n";
  for (const entry of migrationRows(migration, "replacement")) {
    body += `| \`${esc(entry.manifest)}\` | \`${esc(entry.name)}\` | ${copyCommand(entry.replacement)} |\n`;
  }
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
  const migration = readJson(root, declaredSource(sources, "packages/contracts/config/command-migration.json"));
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
  body += "## Operations\n\nCommands that accept the same options sit in one table under that option list, so each list appears once. A required value is marked.\n\n";
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
        const command = `bun run contracts -- ${operation.command}${operation.positional ? " <input>" : ""}`;
        const modes = operation.modes ? `${Object.keys(operation.modes).join(", ")}${operation.modeOptional ? " (optional)" : ""}` : "none";
        body += `| ${copyCommand(command)} | ${operation.network ? operation.networks.join(", ") : "not network-scoped"} | ${modes} |\n`;
      }
      body += "\n";
    }
  }
  body += `## Command migration\n\nThe ${migration.entries.length} retired script names below are historical labels, kept so an old runbook still resolves. Replacements run from the repository root with an explicit network and execution mode; a recorded \`--sender\` address is shown as \`<sender>\`, so supply your own.\n\n`;
  body += `<details>\n<summary>Command migration ledger (${migration.entries.length} retired names)</summary>\n\n| Previous manifest | Retired name | Replacement |\n|---|---|---|\n`;
  for (const entry of migration.entries) {
    const replacement = String(entry.replacement).replace(/--sender 0x[a-fA-F0-9]{40}/g, "--sender <sender>");
    body += `| ${esc(entry.scope)} | \`${esc(entry.name)}\` | ${copyCommand(replacement)} |\n`;
  }
  body += "\n</details>\n";
  return body;
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
