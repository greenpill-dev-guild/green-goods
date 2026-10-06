/** @direct-test-command ./md-generate.mjs */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repo = resolve(import.meta.dirname, "../..");
const script = join(repo, "scripts/design/md-generate.mjs");
const auditPath = "output/design/client-pwa-token-audit.md";

function fixture(source, work) {
  const root = mkdtempSync(join(tmpdir(), "design-md-audit-"));
  mkdirSync(join(root, "packages/client/src"), { recursive: true });
  mkdirSync(join(root, "packages/shared/src/styles"), { recursive: true });
  writeFileSync(join(root, "DESIGN.md"), readFileSync(join(repo, "DESIGN.md")));
  writeFileSync(join(root, "packages/client/src/Fixture.tsx"), source);
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
  try { work(root, run); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("check mode leaves a readable zero-risk PWA audit", () => {
  fixture('<div className="bg-primary-action text-primary-action-foreground" />;', (root, run) => {
    assert.equal(run().status, 0);
    const result = run("--check");
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(root, auditPath), "utf8"), /Text on bright green: 0/);
  });
});

test("a contrast failure still writes the audit for CI upload", () => {
  fixture('<div className="bg-primary text-white">Send</div>;', (root, run) => {
    const result = run("--check");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unapproved bright-green/);
    assert.ok(existsSync(join(root, auditPath)));
    const audit = readFileSync(join(root, auditPath), "utf8");
    assert.match(audit, /Text on bright green: 1/);
    assert.match(audit, /Fixture.tsx:1/);
    assert.match(audit, /contrast-risk/);
  });
});

test("stale generated tokens fail without losing the PWA report", () => {
  fixture('<div className="bg-primary-action" />;', (root, run) => {
    assert.equal(run().status, 0);
    writeFileSync(join(root, "packages/shared/src/styles/design-md.generated.css"), "stale");
    const result = run("--check");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /artifact is stale/);
    assert.match(readFileSync(join(root, auditPath), "utf8"), /bg-primary-action/);
  });
});

test("source delimiters cannot break the audit table", () => {
  fixture('const view = <div className="bg-primary-action">{left | right}</div>;', (root, run) => {
    assert.equal(run().status, 0);
    const audit = readFileSync(join(root, auditPath), "utf8");
    assert.match(audit, /&lt;div/);
    assert.match(audit, /left \\\| right/);
    assert.match(audit, /&#123;/);
  });
});
