import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { STAGED_MODULES, auditStagedModules } from "./check-staged-modules.mjs";

const MARKER = "/** Staged — not yet wired into the live checkout. */\n";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "gg-staged-modules-"));
  for (const path of STAGED_MODULES) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${MARKER}export const staged = true;\n`);
  }
  return root;
}

test("accepts marked staged modules with no live importer", () => {
  const root = fixture();
  try {
    assert.deepEqual(auditStagedModules(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a staged module without the required marker", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, STAGED_MODULES[0]), "export const staged = true;\n");
    assert.match(auditStagedModules(root).join("\n"), /missing staged marker/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a live source importer outside the staged set", () => {
  const root = fixture();
  try {
    const live = join(root, "packages/client/src/live.ts");
    mkdirSync(dirname(live), { recursive: true });
    writeFileSync(live, 'import "./components/Public/VaultCardEndowFlow";\n');
    assert.match(auditStagedModules(root).join("\n"), /live\.ts imports staged module/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
