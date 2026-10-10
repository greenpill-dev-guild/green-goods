import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generatedFrontmatter,
  normalizeText,
  parseGeneratorArgs,
  regenerationHint,
  renderProjection,
  sourceDigest,
  syncProjections,
} from "./generator-core.mjs";
import { createProjections, projectionSourcePaths } from "./generate.mjs";
import {
  collectRenderableAddresses,
  deploymentAddressFields,
  isRecordedAddress,
  packageExports,
  readJson,
  publicRouteRegistrations,
  selectSafeAddressFields,
  selectSafeFields,
  supportedChainIds,
  sourcePathsContaining,
  workflowInventory,
  workflowSourcePaths,
} from "./source-readers.mjs";
import {
  COMMAND_MANIFEST_ORDER,
  assignDataModelGroups,
  assignOperationGroups,
  assignTaskGroups,
  copyCommand,
  mutationBoundaryLabel,
  orderCommandManifests,
  renderSkills,
  stateLabel,
} from "./renderers.mjs";
import { EXPECTED_MUTATION_BOUNDARIES } from "../quality/task-routing-contract.mjs";
import { selectExpectedWorkflows } from "../quality/select-validation.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "green-goods-docs-generator-"));
  mkdirSync(path.join(root, "docs/docs/builders/reference"), { recursive: true });
  mkdirSync(path.join(root, "sources"), { recursive: true });
  writeFileSync(path.join(root, "sources/a.txt"), "alpha\r\n");
  writeFileSync(path.join(root, "sources/b.txt"), "beta\n\n");
  return root;
}

function projection() {
  return {
    scope: "qa",
    output: "docs/docs/builders/reference/generated.mdx",
    sources: ["sources/b.txt", "sources/a.txt"],
    render: ({ sources, digest }) =>
      `${generatedFrontmatter({ title: "Fixture", slug: "/fixture", sources, digest })}# Fixture\n`,
  };
}

