#!/usr/bin/env node

const WORKFLOW_MATCHERS = new Map([
  [
    "Admin",
    (path) =>
      matchesCommonWeb(path) ||
      path.startsWith("packages/admin/") ||
      path === ".github/workflows/admin.yml",
  ],
  [
    "Agent",
    (path) =>
      matchesCommonPackage(path) ||
      path.startsWith("packages/agent/") ||
      path.startsWith("packages/shared/") ||
      path === "scripts/quality/check-source-structure.js" ||
      path === ".github/workflows/agent.yml",
  ],
  [
    "Client",
    (path) =>
      matchesCommonWeb(path) ||
      path.startsWith("packages/client/") ||
      path === ".github/workflows/client.yml",
  ],
  [
    "Contracts",
    (path) =>
      path === "package.json" ||
      path === "bun.lock" ||
      path === ".env.schema" ||
      path.startsWith("packages/contracts/") ||
      path.startsWith("scripts/contracts/") ||
      path === "scripts/lib/git-guardrails.mjs" ||
      path === "scripts/quality/check-source-structure.js" ||
      path === ".github/workflows/contracts.yml",
  ],
  [
    "Design",
    (path) =>
      [
        "AGENTS.md",
        "CLAUDE.md",
        "DESIGN.md",
        "package.json",
        "bun.lock",
        "docs/DESIGN.md",
        "docs/docs/builders/packages/admin.mdx",
        "docs/docs/builders/testing/storybook.mdx",
        "docs/docs/reference/banned-vocabulary.json",
        "packages/admin/AGENTS.md",
        "packages/admin/DESIGN.md",
        "packages/shared/AGENTS.md",
        "packages/shared/package.json",
        "packages/shared/vitest.storybook.config.ts",
        "vercel.json",
        ".github/workflows/design.yml",
      ].includes(path) ||
      path.startsWith(".claude/skills/design/") ||
      path.startsWith("packages/admin/src/") ||
      (path.startsWith("packages/client/DESIGN") && path.endsWith(".md")) ||
      path.startsWith("packages/client/src/") ||
      path.startsWith("packages/shared/.storybook/") ||
      path.startsWith("packages/shared/src/") ||
      path.startsWith("scripts/design/") ||
      path === "scripts/data/design-token-usage-baseline.tsv" ||
      path === "scripts/quality/check-story-coverage.ts" ||
      path === "scripts/quality/check-story-quality.ts",
  ],
  [
    "Docs",
    (path) =>
      path.startsWith("docs/") ||
      ["package.json", "bun.lock", ".github/workflows/docs.yml"].includes(path),
  ],
  [
    "Indexer",
    (path) =>
      matchesCommonPackage(path) ||
      path.startsWith("packages/indexer/") ||
      matchesContractConsumer(path) ||
      path === "scripts/quality/check-source-structure.js" ||
      path === ".github/workflows/indexer.yml",
  ],
  [
    // Mirrors .github/workflows/ontology.yml path filters exactly. package.json
    // and bun.lock are deliberately excluded: check-ontology.mjs is zero-dep
    // (node stdlib only) and the workflow installs nothing, so dependency bumps
    // cannot affect it. Keep that invariant if the checker ever grows imports.
    "Ontology",
    (path) =>
      path.startsWith("packages/shared/src/") ||
      path.startsWith("packages/contracts/src/") ||
      // Deployment artifacts are capability/claim evidence: clearing an address
      // must re-run the gate that validates the "deployed" claims built on it.
      path.startsWith("packages/contracts/deployments/") ||
      [
        "packages/contracts/config/schemas.json",
        "packages/indexer/schema.graphql",
        "docs/docs/reference/glossary-community.md",
        "docs/docs/reference/ontology.generated.mdx",
        "docs/docs/builders/integrations/entity-matrix.mdx",
        "docs/docs/reference/concepts.generated.mdx",
        "scripts/quality/check-ontology.mjs",
        "scripts/quality/ontology-render.mjs",
        "scripts/quality/check-ontology.test.mjs",
        "scripts/data/ontology-drift-baseline.json",
        ".github/workflows/ontology.yml",
        ".plans/active/commitment-pooling/contract-spec.md",
        ".plans/active/commitment-pooling/standing-commitments-spec.md",
        ".plans/active/commitment-credit-follow-on/spec.md",
        ".plans/active/community-interface/spec.md",
        ".plans/active/commitment-pooling/settlement-spec.md",
        "docs/docs/builders/architecture/erd.mdx",
        "docs/docs/builders/specs/v1-0.mdx",
        "packages/contracts/script/DeployBadgeSchema.s.sol",
        // Projection evidence anchors outside the prefix families above —
        // kept in lockstep with the sidecar/claims by the checker unit test
        // "every projection evidence path is covered by the Ontology matcher".
        "packages/indexer/config.yaml",
        ".plans/active/commitment-pooling/status.json",
        "docs/docs/community/where-were-headed.mdx",
        "packages/agent/src/platforms/telegram.ts",
        "packages/client/src/views/Public/Gardens.tsx",
        "packages/client/src/views/Public/Actions.tsx",
        "packages/client/src/views/Garden/index.tsx",
        "packages/client/src/views/Public/Impact.tsx",
        "packages/client/src/views/Public/Vaults.tsx",
        "packages/client/src/views/Profile/Badges.tsx",
        "packages/admin/src/views/Cookies/index.tsx",
        "packages/admin/src/views/Community/index.tsx",
        "packages/admin/src/components/Assessment/CreateAssessmentSteps/StrategyKernelStep.tsx",
        "packages/admin/src/components/Hypercerts/ActiveListingsTable.tsx",
        "packages/admin/src/views/Garden/WorkDetail/ReviewForm.tsx",
      ].includes(path),
  ],
  [
    "Shared",
    (path) =>
      ["package.json", "bun.lock", "biome.json", ".env.schema"].includes(path) ||
      path.startsWith(".github/workflows/") ||
      matchesScriptSource(path) ||
      matchesPackageSource(path) ||
      path.endsWith("/package.json") ||
      matchesContractConsumer(path),
  ],
  [
    "Supply Chain Guardrails",
    matchesSupplyChainGuardrails,
  ],
]);

