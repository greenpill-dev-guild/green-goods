import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { auditDeveloperGuides } from "./developer-guides.mjs";

function fixture(t, markdown) {
  const root = mkdtempSync(path.join(tmpdir(), "gg-guide-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "packages/client"), { recursive: true });
  mkdirSync(path.join(root, "scripts/data"), { recursive: true });
  writeFileSync(path.join(root, "README.md"), markdown);
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { dev: "launcher", "dev:health": "health", "validation:plan": "selector" } }));
  writeFileSync(path.join(root, "packages/client/package.json"), JSON.stringify({ scripts: { test: "runner" } }));
  writeFileSync(path.join(root, "scripts/data/validation-policy.json"), JSON.stringify({ intentOrder: ["qa", "push"] }));
  return root;
}

test("accepts a concise guide and commands in explicit package cwd", async (t) => {
  const root = fixture(t, '# Green Goods\n[Tests](packages/client/README.md#focused-tests)\n```bash\nbun run --cwd packages/client test src/a.test.ts\nbun run validation:plan -- --intent qa\n```\n');
  writeFileSync(path.join(root, "packages/client/README.md"), "# Client\n## Focused tests\n");
  assert.deepEqual(await auditDeveloperGuides(root), []);
});

test("rejects a removed alias and a command in the wrong working directory", async (t) => {
  const root = fixture(t, '`bun run dev:fork`\n```bash\ncd packages/client\nbun run dev\n```\n');
  const issues = await auditDeveloperGuides(root);
  assert.equal(issues.filter((issue) => /Unknown documented command/.test(issue.message)).length, 2);
});

test("rejects missing guides and anchors", async (t) => {
  const root = fixture(t, '# Start\n[Missing](ONBOARDING.md)\n[Bad heading](#setup)\n');
  assert.deepEqual((await auditDeveloperGuides(root)).map((issue) => issue.message), [
    "Local guide target not found: ONBOARDING.md",
    "Local guide anchor not found: #setup",
  ]);
});

test("rejects invalid intents, unknown modes and stale mode membership", async (t) => {
  const root = fixture(t, '`bun run validation:plan -- --intent potato`\n`bun run dev:health -- hosted`\n| local | admin, client, agent, indexer, anvil-arbitrum | Live |\n');
  const issues = await auditDeveloperGuides(root);
  assert.equal(issues.length, 3);
  assert.ok(issues.some((issue) => issue.message.includes("membership")));
});
