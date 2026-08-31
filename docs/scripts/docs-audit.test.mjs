import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const AUDIT = path.resolve(import.meta.dirname, "docs-audit.mjs");
const VERCEL_CONFIG = path.resolve(import.meta.dirname, "../vercel.json");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "green-goods-docs-audit-"));
  mkdirSync(path.join(root, "docs/docs/builders"), { recursive: true });
  mkdirSync(path.join(root, "docs/docs/reference"), { recursive: true });
  mkdirSync(path.join(root, "packages/shared/src/ontology"), { recursive: true });
  writeFileSync(
    path.join(root, "packages/shared/src/ontology/green-goods-ontology.json"),
    JSON.stringify({personas: [{id: "gardener"}, {id: "steward"}, {id: "evaluator"}, {id: "funder"}, {id: "community-member"}]}),
  );
  writeFileSync(path.join(root, "authority.ts"), "export const authority = true;\n");
  writeFileSync(
    path.join(root, "docs/docs/builders/test.mdx"),
    `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Live
slug: /builders/test
source_of_truth:
  - authority.ts
---
# Test
`,
  );
  writeFileSync(
    path.join(root, "docs/docs/reference/product-history.mdx"),
    `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Complete
slug: /reference/product-history
---
# Product history

## Version 1.0 {#version-1-0}
`,
  );
  writeFileSync(path.join(root, "docs/sidebars.ts"), "export default ['builders/test'];\n");
  writeFileSync(
    path.join(root, "docs/docusaurus.config.ts"),
    "export default { redirects: [{ from: '/old', to: '/reference/product-history#version-1-0' }] };\n",
  );
  return root;
}

function runAudit(root) {
  return spawnSync(process.execPath, [AUDIT, "--ci", "--root", root], { encoding: "utf8" });
}

test("accepts existing authority and redirect-fragment targets", () => {
  const root = fixture();
  try {
    const result = runAudit(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Vercel serves Docusaurus HTML at extensionless routes", () => {
  const config = JSON.parse(readFileSync(VERCEL_CONFIG, "utf8"));
  assert.equal(config.cleanUrls, true);
  assert.equal(config.outputDirectory, "build");
});

test("ignores unterminated MDX tags when deriving heading anchors", () => {
  const root = fixture();
  try {
    const file = path.join(root, "docs/docs/reference/product-history.mdx");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace("## Version 1.0 {#version-1-0}", "## Version 1-0 <script"),
    );
    const result = runAudit(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("broken authored authority exits nonzero", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "docs/docs/builders/test.mdx"),
      `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Live
slug: /builders/test
source_of_truth:
  - missing.ts
---
# Test
`,
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /source_of_truth path not found: missing\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unlisted and unreachable public pages exit nonzero", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "docs/docs/builders/hidden.mdx"),
      `---
audience: developer
owner: engineering
last_verified: 2026-08-30
feature_status: Live
slug: /builders/hidden
unlisted: true
source_of_truth:
  - authority.ts
---
# Hidden
`,
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must not set unlisted: true/);
    assert.match(result.stderr, /unreachable from navigation: builders\/hidden/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid ontology audience exits nonzero", () => {
  const root = fixture();
  try {
    const file = path.join(root, "docs/docs/builders/test.mdx");
    writeFileSync(file, readFileSync(file, "utf8").replace("audience: developer", "audience: deployer"));
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid audience identifier: deployer/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("broken markdown fragment exits nonzero", () => {
  const root = fixture();
  try {
    const file = path.join(root, "docs/docs/builders/test.mdx");
    writeFileSync(file, `${readFileSync(file, "utf8")}\n[History](/reference/product-history#missing)\n`);
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Markdown link fragment not found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("orphaned public asset exits nonzero", () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, "docs/static/img"), { recursive: true });
    writeFileSync(path.join(root, "docs/static/img/orphan.svg"), "<svg />\n");
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Public asset has no source consumer/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("downstream public-doc authority exits nonzero", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "AGENTS.md"),
      "`docs/docs/builders/test.mdx` is the active UI contract.\n",
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Implementation authority points downstream into public docs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("broken redirect fragment exits nonzero", () => {
  const root = fixture();
  try {
    writeFileSync(
      path.join(root, "docs/docusaurus.config.ts"),
      "export default { redirects: [{ from: '/old', to: '/reference/product-history#missing' }] };\n",
    );
    const result = runAudit(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Redirect fragment not found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
