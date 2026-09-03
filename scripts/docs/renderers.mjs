import { GENERATOR_PATH, generatedFrontmatter } from "./generator-core.mjs";
import {
  deploymentAddressFields,
  deploymentInventory,
  indexerContracts,
  isRecordedAddress,
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
  readTaskRouting,
  validateTaskRouting,
} from "../quality/task-routing-contract.mjs";

const esc = (value) => String(value).replaceAll("|", "\\|").replaceAll("`", "&#96;");
const declaredSource = (sources, source) => {
  if (!sources.includes(source)) throw new Error(`Renderer read is not declared as an authority source: ${source}`);
  return source;
};

function pageHeader(meta, heading, intro) {
  return `${generatedFrontmatter(meta)}# ${heading}\n\n${intro}\n\n`;
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
  body += "## Public Agent routes\n\n| Name | Path | Registered methods |\n|---|---|---|\n";
  for (const route of routes) {
    const methods = routeRegistrations.get(route.name) ?? routeRegistrations.get(route.value) ?? [];
    body += `| ${esc(route.name)} | \`${esc(route.value)}\` | ${methods.length ? methods.map((method) => `\`${method}\``).join(", ") : "not found in Agent API sources"} |\n`;
  }
  body += "\n## Package exports\n\n| Package | Specifier | Target |\n|---|---|---|\n";
  for (const item of exports) body += `| ${esc(item.package)} | \`${esc(item.specifier)}\` | \`${esc(item.target)}\` |\n`;
  return body;
}

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
    { title: "Persona Surfaces Matrix", slug: "/builders/journeys/persona-surfaces", sources, digest },
    "Persona Surfaces Matrix",
    "The ontology owns persona meaning. Route definitions own navigable paths. Paths below are literals as declared and may be nested under a parent route."
  );
  body += "## Personas\n\n| Persona | Hat | Surfaces | Definition |\n|---|---|---|---|\n";
  for (const persona of ontology.personas) body += `| ${esc(persona.display)} | \`${esc(persona.hat)}\` | ${persona.surfaces.map(esc).join(", ")} | ${esc(persona.definition)} |\n`;
  body += "\n## Declared route literals\n\n| Authority | Paths or segments |\n|---|---|\n";
  body += `| Client route tree | ${clientRoutes.map((value) => `\`${esc(value)}\``).join(", ")} |\n`;
  body += `| Client canonical PWA routes | ${clientPwaRoutes.map((value) => `\`${esc(value)}\``).join(", ")} |\n`;
  body += `| Admin shell route tree | ${adminShellRoutes.map((value) => `\`${esc(value)}\``).join(", ")} |\n`;
  body += `| Admin canvas route segments | ${adminCanvasRoutes.map((value) => `\`${esc(value)}\``).join(", ")} |\n`;
  return body;
}

function deploymentState(values, fields) {
  const present = fields.filter((field) => isRecordedAddress(values[field]));
  if (present.length === fields.length) return "Deployed";
  if (present.length > 0) return "Partial";
  return "Not deployed";
}

export function renderDeploymentStatus({ root, sources, digest }) {
  const deploymentSources = sources.filter((source) => /deployments\/\d+-latest\.json$/.test(source));
  const fields = deploymentAddressFields(root, deploymentSources);
  const rows = deploymentInventory(root, deploymentSources, fields);
  const names = networkNames(root, declaredSource(sources, "packages/contracts/deployments/networks.json"));
  let body = pageHeader(
    { title: "Deployment Status", slug: "/builders/deployments/status", sources, digest },
    "Deployment Status",
    "This page reports checked-in artifacts, not live RPC state. A nonzero address means an artifact records a deployment; activation and operational health require their own evidence."
  );
  body += "| Network | Recorded address fields | Zero or absent fields |\n|---|---|---|\n";
  for (const row of rows) {
    const recorded = fields.filter((field) => isRecordedAddress(row.values[field]));
    const absent = fields.filter((field) => !isRecordedAddress(row.values[field]));
    body += `| ${esc(names.get(Number(row.chainId)) ?? row.chainId)} (\`${row.chainId}\`) | ${recorded.length ? recorded.map((field) => `\`${esc(field)}\``).join(", ") : "none"} | ${absent.length} |\n`;
  }
  body += "\nRegenerate after a checked-in deployment artifact, schema configuration, indexer configuration, or capability projection changes.\n";
  return body;
}

export function renderIntegrationProjections({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
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
  const payload = {
    $generated: "GENERATED FILE: do not edit. Run `bun run docs:generate` or `bun run docs:generate -- --scope integration`.",
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

export function renderErd({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  const byId = new Map(ontology.entities.map((entity) => [entity.id, entity]));
  const groupOf = new Map();
  for (const group of ERD_GROUPS) for (const member of group.members) groupOf.set(member, group.title);
  const unassigned = ontology.entities.filter((entity) => !groupOf.has(entity.id)).map((entity) => entity.id);
  const unknown = [...groupOf.keys()].filter((id) => !byId.has(id));
  if (unassigned.length || unknown.length) {
    throw new Error(
      `ERD grouping is out of date. Unassigned entities: ${unassigned.join(", ") || "none"}. Unknown group members: ${unknown.join(", ") || "none"}.`
    );
  }
  const node = (id) => id.replaceAll("-", "_");
  let body = pageHeader(
    { title: "Entity Relationship Diagram", slug: "/builders/architecture/erd", sources, digest },
    "Entity Relationship Diagram",
    "These diagrams project the ontology's declared entity relationships in three layers so each one stays readable. Solid nodes belong to the layer; dashed nodes are context from another layer. Use a diagram's Expand control to open it full screen and zoom. They explain semantic relationships, not database foreign keys."
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
  return body;
}

function skillFrontmatterDescription(root, source) {
  const text = readText(root, source);
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text);
  const match = frontmatter ? /^description:\s*(.+)$/m.exec(frontmatter[1]) : null;
  if (!match) throw new Error(`Skill source has no frontmatter description: ${source}`);
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function readmeLeadParagraph(root, source) {
  const text = readText(root, source).replace(/^---\n[\s\S]*?\n---\n/, "");
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block && !block.startsWith("#"));
  if (!paragraphs.length) throw new Error(`Skill README has no lead paragraph: ${source}`);
  return paragraphs[0].replaceAll("\n", " ");
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
  let body = pageHeader(
    { title: "Skills Catalog", slug: "/builders/agentic/skills", sources, digest },
    "Skills Catalog",
    "Each skill is a packaged workflow that a coding agent (or a contributor driving one) invokes by name for a specific kind of task. This catalog projects each skill's purpose from its folder; the folder's README and SKILL.md stay the source of truth."
  );
  for (const [name, entry] of [...byName.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!entry.skill) throw new Error(`Skill ${name} is missing SKILL.md`);
    const purpose = entry.readme
      ? readmeLeadParagraph(root, declaredSource(sources, entry.readme))
      : skillFrontmatterDescription(root, declaredSource(sources, entry.skill));
    body += `### ${name} {#${name}}\n\n${purpose}\n\n`;
    body += `[Skill folder](https://github.com/greenpill-dev-guild/green-goods/tree/main/.claude/skills/${name})\n\n`;
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