test("normalizes line endings and hashes sources in stable path order", () => {
  const root = fixture();
  try {
    const first = sourceDigest(root, ["sources/b.txt", "sources/a.txt"]);
    writeFileSync(path.join(root, "sources/a.txt"), "alpha\n\n\n");
    const second = sourceDigest(root, ["sources/a.txt", "sources/b.txt"]);
    assert.equal(first, second);
    assert.equal(normalizeText("a\r\n\r\n"), "a\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed for a missing authority file", () => {
  const root = fixture();
  try {
    assert.throws(() => sourceDigest(root, ["sources/missing.txt"]), /Missing generated authority source/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects malformed JSON authority data", () => {
  const root = fixture();
  try {
    writeFileSync(path.join(root, "sources/bad.json"), "{nope");
    assert.throws(() => readJson(root, "sources/bad.json"), /Malformed JSON authority/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("projects only allowlisted safe configuration fields", () => {
  assert.deepEqual(selectSafeFields({ address: "0x1", ignored: "no" }, ["address"]), {
    address: "0x1",
  });
  assert.throws(() => selectSafeFields({ apiKey: "secret" }, ["apiKey"]), /Unsafe configuration field/);
});

test("accepts only valid deployment addresses and treats zero as absent", () => {
  const address = "0x1111111111111111111111111111111111111111";
  const zero = "0x0000000000000000000000000000000000000000";
  assert.deepEqual(selectSafeAddressFields({ module: address }, ["module"]), { module: address });
  assert.equal(isRecordedAddress(address), true);
  assert.equal(isRecordedAddress(zero), false);
  assert.throws(
    () => selectSafeAddressFields({ module: "not-an-address" }, ["module"]),
    /Malformed deployment address/,
  );
});

test("fails closed when any deployment artifact has a malformed address field", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "sources/a.json"),
      JSON.stringify({ module: "0x1111111111111111111111111111111111111111" }),
    );
    writeFileSync(path.join(root, "sources/b.json"), JSON.stringify({ module: "not-an-address" }));
    assert.throws(
      () => deploymentAddressFields(root, ["sources/a.json", "sources/b.json"]),
      /Malformed deployment address/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("derives supported chains and workflow sources deterministically", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
    writeFileSync(
      path.join(root, "sources/chains.ts"),
      "export const SUPPORTED_CHAINS = {\n  42161: {},\n  11155111: {},\n} as const;\n",
    );
    writeFileSync(path.join(root, ".github/workflows/z.yml"), "name: Z\n");
    writeFileSync(path.join(root, ".github/workflows/a.yaml"), "name: A\n");

    assert.deepEqual(supportedChainIds(root, "sources/chains.ts"), [42161, 11155111]);
    assert.deepEqual(workflowSourcePaths(root), [
      ".github/workflows/a.yaml",
      ".github/workflows/z.yml",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discovers and parses public Agent route registrations statically", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, "sources/api/nested"), { recursive: true });
    writeFileSync(
      path.join(root, "sources/api/routes.ts"),
      "app.post(PUBLIC_AGENT_ROUTES.subscribe, handler);\napp.get('/public/receipt/:id', handler);\n",
    );
    writeFileSync(
      path.join(root, "sources/api/nested/impact.ts"),
      "app.options(PUBLIC_AGENT_ROUTES.gardenImpact, handler);\napp.get(PUBLIC_AGENT_ROUTES.gardenImpact, handler);\n",
    );
    writeFileSync(path.join(root, "sources/api/private.ts"), "app.get('/private', handler);\n");

    const sources = sourcePathsContaining(root, "sources/api", "PUBLIC_AGENT_ROUTES");
    assert.deepEqual(sources, ["sources/api/nested/impact.ts", "sources/api/routes.ts"]);
    assert.deepEqual(
      Object.fromEntries(publicRouteRegistrations(root, sources)),
      {
        "/public/receipt/:id": ["GET"],
        gardenImpact: ["GET", "OPTIONS"],
        subscribe: ["POST"],
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sorts package exports deterministically", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "sources/package.json"),
      JSON.stringify({ name: "fixture", exports: { "./z": "./z.js", ".": "./index.js" } })
    );
    assert.deepEqual(packageExports(root, ["sources/package.json"]).map((item) => item.specifier), [
      ".",
      "./z",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detects missing, stale, and extra generated outputs", () => {
  const root = fixture();
  try {
    const item = projection();
    assert.deepEqual(syncProjections({ root, projections: [item], check: true }), [
      `missing: ${item.output}`,
    ]);
    assert.deepEqual(syncProjections({ root, projections: [item], check: false }), []);
    assert.deepEqual(syncProjections({ root, projections: [item], check: true }), []);

    writeFileSync(path.join(root, item.output), "modified\n");
    assert.deepEqual(syncProjections({ root, projections: [item], check: true }), [
      `stale: ${item.output}`,
    ]);

    const extra = path.join(root, "docs/docs/builders/reference/extra.mdx");
    writeFileSync(extra, "---\ngenerated: true\ngenerator: scripts/docs/generate.mjs\n---\n");
    assert.ok(syncProjections({ root, projections: [item], check: true }).includes("extra: docs/docs/builders/reference/extra.mdx"));

    mkdirSync(path.join(root, "docs/src/data"), { recursive: true });
    writeFileSync(path.join(root, "docs/src/data/retired.json"), '{"generator": "scripts/docs/generate.mjs"}\n');
    writeFileSync(path.join(root, "docs/src/data/hand-written.json"), '{"title": "not generated"}\n');
    const problems = syncProjections({ root, projections: [item], check: true });
    assert.ok(problems.includes("extra: docs/src/data/retired.json"), "a generated JSON file no projection owns is extra");
    assert.ok(!problems.some((problem) => problem.includes("hand-written.json")), "plain data files are not generator-owned");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fixture CLI exits nonzero for broken authority and modified output", () => {
  const root = fixture();
  try {
    const runner = path.join(root, "check.mjs");
    const core = new URL("./generator-core.mjs", import.meta.url).href;
    writeFileSync(
      runner,
      `import {syncProjections} from ${JSON.stringify(core)};\n` +
        `const root=${JSON.stringify(root)};\n` +
        `const projections=[{scope:"qa",output:"docs/docs/builders/reference/generated.mdx",sources:["sources/missing.txt"],render:()=>"x"}];\n` +
        `try { const problems=syncProjections({root,projections,check:true}); process.exit(problems.length ? 1 : 0); } catch { process.exit(2); }\n`
    );
    assert.throws(() => execFileSync(process.execPath, [runner]), (error) => error.status === 2);

    writeFileSync(path.join(root, "sources/missing.txt"), "source\n");
    writeFileSync(path.join(root, "docs/docs/builders/reference/generated.mdx"), "modified\n");
    assert.throws(() => execFileSync(process.execPath, [runner]), (error) => error.status === 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects malformed CLI input", () => {
  assert.throws(() => parseGeneratorArgs(["--scope", "unknown"]), /Unknown docs generator scope/);
  assert.throws(() => parseGeneratorArgs(["--wat"]), /Unknown docs generator argument/);
});

test("generated banners quote regeneration commands the generator accepts", () => {
  const integrationData = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/src/data/integration-projections.json",
  );
  assert.ok(integrationData);
  const banners = [
    generatedFrontmatter({ title: "Fixture", slug: "/fixture", sources: [], digest: "sha256:test" }),
    JSON.parse(renderProjection(REPO_ROOT, integrationData)).$generated,
  ];
  for (const banner of banners) {
    const commands = [...banner.matchAll(/`node scripts\/docs\/generate\.mjs([^`]*)`/g)].map((match) =>
      match[1].trim().split(/\s+/).filter(Boolean).map((word) => (word === "<scope>" ? "package" : word)),
    );
    assert.equal(commands.length, 2, `banner should quote the full and scoped commands: ${banner}`);
    for (const args of commands) assert.doesNotThrow(() => parseGeneratorArgs(args), `${args.join(" ")} must parse`);
  }
  assert.equal(parseGeneratorArgs(["--scope", "integration"]).scope, "integration");
  assert.match(regenerationHint("qa"), /--scope qa`\.$/);
});

test("data model grouping places every entity in exactly one group", () => {
  const groups = [
    { title: "One", members: ["a", "b"] },
    { title: "Two", members: ["c"] },
  ];
  assert.equal(assignDataModelGroups(["a", "b", "c"], groups).get("c"), "Two");
  assert.throws(
    () => assignDataModelGroups(["a", "b", "c"], [...groups, { title: "Three", members: ["b"] }]),
    /Listed in more than one group: b/,
  );
  assert.throws(() => assignDataModelGroups(["a", "b", "c", "d"], groups), /Unassigned entities: d/);
  assert.throws(() => assignDataModelGroups(["a", "b"], groups), /Unknown group members: c/);
});

test("every projection source is routed to the Docs workflow", () => {
  for (const source of projectionSourcePaths(REPO_ROOT)) {
    assert.ok(
      selectExpectedWorkflows({ changedPaths: [source], intent: "merge", ci: true }).includes("Docs"),
      `${source} must require the Docs workflow`,
    );
  }
});

test("personas page leads with who the actors are and keeps the route literals as an appendix", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/architecture/personas.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /^title: Personas and Surfaces$/m);
  assert.match(rendered, /^slug: \/builders\/architecture\/personas$/m);
  assert.ok(rendered.indexOf("## Personas") < rendered.indexOf("## Where each persona works"));
  assert.ok(rendered.indexOf("## Where each persona works") < rendered.indexOf("<details>"));
  assert.match(rendered, /\*\*Gardener\*\* holds the `gardener` hat\./);
  assert.match(rendered, /Client canonical PWA routes[^\n]*`\/home`/);
  assert.match(rendered, /Admin canvas route segments[^\n]*`hub`/);
});

test("data model projects layered diagrams, every relationship, and all lifecycles", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/architecture/data-model.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const blocks = [...rendered.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1]);
  const ontology = readJson(REPO_ROOT, "packages/shared/src/ontology/green-goods-ontology.json");
  const flowcharts = blocks.filter((block) => block.startsWith("flowchart"));
  const machines = blocks.filter((block) => block.startsWith("stateDiagram-v2"));
  assert.equal(flowcharts.length, 3);
  assert.equal(machines.length, ontology.state_machines.length);
  assert.match(rendered, /## Lifecycles/);
  const memberCount = (blocks.join("\n").match(/\]:::member/g) ?? []).length;
  assert.equal(memberCount, ontology.entities.length);
  const expectedEdges = ontology.entities.reduce(
    (sum, entity) => sum + (entity.relationships ?? []).length,
    0,
  );
  const renderedEdges = flowcharts.join("\n").split("\n").filter((line) => line.includes("-->")).length;
  assert.equal(renderedEdges, expectedEdges);
  assert.match(flowcharts[0], /garden\[[^\]]*\]:::member/);
  assert.doesNotMatch(flowcharts[0], /commitment_pool\[[^\]]*\]:::member/);
  assert.match(flowcharts[2], /commitment_pool\[[^\]]*\]:::member/);
  // Mermaid ends a state-diagram label at `;` or `:`; a long label is unreadable on the arrow.
  const arrowLines = machines.flatMap((block) => block.split("\n").filter((line) => line.includes("-->")));
  const expectedArrows = ontology.state_machines.reduce(
    (sum, machine) => sum + machine.transitions.reduce((inner, t) => inner + t.from.length * t.to.length, 0),
    0,
  );
  assert.equal(arrowLines.length, expectedArrows);
  for (const line of arrowLines) assert.match(line, /^ {2}\w+ --> \w+: [^;:]{1,61}$/, line);
  for (const machine of ontology.state_machines) {
    const section = rendered.slice(rendered.indexOf(`### ${machine.id} {#${machine.id}}`));
    const table = section.slice(section.indexOf("| From | To | Layer | Mechanism |"), section.indexOf("\n\n", section.indexOf("| From |")));
    assert.equal(table.split("\n").length - 2, machine.transitions.length, `${machine.id} mechanism rows`);
  }
});

test("state labels keep the first clause, drop detail past the cap, and never carry `;` or `:`", () => {
  assert.equal(stateLabel("claimCommitment → CommitmentAccepted; the pool records the claim"), "claimCommitment → CommitmentAccepted");
  assert.equal(stateLabel("recordRepayment clearing the balance → LoanRepaid(recoveredFromDefault = true); default is not terminal"), "recordRepayment clearing the balance → LoanRepaid");
  assert.equal(stateLabel("a label with a colon: detail"), "a label with a colon- detail");
  const long = stateLabel("x".repeat(80));
  assert.equal(long.length, 60);
  assert.ok(long.endsWith("…"));
  assert.equal(stateLabel("first sentence. second sentence"), "first sentence");
  assert.equal(stateLabel("one — two"), "one");
});

test("skills catalog prefers a skill README and falls back to the SKILL.md description", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, ".claude/skills/alpha"), { recursive: true });
    mkdirSync(path.join(root, ".claude/skills/beta"), { recursive: true });
    writeFileSync(
      path.join(root, ".claude/skills/alpha/SKILL.md"),
      "---\nname: alpha\ndescription: Alpha description sentence.\n---\nBody\n",
    );
    writeFileSync(
      path.join(root, ".claude/skills/alpha/README.md"),
      "# Alpha\n\nAlpha readme purpose paragraph.\n\n**When to use it:** When alpha applies.\n\n" +
        "**What you get:** An alpha result.\n\n**How to invoke:** Type `/alpha`.\n\n## More\n\nDetail\n",
    );
    writeFileSync(
      path.join(root, ".claude/skills/beta/SKILL.md"),
      "---\nname: beta\ndescription: Beta description sentence.\n---\nBody\n",
    );
    const sources = [
      ".claude/skills/alpha/README.md",
      ".claude/skills/alpha/SKILL.md",
      ".claude/skills/beta/SKILL.md",
    ];
    const rendered = renderSkills({ root, sources, digest: "sha256:test" });
    assert.match(rendered, /## alpha \{#alpha\}\n\nAlpha readme purpose paragraph\./);
    assert.match(
      rendered,
      /- \*\*When to use it:\*\* When alpha applies\.\n- \*\*What you get:\*\* An alpha result\.\n- \*\*How to invoke:\*\* Type `\/alpha`\./,
    );
    assert.doesNotMatch(rendered, /Alpha description sentence\./);
    assert.match(rendered, /## beta \{#beta\}\n\nBeta description sentence\./);
    assert.doesNotMatch(rendered, /^### /m, "skill headings sit directly under the page title");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("skills catalog projects every repository skill", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/agentic/skills.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const skills = readdirSync(path.join(REPO_ROOT, ".claude/skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.ok(skills.length > 0);
  for (const skill of skills) {
    const start = rendered.indexOf(`## ${skill} {#${skill}}`);
    assert.notEqual(start, -1, `${skill} must have a catalog entry`);
    const next = rendered.indexOf("\n## ", start + 1);
    const entry = rendered.slice(start, next === -1 ? undefined : next);
    for (const label of ["When to use it", "What you get", "How to invoke"]) {
      assert.ok(entry.includes(`- **${label}:**`), `${skill} must say ${label} (add it to its README)`);
    }
  }
  assert.match(rendered, /tree\/develop\/\.claude\/skills\/research/);
  assert.ok(rendered.indexOf("## Catalog") < rendered.indexOf(`## ${skills[0]} {#`));
  assert.equal((rendered.match(/^\| \[[a-z-]+\]\(#[a-z-]+\) \| /gm) ?? []).length, skills.length);
});

test("integration projections move to one data file with per-network and indexing facts", () => {
  const projections = createProjections(REPO_ROOT);
  assert.ok(
    !projections.some((item) => item.output === "docs/docs/builders/integrations/hats.mdx"),
    "per-integration MDX projections should be retired in favor of the data file",
  );
  const projection = projections.find(
    (item) => item.output === "docs/src/data/integration-projections.json",
  );
  assert.ok(projection);
  const payload = JSON.parse(renderProjection(REPO_ROOT, projection));
  assert.deepEqual(Object.keys(payload.integrations), [
    "cookie-jar",
    "eas",
    "ens",
    "gardens",
    "hats",
    "hypercerts",
    "karma",
    "octant",
    "tokenbound",
  ]);
  assert.ok(
    payload.integrations.eas.networks.some((network) => network.recorded.includes("workApprovalResolver")),
    "the EAS projection records the Green Goods resolvers a network deployed",
  );
  const hats = payload.integrations.hats;
  assert.ok(
    hats.networks.some(
      (network) => network.chainId === 42161 && network.recorded.includes("hatsModule"),
    ),
  );
  assert.ok(Array.isArray(hats.indexedContracts));
  assert.equal(typeof payload.digest, "string");
  assert.ok(hats.totalNetworks >= hats.networks.length);
});

test("guided journeys keep each handoff and known gate beside its Test ID", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/quality/test-cases.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const catalog = readJson(REPO_ROOT, "scripts/data/qa-test-catalog.json");
  const escapeMarkdown = (value) => String(value).replaceAll("|", "\\|").replaceAll("`", "&#96;");

  for (const journey of catalog.journeys) {
    let stepNumber = 0;
    for (const [index, step] of journey.steps.entries()) {
      stepNumber += 1;
      const start = rendered.indexOf(`${stepNumber}. \`${step.caseId}\``);
      assert.notEqual(start, -1, `${step.caseId} must be rendered in journey order`);
      const nextStep = journey.steps[index + 1];
      const nextStart = nextStep
        ? rendered.indexOf(`${stepNumber + 1}. \`${nextStep.caseId}\``, start)
        : rendered.indexOf("\n### ", start);
      const section = rendered.slice(start, nextStart === -1 ? undefined : nextStart);

      if (step.handoff) {
        assert.ok(
          section.includes(`- **Handoff:** ${escapeMarkdown(step.handoff)}`),
          `${step.caseId} must retain its handoff`,
        );
      }
      if (step.knownGate) {
        assert.ok(
          section.includes(`- **Known gate:** ${escapeMarkdown(step.knownGate)}`),
          `${step.caseId} must retain its known gate`,
        );
      }
    }
  }
});

test("task routing projects public ownership and one-way synchronization", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/agentic/task-routing.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /## Ownership and synchronization/);
  assert.match(rendered, /plan_hubs -->\|mirrors visibility\| linear/);
  assert.match(rendered, /qa_catalog -->\|defines runs\| private_qa_evidence/);
  assert.doesNotMatch(rendered, /PRD-\d+|In Progress|authenticated Vercel/);
});

test("command inventory reads root first, then packages in contributor order, then docs, with copyable cells", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/packages/commands.mdx");
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const headings = [...rendered.matchAll(/^## (.+?) \(\d+\)$/gm)].map((match) => match[1]);
  assert.deepEqual(headings, [
    "Repository root",
    "packages/client",
    "packages/admin",
    "packages/agent",
    "packages/shared",
    "packages/indexer",
    "packages/contracts",
    "packages/qa",
    "docs",
  ]);
  assert.equal((rendered.match(/^import \{CopyCommand\} from "@site\/src\/components\/docs";$/gm) ?? []).length, 1);
  assert.ok(rendered.includes('<CopyCommand command="bun run --cwd docs build" />'));
  assert.throws(() => orderCommandManifests(COMMAND_MANIFEST_ORDER.slice(1)), /Missing manifests: package.json/);
  assert.throws(() => orderCommandManifests([...COMMAND_MANIFEST_ORDER, "packages/new/package.json"]), /Unlisted manifests/);
});

test("copyable commands encode the characters MDX attributes and table cells cannot carry", () => {
  assert.equal(
    copyCommand('bun run x -- --sender <addr> && echo "a|b"'),
    '<CopyCommand command="bun run x -- --sender &lt;addr&gt; &amp;&amp; echo &quot;a&#124;b&quot;" />',
  );
  assert.throws(() => copyCommand("bun run a\nbun run b"), /cannot span lines/);
});

function jsonFilesUnder(directory) {
  const files = [];
  const visit = (relative) => {
    for (const entry of readdirSync(path.join(REPO_ROOT, relative), { withFileTypes: true })) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(child);
      else if (entry.name.endsWith(".json")) files.push(child);
    }
  };
  visit(directory);
  return files;
}

test("deployments page links every recorded address and schema UID and keeps operator identities off it", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/reference/deployments.mdx");
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const arbitrum = readJson(REPO_ROOT, "packages/contracts/deployments/42161-latest.json");
  assert.match(rendered, /^title: Deployments & Addresses$/m);
  assert.ok(rendered.indexOf("## Arbitrum One (42161)") < rendered.indexOf("## Celo (42220)"));
  assert.ok(rendered.includes(`<CopyCommand command="${arbitrum.workApprovalResolver}" />`));
  assert.ok(rendered.includes(`[arbiscan.io](https://arbiscan.io/address/${arbitrum.workApprovalResolver})`));
  assert.ok(rendered.includes(`https://arbitrum.easscan.org/schema/view/${arbitrum.schemas.workSchemaUID}`));
  assert.ok(rendered.includes("| commitmentPoolingModule (proxy) |"));
  assert.ok(rendered.includes("| commitmentPoolingModule (implementation) |"));
  assert.match(rendered, /Recorded as the zero address on this network: [^\n]*`ensReceiver`/);

  // Any hex value stored under an operator, receipt, or safe path must stay off the page unless
  // the same value is also a listed contract.
  const OPERATIONAL = /(owner|deployer|^manager|managers|safe|multisig|sender|signer|deploymentDefaults|releaseReceipts|boundaries|transactionHash|blockHash|validator|authorizedIssuer)/i;
  const hidden = new Set();
  const walk = (value, segments) => {
    if (Array.isArray(value)) value.forEach((item) => walk(item, segments));
    else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) walk(child, [...segments, key]);
    else if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$|^0x[a-fA-F0-9]{64}$/.test(value) && segments.some((segment) => OPERATIONAL.test(segment))) {
      hidden.add(value.toLowerCase());
    }
  };
  for (const file of jsonFilesUnder("packages/contracts/deployments")) walk(readJson(REPO_ROOT, file), []);
  assert.ok(hidden.size > 0, "the artifacts carry operator data this test guards");
  const listed = new Set(
    projection.sources
      .filter((source) => /deployments\/\d+-latest\.json$/.test(source))
      .flatMap((source) => collectRenderableAddresses(readJson(REPO_ROOT, source)).map((entry) => entry.value.toLowerCase())),
  );
  const page = rendered.toLowerCase();
  const leaks = [...hidden].filter((value) => !listed.has(value) && page.includes(value));
  assert.deepEqual(leaks, []);
  for (const receipt of Object.values(arbitrum.releaseReceipts ?? {})) assert.equal(page.includes(receipt.transactionHash.toLowerCase()), false);
});

test("renderable deployment addresses stop at the allowlist and the blocked field names", () => {
  const entries = collectRenderableAddresses(readJson(REPO_ROOT, "packages/contracts/deployments/42161-latest.json"));
  const keys = entries.map((entry) => entry.key);
  assert.ok(keys.includes("eas.address"));
  assert.ok(keys.includes("schemas.workSchemaUID"));
  assert.ok(keys.includes("transferManager"));
  assert.ok(keys.some((key) => key.startsWith("unlock.locks.")));
  assert.equal(keys.some((key) => /greenWillConfig|managerDefaults|owner|deployer/i.test(key)), false);
  assert.throws(() => selectSafeFields({ owner: "0x" }, ["owner"]), /Unsafe/);
  assert.throws(() => selectSafeFields({ deployer: "0x" }, ["deployer"]), /Unsafe/);
  assert.throws(() => selectSafeFields({ managerDefaults: "0x" }, ["managerDefaults"]), /Unsafe/);
  assert.throws(() => selectSafeFields({ badgeLockManagers: "0x" }, ["badgeLockManagers"]), /Unsafe/);
  assert.doesNotThrow(() => selectSafeFields({ transferManager: "x" }, ["transferManager"]));
});

test("entity matrix derives integration status from the catalog and the artifacts", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/architecture/entity-matrix.mdx");
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.equal(rendered.includes("Active integrations"), false);
  assert.match(rendered, /^\| Silvi \| Vocabulary mapping only, no code integration \|/m);
  assert.match(rendered, /^\| ENS \| \[ENS\]\(\/builders\/integrations\/ens\) \| [^|]*Sepolia Testnet \(Deployed\)/m);
  assert.match(rendered, /^- \*\*Unlock\*\*: /m);
});

test("workflow catalog covers every workflow file, only CI Gate is required, and the page explains each run", () => {
  const catalog = readJson(REPO_ROOT, "scripts/data/workflow-catalog.json").workflows;
  assert.deepEqual(Object.keys(catalog).sort(), workflowSourcePaths(REPO_ROOT));
  assert.deepEqual(Object.entries(catalog).filter(([, entry]) => entry.required).map(([source]) => source), [".github/workflows/ci-gate.yml"]);
  for (const [source, entry] of Object.entries(catalog)) {
    assert.ok(entry.purpose.trim().length > 20, `${source} purpose`);
    assert.ok(entry.useCase.trim().length > 10, `${source} use case`);
  }
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/quality/gh-actions.mdx");
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /^\| \[CI Gate\]\(#ci-gate\) \| [^|]+\| every pull request \| Yes \|$/m);
  assert.match(rendered, /^### Contracts Nightly \{#contracts-nightly\}$/m);
  assert.ok(rendered.includes("`17 3 * * *` UTC"));
  assert.ok(rendered.includes('<CopyCommand command="bun run test" />'));
});

test("workflow inventory reads display name, sorted jobs, and triggers from the YAML", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "green-goods-workflow-inventory-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
  writeFileSync(
    path.join(root, ".github/workflows/x.yml"),
    'name: Example\non:\n  push:\n    branches: [main]\n    paths:\n      - "a/**"\n  pull_request:\n  schedule:\n    - cron: "1 2 * * *"\n  workflow_dispatch: {}\njobs:\n  b:\n    runs-on: ubuntu-latest\n  a:\n    runs-on: ubuntu-latest\n',
  );
  const [workflow] = workflowInventory(root, [".github/workflows/x.yml"]);
  assert.equal(workflow.display, "Example");
  assert.deepEqual(workflow.jobs, ["a", "b"]);
  assert.deepEqual(workflow.triggers.push.branches, ["main"]);
  assert.deepEqual(workflow.triggers.push.paths, ["a/**"]);
  assert.deepEqual(workflow.triggers.pull_request.paths, []);
  assert.deepEqual(workflow.triggers.schedule.crons, ["1 2 * * *"]);
  assert.ok("workflow_dispatch" in workflow.triggers);
});

test("contract operations group by verb, factor common options, and keep sender addresses out of the ledger", () => {
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/packages/contract-operations.mdx");
  const rendered = renderProjection(REPO_ROOT, projection);
  const headings = [...rendered.matchAll(/^### (.+?) \(\d+\)$/gm)].map((match) => match[1]);
  assert.ok(headings.includes("Deploy") && headings.includes("Settlement"), headings.join(", "));
  assert.equal((rendered.match(/<CopyCommand command="bun run contracts -- /g) ?? []).length >= 92, true);
  assert.match(rendered, /^Options: `--save-artifacts`/m);
  const deploySection = rendered.slice(rendered.indexOf("### Deploy ("), rendered.indexOf("### Upgrade ("));
  assert.ok((deploySection.match(/--first-support-metadata-uri/g) ?? []).length <= 2, "the deploy option list prints once per cluster");
  assert.doesNotMatch(rendered, /0x[a-fA-F0-9]{40}/);
  assert.ok(rendered.includes("--sender &lt;sender&gt;"));
  assert.ok(rendered.indexOf("<details>") < rendered.indexOf("| Previous manifest |"));
  assert.throws(() => assignOperationGroups([{ command: "teleport garden" }]), /Commands without a group: teleport garden/);
});

test("task routing labels every mutation boundary and places every core task in one group", () => {
  for (const token of Object.values(EXPECTED_MUTATION_BOUNDARIES)) assert.ok(mutationBoundaryLabel(token).length > 5);
  assert.throws(() => mutationBoundaryLabel("teleport-only"), /no reader-facing label/);
  const ids = Object.keys(EXPECTED_MUTATION_BOUNDARIES);
  assert.equal(assignTaskGroups(ids).size, ids.length);
  assert.throws(() => assignTaskGroups([...ids, "new-task"]), /Unassigned tasks: new-task/);
  const projection = createProjections(REPO_ROOT).find((item) => item.output === "docs/docs/builders/agentic/task-routing.mdx");
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /^## How an agent uses this$/m);
  assert.match(rendered, /^### Everyday work$/m);
  assert.ok(rendered.includes("Direct, bounded edits (`direct-bounded`)"));
  assert.ok(rendered.indexOf("## Core tasks") < rendered.indexOf("## Authority order"));
});
