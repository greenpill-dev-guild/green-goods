#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { parseGeneratorArgs, syncProjections } from "./generator-core.mjs";
import {
  renderApiIndex,
  renderDeploymentStatus,
  renderErd,
  renderGitHubActions,
  renderGlossary,
  renderIntegration,
  renderMcpGuide,
  renderPersonaSurfaces,
  renderQaCatalog,
  renderSequenceDiagrams,
  renderTaskRouting,
} from "./renderers.mjs";
import {
  readJson,
  sourcePathsContaining,
  supportedChainIds,
  workflowSourcePaths,
} from "./source-readers.mjs";
import { renderEntityMatrixMdx } from "../quality/ontology-render.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ONTOLOGY = "packages/shared/src/ontology/green-goods-ontology.json";
const PROJECTIONS = "packages/shared/src/ontology/green-goods-projections.json";
const CHAINS = "packages/shared/src/config/chains.ts";
const NETWORKS = "packages/contracts/deployments/networks.json";
const TASK_ROUTING = ".claude/context/task-routing.json";
const BANNED_VOCABULARY = "scripts/data/banned-vocabulary.json";
const PACKAGE_MANIFESTS = [
  "packages/admin/package.json",
  "packages/agent/package.json",
  "packages/client/package.json",
  "packages/contracts/package.json",
  "packages/indexer/package.json",
  "packages/shared/package.json",
];

function mcpWrapperSources(root) {
  const config = readJson(root, ".mcp.json");
  const sources = [];
  for (const server of Object.values(config.mcpServers ?? {})) {
    for (const argument of server.args ?? []) {
      if (typeof argument === "string" && /^scripts\/mcp\/.+\.mjs$/.test(argument)) sources.push(argument);
    }
  }
  return sources;
}

export function createProjections(root = REPO_ROOT) {
  const ontology = readJson(root, ONTOLOGY);
  const taskRouting = readJson(root, TASK_ROUTING);
  const deployments = supportedChainIds(root, CHAINS).map(
    (chainId) => `packages/contracts/deployments/${chainId}-latest.json`
  );
  const integrationCommon = [
    ...deployments,
    NETWORKS,
    CHAINS,
    "packages/contracts/config/schemas.json",
    "packages/indexer/config.yaml",
    ONTOLOGY,
    PROJECTIONS,
  ];
  const workflows = workflowSourcePaths(root);
  const publicAgentRoutes = sourcePathsContaining(
    root,
    "packages/agent/src/api",
    "PUBLIC_AGENT_ROUTES",
  );
  const routedSkillSources = [...new Set((taskRouting.tasks ?? []).map((task) => task.skill).filter(Boolean))]
    .sort()
    .map((skill) => `.claude/skills/${skill}/SKILL.md`);

  return [
    { scope: "package", output: "docs/docs/builders/agentic/mcp-guide.mdx", sources: [".mcp.json", "AGENTS.md", ...mcpWrapperSources(root)], render: renderMcpGuide },
    { scope: "package", output: "docs/docs/builders/packages/api-index.mdx", sources: [...PACKAGE_MANIFESTS, "packages/shared/src/public-contracts/routes.ts", ...publicAgentRoutes], render: renderApiIndex },
    { scope: "package", output: "docs/docs/builders/journeys/persona-surfaces.mdx", sources: [ONTOLOGY, "packages/client/src/config/routes.tsx", "packages/client/src/config/pwaRouting.ts", "packages/admin/src/router.tsx", "packages/admin/src/routes/views.tsx"], render: renderPersonaSurfaces },
    { scope: "integration", output: "docs/docs/builders/deployments/status.mdx", sources: integrationCommon, render: renderDeploymentStatus },
    ...(ontology.integrations ?? []).map((integration) => ({
      scope: "integration",
      output: `docs/docs/builders/integrations/${integration.id}.mdx`,
      sources: [...integrationCommon, integration.contract_source, ...(integration.additional_sources ?? [])],
      render: (context) => renderIntegration(context, integration.id),
    })),
    { scope: "ontology", output: "docs/docs/builders/architecture/erd.mdx", sources: [ONTOLOGY, PROJECTIONS, "packages/indexer/schema.graphql", "scripts/quality/ontology-render.mjs"], render: renderErd },
    { scope: "ontology", output: "docs/docs/reference/glossary.generated.mdx", sources: [ONTOLOGY, PROJECTIONS, BANNED_VOCABULARY, "scripts/quality/ontology-render.mjs"], render: renderGlossary },
    { scope: "ontology", output: "docs/docs/builders/integrations/entity-matrix.mdx", sources: [ONTOLOGY, "scripts/quality/ontology-render.mjs", "scripts/quality/check-ontology.mjs"], render: ({ root: renderRoot, sources, digest }) => renderEntityMatrixMdx(JSON.parse(readFileSync(path.join(renderRoot, ONTOLOGY), "utf8")), { sources, digest }) },
    { scope: "workflow", output: "docs/docs/builders/architecture/sequence-diagrams.mdx", sources: [ONTOLOGY, "scripts/quality/ontology-render.mjs"], render: renderSequenceDiagrams },
    { scope: "workflow", output: "docs/docs/builders/quality/gh-actions.mdx", sources: ["package.json", ...workflows], render: renderGitHubActions },
    { scope: "qa", output: "docs/docs/builders/quality/test-cases.mdx", sources: ["package.json", "scripts/data/qa-test-catalog.json", "scripts/data/validation-policy.json", "playwright.config.ts", "packages/client/vitest.config.ts", "packages/admin/vitest.config.ts", "packages/shared/vitest.config.ts", "packages/agent/vitest.config.ts"], render: renderQaCatalog },
    { scope: "agentic", output: "docs/docs/builders/agentic/task-routing.mdx", sources: [TASK_ROUTING, ...routedSkillSources, "scripts/quality/task-routing-contract.mjs"], render: renderTaskRouting },
  ];
}

export function projectionSourcePaths(root = REPO_ROOT) {
  return [...new Set(createProjections(root).flatMap((projection) => projection.sources))].sort();
}

function main() {
  try {
    const { check, scope } = parseGeneratorArgs(process.argv.slice(2));
    const projections = createProjections(REPO_ROOT);
    const problems = syncProjections({ root: REPO_ROOT, projections, scope, check });
    if (problems.length) {
      console.error(`Generated documentation drift:\n${problems.map((item) => `- ${item}`).join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log(`${check ? "Checked" : "Generated"} ${scope ? `${scope} ` : ""}documentation projections (${scope ? projections.filter((item) => item.scope === scope).length : projections.length}).`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
