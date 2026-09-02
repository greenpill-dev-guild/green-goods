import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generatedFrontmatter,
  normalizeText,
  parseGeneratorArgs,
  renderProjection,
  sourceDigest,
  syncProjections,
} from "./generator-core.mjs";
import { createProjections, projectionSourcePaths } from "./generate.mjs";
import {
  deploymentAddressFields,
  isRecordedAddress,
  packageExports,
  readJson,
  publicRouteRegistrations,
  selectSafeAddressFields,
  selectSafeFields,
  supportedChainIds,
  sourcePathsContaining,
  workflowSourcePaths,
} from "./source-readers.mjs";
import { renderSkills } from "./renderers.mjs";
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

test("every projection source is routed to the Docs workflow", () => {
  for (const source of projectionSourcePaths(REPO_ROOT)) {
    assert.ok(
      selectExpectedWorkflows({ changedPaths: [source], intent: "merge", ci: true }).includes("Docs"),
      `${source} must require the Docs workflow`,
    );
  }
});

test("persona surfaces consume the PWA and admin canvas route authorities", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/journeys/persona-surfaces.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  assert.match(rendered, /Client canonical PWA routes[^\n]*`\/home`/);
  assert.match(rendered, /Admin canvas route segments[^\n]*`hub`/);
});

test("erd projects layered diagrams that keep every entity and relationship", () => {
  const projection = createProjections(REPO_ROOT).find(
    (item) => item.output === "docs/docs/builders/architecture/erd.mdx",
  );
  assert.ok(projection);
  const rendered = renderProjection(REPO_ROOT, projection);
  const blocks = [...rendered.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1]);
  assert.equal(blocks.length, 3);
  const ontology = readJson(REPO_ROOT, "packages/shared/src/ontology/green-goods-ontology.json");
  const memberCount = (blocks.join("\n").match(/\]:::member/g) ?? []).length;
  assert.equal(memberCount, ontology.entities.length);
  const expectedEdges = ontology.entities.reduce(
    (sum, entity) => sum + (entity.relationships ?? []).length,
    0,
  );
  const renderedEdges = blocks.join("\n").split("\n").filter((line) => line.includes("-->")).length;
  assert.equal(renderedEdges, expectedEdges);
  assert.match(blocks[0], /garden\[[^\]]*\]:::member/);
  assert.doesNotMatch(blocks[0], /commitment_pool\[[^\]]*\]:::member/);
  assert.match(blocks[2], /commitment_pool\[[^\]]*\]:::member/);
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
      "# Alpha\n\nAlpha readme purpose paragraph.\n\n## More\n\nDetail\n",
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
    assert.match(rendered, /Alpha readme purpose paragraph\./);
    assert.doesNotMatch(rendered, /Alpha description sentence\./);
    assert.match(rendered, /Beta description sentence\./);
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
  for (const skill of ["research", "review", "ship", "plan", "debug", "qa-session"]) {
    assert.match(rendered, new RegExp(`### ${skill}\\b`));
  }
  assert.match(rendered, /tree\/main\/\.claude\/skills\/research/);
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
    "ens",
    "gardens",
    "hats",
    "hypercerts",
    "karma",
    "octant",
  ]);
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
