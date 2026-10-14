/** @direct-test-command ./check-direct-tested-seams.mjs */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const checker = new URL("./check-direct-tested-seams.mjs", import.meta.url).pathname;

function fixture({ testSource, baseline = [], withExport = false }) {
  const root = mkdtempSync(path.join(tmpdir(), "direct-tested-seams-"));
  const packageDir = path.join(root, "packages/example");
  const sourceDir = path.join(packageDir, "src");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(path.join(sourceDir, "subject.ts"), "export const subject = 1;\n");
  writeFileSync(path.join(sourceDir, "consumer.ts"), 'import { subject } from "./subject";\nvoid subject;\n');
  writeFileSync(path.join(sourceDir, "composition.ts"), 'import { subject } from "./subject";\nvoid subject;\n');
  writeFileSync(path.join(sourceDir, "subject.test.ts"), testSource);
  writeFileSync(path.join(sourceDir, "subject.conformance.test.ts"), "export {};\n");
  writeFileSync(path.join(sourceDir, "subject.integration.test.ts"), "export {};\n");
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@green-goods/example",
        exports: withExport ? { "./subject": "./src/subject.ts" } : {},
      },
      null,
      2
    )}\n`
  );
  const baselinePath = path.join(root, "baseline.json");
  writeFileSync(baselinePath, `${JSON.stringify({ version: 1, violations: baseline }, null, 2)}\n`);
  const registryPath = path.join(root, "registry.json");
  writeRegistry(registryPath, []);
  return { root, baselinePath, registryPath };
}

function writeRegistry(registryPath, entries) {
  writeFileSync(registryPath, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`);
}

function run(input, extra = []) {
  return spawnSync(
    process.execPath,
    [
      checker,
      "--root",
      input.root,
      "--baseline",
      input.baselinePath,
      "--registry",
      input.registryPath,
      ...extra,
    ],
    { encoding: "utf8" }
  );
}

function registryEntry(overrides = {}) {
  return {
    id: "example-subject",
    owner: "example",
    lifecycle: "selected",
    criticality: "hotspot",
    modulePath: "packages/example/src/subject.ts",
    publicSpecifier: "@green-goods/example/subject",
    interfaceSummary: "Returns the example subject value.",
    dependencyCategory: "in-process",
    compositionRoots: ["packages/example/src/composition.ts"],
    directConsumers: ["packages/example/src/consumer.ts"],
    proof: {
      direct: ["packages/example/src/subject.test.ts"],
      conformance: ["packages/example/src/subject.conformance.test.ts"],
      integration: ["packages/example/src/subject.integration.test.ts"],
    },
    reviewedAt: "2026-08-24",
    evidenceFingerprint: null,
    ...overrides,
  };
}

function currentFingerprint(input) {
  const printed = run(input, ["--print-fingerprints", "--json"]);
  assert.equal(printed.status, 0, `${printed.stdout}\n${printed.stderr}`);
  return JSON.parse(printed.stdout).fingerprints["example-subject"];
}

test("accepts a subject imported through its own relative specifier", () => {
  const result = run(fixture({ testSource: 'import { subject } from "./subject";\nvoid subject;\n' }));
  assert.equal(result.status, 0, result.stderr);
});