function matchesSupplyChainGuardrails(path) {
  return (
    path === "package.json" ||
    path.endsWith("/package.json") ||
    ["bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"].includes(path) ||
    ["bunfig.toml", ".npmrc", "pnpm-workspace.yaml", ".yarnrc.yml"].includes(path) ||
    path.startsWith(".github/workflows/") ||
    ["AGENTS.md", "CLAUDE.md", "ONBOARDING.md"].includes(path) ||
    path.startsWith(".codex/") ||
    path.startsWith(".claude/") ||
    path.startsWith(".plans/") ||
    path.startsWith("docs/routines/") ||
    path.startsWith("scripts/quality/") ||
    path.startsWith("scripts/harness/") ||
    [
      ".css",
      ".scss",
      ".js",
      ".json",
      ".jsx",
      ".mjs",
      ".cjs",
      ".md",
      ".mdx",
      ".sh",
      ".sol",
      ".ts",
      ".tsx",
      ".yaml",
      ".yml",
    ].some((extension) => path.endsWith(extension))
  );
}

function matchesCommonPackage(path) {
  return ["package.json", "bun.lock", "biome.json", ".env.schema"].includes(path);
}

function matchesContractConsumer(path) {
  return (
    path.startsWith("packages/contracts/src/") ||
    path.startsWith("packages/contracts/abis/") ||
    path.startsWith("packages/contracts/deployments/")
  );
}

