import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const checker = new URL("./check-direct-tested-seams.mjs", import.meta.url).pathname;

function fixture({ testSource, baseline = [] }) {
  const root = mkdtempSync(path.join(tmpdir(), "direct-tested-seams-"));
  const sourceDir = path.join(root, "packages/example/src");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(path.join(sourceDir, "subject.ts"), "export const subject = 1;\n");
  writeFileSync(path.join(sourceDir, "subject.test.ts"), testSource);
  const baselinePath = path.join(root, "baseline.json");
  writeFileSync(baselinePath, `${JSON.stringify({ version: 1, violations: baseline }, null, 2)}\n`);
  return { root, baselinePath };
}

function run(input) {
  return spawnSync(process.execPath, [checker, "--root", input.root, "--baseline", input.baselinePath], {
    encoding: "utf8",
  });
}

test("accepts a subject imported through its own specifier", () => {
  const result = run(fixture({ testSource: 'import { subject } from "./subject";\nvoid subject;\n' }));
  assert.equal(result.status, 0, result.stderr);
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

test("allows only exact audited baseline violations", () => {
  const violation =
    "missing-direct-import|packages/example/src/subject.test.ts|packages/example/src/subject.ts";
  const result = run(fixture({ testSource: 'vi.mock("./dependency", () => ({}));\n', baseline: [violation] }));
  assert.equal(result.status, 0, result.stderr);
});

test("rejects stale baseline entries", () => {
  const violation =
    "missing-direct-import|packages/example/src/subject.test.ts|packages/example/src/subject.ts";
  const result = run(
    fixture({ testSource: 'import { subject } from "./subject";\nvoid subject;\n', baseline: [violation] })
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Stale baseline entries/);
});
