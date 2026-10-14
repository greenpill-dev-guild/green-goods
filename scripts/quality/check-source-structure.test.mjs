import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { fixtureGitEnvironment } from "../lib/dev-shared.js";
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

test("a run with no base judges committed work against origin/develop", (t) => {
  // The checker finds its repository from its own location, so the fixture carries copies.
  const checker = Object.fromEntries(
    [
      "scripts/quality/check-source-structure.js",
      "scripts/quality/check-staged-modules.mjs",
      "scripts/lib/git-guardrails.mjs",
    ].map((path) => [path, readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")]),
  );
  const path = "packages/shared/src/utils/sample.ts";
  const lines = (count) =>
    Array.from({ length: count }, (_, index) => `const line${index} = ${index};\n`).join("");
  const root = fixture({
    ...checker,
    "package.json": '{ "type": "module" }\n',
    "packages/shared/package.json": '{ "exports": { ".": "./src/index.ts" } }\n',
    [path]: lines(480),
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { SOURCE_STRUCTURE_BASE_REF: _unset, ...environment } = fixtureGitEnvironment();
  const git = (...args) => execFileSync("git", args, { cwd: root, env: environment, stdio: "ignore" });
  git("init");
  git("add", ".");
  git("commit", "-m", "seed the base");
  git("update-ref", "refs/remotes/origin/develop", "HEAD");
  writeFileSync(join(root, path), lines(513));
  git("commit", "-am", "grow past the modified-file cap");

  const result = spawnSync(process.execPath, ["scripts/quality/check-source-structure.js"], {
    cwd: root,
    env: environment,
    encoding: "utf8",
  });

  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /sample\.ts: modified file at 513 lines/);
});

test("main promotion retains the existing cap only for unchanged accepted develop files", (t) => {
  const checker = Object.fromEntries(
    [
      "scripts/quality/check-source-structure.js",
      "scripts/quality/check-staged-modules.mjs",
      "scripts/lib/git-guardrails.mjs",
    ].map((path) => [path, readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")]),
  );
  const path = "packages/shared/src/utils/sample.ts";
  const lines = (count) =>
    Array.from({ length: count }, (_, index) => `const line${index} = ${index};\n`).join("");
  const root = fixture({
    ...checker,
    "package.json": '{ "type": "module" }\n',
    "packages/shared/package.json": '{ "exports": { ".": "./src/index.ts" } }\n',
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { SOURCE_STRUCTURE_BASE_REF: _unset, ...environment } = fixtureGitEnvironment();
  const git = (...args) => execFileSync("git", args, { cwd: root, env: environment, stdio: "pipe" }).toString().trim();
  git("init");
  git("add", ".");
  git("commit", "-m", "seed main");
  const main = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", main);
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), lines(400));
  git("add", path);
  git("commit", "-m", "accepted develop source");
  const accepted = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/develop", accepted);
  const run = (base = main) => spawnSync(process.execPath, ["scripts/quality/check-source-structure.js", "--base", base], {
    cwd: root, env: environment, encoding: "utf8",
  });
  const unchanged = run();
  assert.equal(unchanged.status, 0, `${unchanged.stdout}${unchanged.stderr}`);

  // Uncommitted or committed changes after develop acceptance still face the new-file cap.
  writeFileSync(join(root, path), lines(401));
  const dirty = run();
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /sample\.ts: new file at 401 lines/);
  git("commit", "-am", "change the accepted source");
  assert.match(run().stderr, /sample\.ts: new file at 401 lines/);
  writeFileSync(join(root, path), lines(400));
  git("commit", "-am", "restore accepted source");

  const newPath = "packages/shared/src/utils/new.ts";
  writeFileSync(join(root, newPath), lines(400));
  assert.match(run().stderr, /new\.ts: new file at 400 lines/);
  rmSync(join(root, newPath));

  // A different comparison base must not inherit main's promotion classification.
  writeFileSync(join(root, "other.txt"), "other\n");
  git("add", "other.txt");
  git("commit", "-m", "unrelated comparison base");
  const other = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", other);
  assert.match(run(main).stderr, /sample\.ts: new file at 400 lines/);
  git("update-ref", "refs/remotes/origin/main", main);

  // A diverged develop branch cannot approve source that this candidate never accepted.
  git("checkout", "--detach", accepted);
  writeFileSync(join(root, "develop-only.txt"), "develop only\n");
  git("add", "develop-only.txt");
  git("commit", "-m", "diverged develop");
  git("update-ref", "refs/remotes/origin/develop", "HEAD");
  git("checkout", "--detach", other);
  assert.match(run().stderr, /sample\.ts: new file at 400 lines/);

  // Existing and frozen ceilings remain binding even when the blob matches develop.
  writeFileSync(join(root, path), lines(501));
  const frozenPath = "packages/agent/src/handlers/index.ts";
  mkdirSync(dirname(join(root, frozenPath)), { recursive: true });
  writeFileSync(join(root, frozenPath), lines(509));
  git("add", path, frozenPath);
  git("commit", "-m", "oversized accepted source");
  git("update-ref", "refs/remotes/origin/develop", "HEAD");
  const oversized = run();
  assert.equal(oversized.status, 1);
  assert.match(oversized.stderr, /sample\.ts: modified file at 501 lines/);
  assert.match(oversized.stderr, /handlers\/index\.ts: 509 lines, above frozen ceiling 508/);
});

test("enforces capability direction across relative paths, aliases and import syntax", () => {
  const cases = [
    ["stores/transitions/assessment.ts", 'import { step } from "../../hooks/admin-ui/hypercerts/wizardTransitions";'],
    ["stores/transitions/assessment.ts", 'import type { ButtonProps } from "@shared/components/Button";'],
    ["stores/transitions/assessment.ts", 'export { state } from "../../types/../providers/Auth";'],
    ["stores/transitions/assessment.ts", 'const load = () => import("@green-goods/shared/hooks/app/useOnlineStatus");'],
    ["stores/transitions/assessment.ts", 'type Props = import("../../components/Button").Props;'],
    ["stores/transitions/assessment.ts", 'import UI = require("../../components/Button");'],
    ["modules/wallet/send.ts", 'import { funding } from "../commitment-pooling/funding";'],
    ["modules/auth/sign.ts", 'export * from "@green-goods/shared/profile-avatar";'],
    ["modules/wallet/send.ts", 'import { funding } from "@shared/modules/commitment-pooling";'],
    ["modules/auth/sign.ts", 'const avatar = require("../../profile-avatar/index.ts");'],
    ["modules/auth/sign.ts", 'import { sign } from "@green-goods/shared";'],
    ["modules/wallet/send.ts", 'import { sign } from "../index";'],
  ];
  for (const [relativePath, source] of cases) {
    const path = `packages/shared/src/${relativePath}`;
    const root = fixture({ [path]: source });
    try {
      const findings = audit(root, [path]).filter((finding) => finding.rule === "capability-boundary");
      assert.equal(findings.length, 1, `${relativePath}: ${source}`);
      assert.equal(findings[0].baselineEligible, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("resolves declared public aliases to their capability owner", () => {
  const path = "packages/shared/src/stores/transitions/assessment.ts";
  const root = fixture({
    "packages/shared/package.json": JSON.stringify({ exports: { "./cards": "./src/components/Cards/index.ts" } }),
    [path]: 'import { Card } from "@green-goods/shared/cards";',
  });
  try {
    assert.equal(audit(root, [path]).filter((finding) => finding.rule === "capability-boundary").length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("allows capability consumers, pure state dependencies and comments describing imports", () => {
  const files = {
    "packages/shared/src/stores/transitions/assessment.ts": [
      'import { step } from "./wizard-navigation";',
      'import type { State } from "../useCreateAssessmentStore";',
      'import type { Address } from "../../types/domain";',
      '// import { useUI } from "../../hooks/ui/useUI";',
      '/* export * from "@shared/components/Button"; */',
      'const example = `import { useUI } from "../../hooks/ui/useUI";`;',
      'const value = <string>input;',
    ].join("\n"),
    "packages/shared/src/modules/auth/surface.tsx": 'const hint = <span>Signing</span>;',
    "packages/shared/src/modules/wallet/send.ts": 'import { ABI } from "../../utils/blockchain/abis/goodDollar";',
    "packages/shared/src/modules/profile-avatar/publisher.ts": 'import { sign } from "../auth/account-message-signer";',
    "packages/shared/src/hooks/client-ui/wallet/useCeloWallet.ts": 'import { settlement } from "../../../modules/commitment-pooling/funding";',
    "packages/shared/src/hooks/admin-ui/hub/useAssessment.ts": 'import { select } from "../../../stores/transitions/assessment";',
  };
  const root = fixture(files);
  try {
    assert.deepEqual(audit(root, Object.keys(files)).filter((finding) => finding.rule === "capability-boundary"), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects imports that bypass the import seams, in tests and mocks too", () => {
  const files = {
    "packages/admin/src/__tests__/root.test.tsx": 'vi.mock("@green-goods/shared", () => ({}));',
    "packages/client/src/views/Garden.tsx": 'import { useGarden } from "@green-goods/shared/hooks";',
    "packages/admin/src/__tests__/undeclared.test.tsx": 'vi.mock("@green-goods/shared/hooks/garden/useMissing");',
    "packages/client/src/views/Deep.stories.tsx": 'import { cn } from "../../../shared/src/utils/styles/cn";',
    "packages/shared/src/components/Form/Wizard.tsx": 'import { useTimeout } from "../../hooks";',
    "packages/shared/src/modules/data/pools.ts": 'import { queryKeys } from "../../config/query-keys/registry";',
    "packages/shared/src/utils/app/chain.ts": 'import { DEFAULT_CHAIN_ID } from "../../config/blockchain";',
    "packages/shared/src/stores/useSelf.ts": 'import { logger } from "@green-goods/shared";',
  };
  const root = fixture(files);
  try {
    const seams = audit(root, Object.keys(files), { sharedExportKeys: new Set([".", "./hooks/auth/*"]) })
      .filter((finding) => finding.rule === "import-seam")
      .map((finding) => finding.id);
    assert.deepEqual(seams, [
      "import-seam:packages/admin/src/__tests__/root.test.tsx:shared-root",
      "import-seam:packages/admin/src/__tests__/undeclared.test.tsx:undeclared:@green-goods/shared/hooks/garden/useMissing",
      "import-seam:packages/client/src/views/Deep.stories.tsx:deep-relative",
      "import-seam:packages/client/src/views/Garden.tsx:broad-barrel",
      "import-seam:packages/shared/src/components/Form/Wizard.tsx:internal-barrel",
      "import-seam:packages/shared/src/modules/data/pools.ts:query-key-registry",
      "import-seam:packages/shared/src/stores/useSelf.ts:shared-root",
      "import-seam:packages/shared/src/utils/app/chain.ts:default-chain",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts leaf imports, and leaves Shared's own barrels, tests and commented examples alone", () => {
  const files = {
    "packages/admin/src/__tests__/leaf.test.tsx": [
      'import { renderHook } from "@testing-library/react";',
      'vi.mock("@green-goods/shared/hooks/auth/useAuth");',
      '// vi.mock("@green-goods/shared");',
    ].join("\n"),
    "packages/client/src/views/Leaf.tsx": 'import { useAuth } from "@green-goods/shared/hooks/auth/useAuth";',
    "packages/shared/src/components/Form/Wizard.tsx": 'import { useTimeout } from "../../hooks/utils/useTimeout";',
    "packages/shared/src/hooks/index.ts": 'export * from "../utils";',
    "packages/shared/src/__tests__/hooks.test.ts": 'import { useTimeout } from "../hooks";',
    "packages/shared/src/utils/app/chain.ts": 'import { DEFAULT_CHAIN_ID } from "../../config/default-chain";',
  };
  const root = fixture(files);
  try {
    const seams = audit(root, Object.keys(files), { sharedExportKeys: new Set([".", "./hooks/auth/*"]) })
      .filter((finding) => finding.rule === "import-seam");
    assert.deepEqual(seams, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