function matchesCommonWeb(path) {
  return (
    matchesCommonPackage(path) ||
    ["playwright.config.ts", "scripts/ops/upload-sourcemaps.js"].includes(path) ||
    path.startsWith("tests/") ||
    path.startsWith("packages/shared/") ||
    matchesContractConsumer(path) ||
    [
      "scripts/lib/env-schema.mjs",
      "scripts/lib/env-schema.test.mjs",
      "scripts/lib/env-parity.mjs",
      "scripts/lib/env-parity.d.mts",
      "scripts/dev/env-check.js",
      "scripts/quality/check-source-structure.js",
    ].includes(path)
  );
}

function matchesScriptSource(path) {
  return (
    path.startsWith("scripts/") &&
    [".cjs", ".js", ".mjs", ".ts"].some((extension) => path.endsWith(extension))
  );
}

function matchesPackageSource(path) {
  return (
    path.startsWith("packages/") &&
    [".js", ".jsx", ".ts", ".tsx"].some((extension) => path.endsWith(extension))
  );
}

export function expectedWorkflowNames(files) {
  return [...WORKFLOW_MATCHERS]
    .filter(([, matches]) => files.some((file) => matches(file)))
    .map(([name]) => name)
    .sort();
}

async function githubJson(token, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${body.slice(0, 500)}`);
  }

  return response.json();
}

async function changedFiles(token, repository, pullNumber) {
  const files = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubJson(
      token,
      `/repos/${repository}/pulls/${pullNumber}/files?per_page=100&page=${page}`
    );
    files.push(...batch.map((file) => file.filename));
    if (batch.length < 100) return files;
  }
}

function latestRunsByName(runs) {
  const latest = new Map();
  for (const run of runs) {
    if (run.name === "CI Gate") continue;
    const current = latest.get(run.name);
    if (!current || run.id > current.id) latest.set(run.name, run);
  }
  return latest;
}

async function workflowRuns(token, repository, headSha) {
  const data = await githubJson(
    token,
    `/repos/${repository}/actions/runs?head_sha=${headSha}&event=pull_request&per_page=100`
  );
  return latestRunsByName(data.workflow_runs);
}

export async function runGate({
  token,
  repository,
  pullNumber,
  headSha,
  maxAttempts = 110,
  intervalMs = 20_000,
}) {
  if (!token || !repository || !pullNumber || !headSha) {
    throw new Error("GITHUB_TOKEN, REPO, PR_NUMBER, and HEAD_SHA are required");
  }

  const files = await changedFiles(token, repository, pullNumber);
  const expected = expectedWorkflowNames(files);
  console.log(`Changed files: ${files.length}`);
  console.log(`Expected workflows: ${expected.length > 0 ? expected.join(", ") : "(none)"}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const runs = await workflowRuns(token, repository, headSha);
    const missing = expected.filter((name) => !runs.has(name));
    const pending = expected
      .map((name) => runs.get(name))
      .filter((run) => run && run.status !== "completed");

    if (missing.length > 0 || pending.length > 0) {
      console.log(
        `Attempt ${attempt}/${maxAttempts}: missing ${missing.length}, pending ${pending.length}`
      );
      for (const name of missing) console.log(`  - missing: ${name}`);
      for (const run of pending) console.log(`  - pending: ${run.name} [${run.status}]`);
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    const failed = expected
      .map((name) => runs.get(name))
      .filter((run) => run.conclusion !== "success");

    for (const name of expected) {
      const run = runs.get(name);
      console.log(`  - ${name}: ${run.conclusion}`);
    }

    if (failed.length > 0) {
      for (const run of failed) {
        console.error(`::error::${run.name} concluded ${run.conclusion}: ${run.html_url}`);
      }
      throw new Error(`${failed.length} expected workflow(s) did not succeed`);
    }

    console.log("CI Gate passed: every expected path-filtered workflow reported success.");
    return;
  }

  throw new Error("CI Gate timed out before every expected workflow registered and completed");
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href;
if (isDirectRun) {
  runGate({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.REPO,
    pullNumber: process.env.PR_NUMBER,
    headSha: process.env.HEAD_SHA,
  }).catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
