import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  collectStructureViolations,
  findStructureBaselineGrowth,
  reconcileStructureBaseline,
} from "./check-source-structure.js";

const STAGED_MARKER = "/** Staged — not yet wired into the live checkout. */\n";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "gg-source-structure-"));
  for (const [path, source] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
}

function audit(root, files, options = {}) {
  return collectStructureViolations({
    root,
    filePaths: files,
    changedFilePaths: options.changedFilePaths ?? files,
    stagedModulePaths: options.stagedModulePaths ?? [],
    sharedExportKeys: options.sharedExportKeys ?? new Set([".", "./components"]),
  });
}

function ids(violations) {
  return violations.map((violation) => violation.id);
}

test("rejects misplaced package-root source", () => {
  const path = "packages/client/src/orphan.ts";
  const root = fixture({ [path]: "export const orphan = true;\n" });
  try {
    assert(ids(audit(root, [path])).some((id) => id.startsWith(`placement:${path}`)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("allows the selected client WebMCP root module", () => {
  const path = "packages/client/src/webmcp.ts";
  const root = fixture({ [path]: "export const webmcp = true;\n" });
  try {
    assert(!ids(audit(root, [path])).some((id) => id.startsWith(`placement:${path}`)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a component whose client filename is not PascalCase", () => {
  const path = "packages/client/src/components/goodCard.tsx";
  const root = fixture({ [path]: "export function GoodCard() { return null; }\n" });
  try {
    assert(ids(audit(root, [path])).some((id) => id.startsWith(`naming:${path}`)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects hook definitions outside shared", () => {
  const path = "packages/admin/src/components/feature.ts";
  const root = fixture({ [path]: "export function useFeature() { return true; }\n" });
  try {
    assert(ids(audit(root, [path])).includes(`hook-location:${path}:useFeature`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects private and undeclared shared imports", () => {
  const path = "packages/client/src/App.tsx";
  const root = fixture({
    [path]: [
      'import "@green-goods/shared/components";',
      'import "@green-goods/shared/src/private";',
      'import "@green-goods/shared/not-exported";',
      "export function App() { return null; }",
      "",
    ].join("\n"),
  });
  try {
    const findings = ids(audit(root, [path]));
    assert(!findings.some((finding) => finding.includes("@green-goods/shared/components")));
    assert(findings.includes(`shared-import:${path}:@green-goods/shared/src/private`));
    assert(findings.includes(`shared-import:${path}:@green-goods/shared/not-exported`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects an unused named export in a changed implementation file", () => {
  const path = "packages/client/src/components/helpers.ts";
  const root = fixture({ [path]: "export const unusedHelper = true;\n" });
  try {
    assert(ids(audit(root, [path])).includes(`dead-export:${path}:unusedHelper`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts a value export consumed only by a direct test", () => {
  const implementation = "packages/client/src/components/helper.ts";
  const directTest = "packages/client/src/__tests__/helper.test.ts";
  const files = {
    [implementation]: "export const testedHelper = true;\n",
    [directTest]: 'import { testedHelper } from "../components/helper";\nvoid testedHelper;\n',
  };
  const root = fixture(files);
  try {
    assert.deepEqual(
      audit(root, Object.keys(files), { changedFilePaths: [implementation] }).filter(
        (finding) => finding.rule === "dead-export"
      ),
      []
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("skips naming and dead-export checks for a marked staged module", () => {
  const path = "packages/client/src/components/staged-card.tsx";
  const root = fixture({
    [path]: `${STAGED_MARKER}export function StagedCard() { return null; }\n`,
  });
  try {
    assert.deepEqual(
      audit(root, [path], { stagedModulePaths: [path] }).filter((finding) =>
        ["naming", "dead-export"].includes(finding.rule),
      ),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("skips barrels, tests, and stories as dead-export subjects", () => {
  const files = {
    "packages/client/src/components/index.ts": "export const barrelOnly = true;\n",
    "packages/client/src/components/helper.test.ts": "export const testOnly = true;\n",
    "packages/client/src/components/Helper.stories.tsx": "export const StoryOnly = () => null;\n",
  };
  const root = fixture(files);
  try {
    assert.deepEqual(
      audit(root, Object.keys(files)).filter((finding) => finding.rule === "dead-export"),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("requires an exact baseline that shrinks when a violation disappears", () => {
  const path = "packages/client/src/orphan.ts";
  const root = fixture({ [path]: "export const orphan = true;\n" });
  try {
    const violation = audit(root, [path]).find((finding) => finding.rule === "placement");
    assert(violation);
    assert.equal(reconcileStructureBaseline([violation], new Set()).newViolations.length, 1);
    assert.deepEqual(reconcileStructureBaseline([violation], new Set([violation.id])), {
      newViolations: [],
      staleBaselineIds: [],
    });
    assert.deepEqual(reconcileStructureBaseline([], new Set([violation.id])), {
      newViolations: [],
      staleBaselineIds: [violation.id],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects growth after the initial structure baseline is established", () => {
  const original = new Set(["placement:packages/client/src/orphan.ts:root-file"]);
  const grown = new Set([...original, "naming:packages/client/src/bad-name.ts:no-hyphens"]);
  assert.deepEqual(findStructureBaselineGrowth(grown, original), [
    "naming:packages/client/src/bad-name.ts:no-hyphens",
  ]);
  assert.deepEqual(findStructureBaselineGrowth(grown, null), []);
});