test("prefers a nested same-name subject over a directory index false positive", () => {
  const input = fixture({ testSource: 'import { subject } from "./subject";\nvoid subject;\n' });
  const componentDir = path.join(input.root, "packages/example/src/components/Widget");
  const testDir = path.join(input.root, "packages/example/src/__tests__/components");
  mkdirSync(componentDir, { recursive: true });
  mkdirSync(testDir, { recursive: true });
  writeFileSync(path.join(componentDir, "index.ts"), 'export { Widget } from "./Widget";\n');
  writeFileSync(path.join(componentDir, "Widget.ts"), "export const Widget = 1;\n");
  writeFileSync(
    path.join(testDir, "Widget.test.ts"),
    'import { Widget } from "../../components/Widget/Widget";\nvoid Widget;\n'
  );

  const result = run(input);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("resolves public specifiers through package exports", () => {
  const input = fixture({
    testSource: 'import { subject } from "@green-goods/example/subject";\nvoid subject;\n',
    withExport: true,
  });
  writeRegistry(input.registryPath, [registryEntry()]);
  const fingerprint = currentFingerprint(input);
  writeRegistry(input.registryPath, [
    registryEntry({ lifecycle: "certified", evidenceFingerprint: fingerprint }),
  ]);

  const result = run(input);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("rejects a subject mocked by its own named test", () => {
  const result = run(
    fixture({
      testSource: 'vi.mock("./subject", async () => ({ ...(await import("./subject")) }));\n',
    })
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /mocked-subject/);
  assert.match(result.stderr, /missing-direct-import/);
});

test("rejects certified registry proof that mocks its subject", () => {
  const input = fixture({
    testSource: 'vi.mock("@green-goods/example/subject", () => ({ subject: 1 }));\n',
    withExport: true,
  });
  writeRegistry(input.registryPath, [registryEntry({ lifecycle: "certified" })]);
  const result = run(input);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /registry-self-mocking-proof/);
});

test("rejects certified registry entries with missing proof", () => {
  const input = fixture({
    testSource: 'import { subject } from "@green-goods/example/subject";\nvoid subject;\n',
    withExport: true,
  });
  writeRegistry(input.registryPath, [
    registryEntry({ lifecycle: "certified", proof: { direct: [], conformance: [], integration: [] } }),
  ]);
  const result = run(input);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /registry-missing-direct-proof/);
});

test("rejects duplicate registry IDs", () => {
  const input = fixture({
    testSource: 'import { subject } from "@green-goods/example/subject";\nvoid subject;\n',
    withExport: true,
  });
  writeRegistry(input.registryPath, [registryEntry(), registryEntry()]);
  const result = run(input);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /registry-duplicate-id/);
});

test("rejects duplicate registry public specifiers", () => {
  const input = fixture({
    testSource: 'import { subject } from "@green-goods/example/subject";\nvoid subject;\n',
    withExport: true,
  });
  writeRegistry(input.registryPath, [registryEntry(), registryEntry({ id: "other-subject" })]);
  const result = run(input);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /registry-duplicate-specifier/);
});

test("rejects missing tracked registry paths", () => {
  const input = fixture({
    testSource: 'import { subject } from "@green-goods/example/subject";\nvoid subject;\n',
    withExport: true,
  });
  writeRegistry(input.registryPath, [
    registryEntry({
      lifecycle: "certified",
      proof: {
        direct: ["packages/example/src/missing.test.ts"],
        conformance: ["packages/example/src/subject.conformance.test.ts"],
        integration: ["packages/example/src/subject.integration.test.ts"],
      },
    }),
  ]);
  const result = run(input);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /registry-missing-path/);
});

test("invalidates a certified entry when its evidence fingerprint is stale", () => {
  const input = fixture({
    testSource: 'import { subject } from "@green-goods/example/subject";\nvoid subject;\n',
    withExport: true,
  });
  writeRegistry(input.registryPath, [
    registryEntry({ lifecycle: "certified", evidenceFingerprint: "sha256:stale" }),
  ]);
  const result = run(input);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /registry-stale-fingerprint/);
});

test("allows selected entries to omit certification proof but not certified entries", () => {
  const input = fixture({
    testSource: 'import { subject } from "@green-goods/example/subject";\nvoid subject;\n',
    withExport: true,
  });
  const selected = registryEntry({
    compositionRoots: [],
    directConsumers: [],
    proof: { direct: [], conformance: [], integration: [] },
    evidenceFingerprint: null,
  });
  writeRegistry(input.registryPath, [selected]);
  assert.equal(run(input).status, 0);

  writeRegistry(input.registryPath, [{ ...selected, lifecycle: "certified" }]);
  const certified = run(input);
  assert.equal(certified.status, 1);
  assert.match(`${certified.stdout}\n${certified.stderr}`, /registry-missing-composition-root/);
});

test("allows only exact audited baseline violations", () => {
  const violation =
    "missing-direct-import|packages/example/src/subject.test.ts|packages/example/src/subject.ts";
  const result = run(fixture({ testSource: 'vi.mock("./dependency", () => ({}));\n', baseline: [violation] }));
  assert.equal(result.status, 0, result.stderr);
});

test("rejects stale baseline entries so the exact baseline must shrink", () => {
  const violation =
    "missing-direct-import|packages/example/src/subject.test.ts|packages/example/src/subject.ts";
  const result = run(
    fixture({ testSource: 'import { subject } from "./subject";\nvoid subject;\n', baseline: [violation] })
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Stale baseline entries/);
});

test("fingerprints are deterministic for unchanged evidence", () => {
  const input = fixture({
    testSource: 'import { subject } from "@green-goods/example/subject";\nvoid subject;\n',
    withExport: true,
  });
  writeRegistry(input.registryPath, [registryEntry()]);
  const first = currentFingerprint(input);
  const second = currentFingerprint(input);
  assert.equal(first, second);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.parse(readFileSync(input.registryPath, "utf8")).entries.length, 1);
});