export function renderTaskRouting({ root, sources, digest }) {
  declaredSource(sources, ".claude/context/task-routing.json");
  const contract = readTaskRouting(root);
  const errors = validateTaskRouting(root, contract);
  if (errors.length) throw new Error(`Invalid task-routing authority:\n${errors.map((error) => `- ${error}`).join("\n")}`);

  let body = pageHeader(
    { title: "Agent Task Routing", slug: "/builders/agentic/task-routing", sources, digest },
    "Agent Task Routing",
    "Use the smallest workflow that matches the task. Skill frontmatter decides activation; this projection explains the boundary, expected output, and handoff for each core task."
  );
  body += "| Task | Skill | Mutation boundary | Output | Handoff |\n|---|---|---|---|---|\n";
  for (const task of contract.tasks) {
    body += `| ${esc(task.label)} | ${task.skill ? `\`${esc(task.skill)}\`` : "No skill"} | \`${esc(task.mutationBoundary)}\` | ${esc(task.output)} | ${esc(task.handoff)} |\n`;
  }
  body += "\n## Authority order\n\n";
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

export function renderSequenceDiagrams({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  let body = pageHeader(
    { title: "Sequence and State Diagrams", slug: "/builders/architecture/sequence-diagrams", sources, digest },
    "Sequence and State Diagrams",
    "These state diagrams project lifecycle transitions from the ontology. Mechanism labels point readers back to the code or configuration that enforces each transition."
  );
  for (const machine of ontology.state_machines) {
    body += `## ${machine.id}\n\n${machine.note ? `${machine.note}\n\n` : ""}\`\`\`mermaid\nstateDiagram-v2\n`;
    for (const transition of machine.transitions) {
      for (const from of transition.from) for (const to of transition.to) body += `  ${from.replaceAll("-", "_")} --> ${to.replaceAll("-", "_")}: ${transition.mechanism.replaceAll("\n", " ").replaceAll(":", "-")}\n`;
    }
    body += "```\n\n";
  }
  return body;
}

export function renderGitHubActions({ root, sources, digest }) {
  const workflows = workflowInventory(root, sources.filter((source) => source.startsWith(".github/workflows/")));
  const rootManifest = readJson(root, declaredSource(sources, "package.json"));
  let body = pageHeader(
    { title: "GitHub Actions", slug: "/builders/deployments/gh-actions", sources, digest },
    "GitHub Actions",
    "Workflow files own CI triggers and jobs. Root package scripts own reusable local commands. This projection is an inventory, not a claim that a workflow is currently passing."
  );
  body += "## Workflows\n\n| Workflow | File | Jobs |\n|---|---|---|\n";
  for (const workflow of workflows) body += `| ${esc(workflow.display)} | \`${workflow.source}\` | ${workflow.jobs.map((job) => `\`${job}\``).join(", ") || "none"} |\n`;
  body += "\n## Root quality and build scripts\n\n| Script | Command |\n|---|---|\n";
  for (const [name, command] of Object.entries(rootManifest.scripts).filter(([name]) => /^(build|check|test|lint|format)/.test(name)).sort(([a], [b]) => a.localeCompare(b))) body += `| \`${esc(name)}\` | \`${esc(command)}\` |\n`;
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
  body += "\n\n## How this catalog changes {#lifecycle}\n\n";
  body += "`scripts/data/qa-test-catalog.json` is the source of truth, and it changes the way code does: by pull request. Every case carries one **status**:\n\n";
  body += catalog.statuses.map((status) => `- **${esc(status.id)}** — ${esc(status.means)}.`).join("\n");
  body += "\n\n- A new case enters as `active`, takes the next number in its surface prefix, is appended to the ID ledger (`scripts/data/qa-test-id-ledger.json`), and names where it came from in `source`.\n";
  body += "- Wording, step, and evidence edits happen in place — the ID keeps meaning the same check.\n";
  body += "- When what a case proves changes, it is retired with `retiredOn`, `retiredReason`, and `replacedBy` when successors exist, and the new check gets a new ID — so every past verdict keeps its meaning.\n";
  body += "- After a catalog change merges, redeploy the QA app (a deployment pins the catalog revision it shipped with) and regenerate this page with `bun run docs:generate`; CI rejects a stale copy.\n\n";
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
