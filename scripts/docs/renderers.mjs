import { generatedFrontmatter } from "./generator-core.mjs";
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

export function renderIntegration({ root, sources, digest }, integrationId) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  const integration = (ontology.integrations ?? []).find((item) => item.id === integrationId);
  if (!integration) throw new Error(`Unknown ontology integration: ${integrationId}`);
  const deploymentSources = sources.filter((source) => /deployments\/\d+-latest\.json$/.test(source));
  const rows = deploymentInventory(root, deploymentSources, integration.deployment_fields);
  const names = networkNames(root, declaredSource(sources, "packages/contracts/deployments/networks.json"));
  const indexed = indexerContracts(root, declaredSource(sources, "packages/indexer/config.yaml"));
  let body = pageHeader(
    { title: integration.display, slug: `/builders/integrations/${integration.id}`, sources, digest },
    integration.display,
    integration.definition
  );
  body += "## Checked-in deployment projection\n\n";
  const recordedByRow = rows.map((row) =>
    integration.deployment_fields.filter((field) => isRecordedAddress(row.values[field]))
  );
  const recordedRows = rows.filter((_, index) => recordedByRow[index].length > 0);
  if (recordedRows.length === 0) {
    body +=
      "No checked-in deployment artifact records components for this integration on any supported network. Per-network state lives in the [deployment status projection](/builders/deployments/status).\n";
  } else {
    body += "| Network | Status | Recorded components |\n|---|---|---|\n";
    rows.forEach((row, index) => {
      const recorded = recordedByRow[index];
      if (recorded.length === 0) return;
      body += `| ${esc(names.get(Number(row.chainId)) ?? row.chainId)} (\`${row.chainId}\`) | ${deploymentState(row.values, integration.deployment_fields)} | ${recorded.map((field) => `\`${field}\``).join(", ")} |\n`;
    });
    if (recordedRows.length < rows.length) {
      body +=
        "\nNetworks without recorded components are omitted; per-network state lives in the [deployment status projection](/builders/deployments/status).\n";
    }
  }
  const indexedSignals = integration.indexer_contracts.filter((name) => indexed.includes(name));
  body += `\n## Indexer boundary\n\n${indexedSignals.length ? `Configured indexer contracts: ${indexedSignals.map((name) => `\`${name}\``).join(", ")}.` : "No integration-specific contract is declared in the checked-in indexer configuration."}\n\n`;
  body += "A deployment artifact does not by itself prove product activation, live indexing, or partner-service health. Follow the owning package runbook for operational verification.\n";
  return body;
}

export function renderErd({ root, sources, digest }) {
  const ontology = readJson(root, declaredSource(sources, "packages/shared/src/ontology/green-goods-ontology.json"));
  let body = pageHeader(
    { title: "Entity Relationship Diagram", slug: "/builders/architecture/erd", sources, digest },
    "Entity Relationship Diagram",
    "The diagram projects the ontology's declared entity relationships. It explains semantic relationships, not database foreign keys."
  );
  body += "```mermaid\nflowchart LR\n";
  for (const entity of ontology.entities) body += `  ${entity.id.replaceAll("-", "_")}[\"${entity.display}\"]\n`;
  for (const entity of ontology.entities) for (const relationship of entity.relationships ?? []) body += `  ${entity.id.replaceAll("-", "_")} -->|${relationship.kind}| ${relationship.to.replaceAll("-", "_")}\n`;
  body += "```\n\n## Entity definitions\n\n| Entity | Definition | Surfaces |\n|---|---|---|\n";
  for (const entity of ontology.entities) body += `| ${esc(entity.display)} | ${esc(entity.definition)} | ${entity.surfaces.map(esc).join(", ")} |\n`;
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
    { title: "GitHub Actions", slug: "/builders/quality/gh-actions", sources, digest },
    "GitHub Actions",
    "Workflow files own CI triggers and jobs. Root package scripts own reusable local commands. This projection is an inventory, not a claim that a workflow is currently passing."
  );
  body += "## Workflows\n\n| Workflow | File | Jobs |\n|---|---|---|\n";
  for (const workflow of workflows) body += `| ${esc(workflow.display)} | \`${workflow.source}\` | ${workflow.jobs.map((job) => `\`${job}\``).join(", ") || "none"} |\n`;
  body += "\n## Root quality and build scripts\n\n| Script | Command |\n|---|---|\n";
  for (const [name, command] of Object.entries(rootManifest.scripts).filter(([name]) => /^(build|check|test|lint|format)/.test(name)).sort(([a], [b]) => a.localeCompare(b))) body += `| \`${esc(name)}\` | \`${esc(command)}\` |\n`;
  return body;
}

export function renderQaCatalog({ root, sources, digest }) {
  const catalog = readJson(root, declaredSource(sources, "scripts/data/qa-test-catalog.json"));
  const active = catalog.cases.filter((item) => item.status === "active").sort((a, b) => a.id.localeCompare(b.id));
  let body = pageHeader(
    { title: "Test Cases", slug: "/builders/quality/test-cases", featureStatus: "In progress", sources, digest },
    "Test Cases",
    "This page projects scenario definitions only. Live results, identities, owners, defect links, and session evidence are intentionally excluded."
  );
  for (const tab of catalog.tabs) {
    body += `## ${tab}\n\n| ID | Priority | Area | Scenario | Evidence requested |\n|---|---|---|---|---|\n`;
    for (const item of active.filter((candidate) => candidate.tab === tab)) body += `| \`${esc(item.id)}\` | ${esc(item.priority)} | ${esc(item.area)} | ${esc(item.scenario)} | ${esc(item.evidence)} |\n`;
    body += "\n";
  }
  return body;
}
