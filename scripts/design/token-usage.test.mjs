/** @direct-test-command ./check-tokens.sh */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { filterCommentHits } from "./filter-comment-hits.mjs";

const repo = resolve(import.meta.dirname, "../..");
const checker = readFileSync(join(repo, "scripts/design/check-tokens.sh"), "utf8");
const collectors = checker.slice(checker.indexOf("TW_PALETTE_FAMILIES="),
  checker.indexOf("\nvalidate_usage_baseline\n"))
  + checker.slice(checker.indexOf("ADMIN_CHROME_ALLOWLIST_REGEX="),
    checker.indexOf("\nif ! ADMIN_CHROME_VIOLATIONS="))
  + checker.slice(checker.indexOf("LEGACY_ADMIN_FOCUS_RING_PATTERN="),
    checker.indexOf("\nif ! ADMIN_FOCUS_RING_VIOLATIONS="));
const filterPath = join(repo, "scripts/design/filter-comment-hits.mjs");

function fixture(source, run, extension = "tsx") {
  const root = mkdtempSync(join(tmpdir(), "design-token-usage-"));
  const path = `packages/admin/src/Fixture.${extension}`;
  mkdirSync(join(root, "packages/admin/src"), { recursive: true });
  writeFileSync(join(root, path), source);
  try { return run(root, path); } finally { rmSync(root, { recursive: true, force: true }); }
}

function collect(root, name = "collect_admin_invariant_hits") {
  // Resolve the real scanner beside the checker while its input root is isolated.
  const functions = collectors.replaceAll("node scripts/design/filter-comment-hits.mjs",
    `node '${filterPath}'`);
  return spawnSync("bash", ["-c", `set -o pipefail\nUSAGE_ALLOWLIST_REGEX='\\.test\\.tsx?'\n${functions}\n${name}`], {
    cwd: root, encoding: "utf8",
  });
}

test("cockpit token sweep ignores the original comment-only failure", () => {
  fixture("// The old story looked for `.text-primary-base` links.\nexport const ok = 'text-primary-dark';\n", (root) => {
    const result = collect(root);
    assert.ok([0, 1].includes(result.status), result.stderr);
    assert.equal(result.stdout, "");
  });
});

test("cockpit sweep rejects real forbidden classes alongside comments", () => {
  fixture("const view = <div className=\"text-primary-base\" />; // text-error-base\n", (root) => {
    const result = collect(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /className="text-primary-base"/);
  });
});

test("multiline classes and template expressions remain scanned", () => {
  fixture("const view = <div className={`\n  text-primary-base\n  ${true ? 'text-error-base' : 'text-error-dark'}\n`} />;\n", (root) => {
    const result = collect(root);
    assert.match(result.stdout, /text-primary-base/);
    assert.match(result.stdout, /text-error-base/);
  });
});

test("block comments and JSX comments do not create token hits", () => {
  fixture("/*\n text-primary-base\n */\nconst view = <div>{/* text-error-base */}</div>;\n", (root) => {
    const result = collect(root);
    assert.ok([0, 1].includes(result.status), result.stderr);
    assert.equal(result.stdout, "");
  });
});

test("CSS comments are ignored while actual hardcoded colours still fail", () => {
  fixture("/* color: #fff; */\n.good { color: var(--text); }\n.bad { color: #f00; }\n", (root) => {
    const result = collect(root, "collect_usage_hits");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /color: #f00/);
    assert.doesNotMatch(result.stdout, /color: #fff/);
  }, "css");
  fixture('.good { background: url("asset.png" /* color: #fff */); }\n', (root, path) => {
    assert.equal(filterCommentHits(`${path}:1:CSS row`, "#fff", root), "");
  }, "css");
});

test("comment-like text in strings, regexes and CSS URLs is preserved", () => {
  fixture("const rx = /\\/\\//;\nconst view = <div className=\"text-primary-base\" data-url=\"https://example.test\" />;\n", (root, path) => {
    const row = `${path}:2:original row`;
    assert.equal(filterCommentHits(row, "text-primary-base", root), row);
  });
  fixture(".bad { background: url(https://example.test/*asset); color: #f00; }\n", (root, path) => {
    const row = `${path}:1:original CSS row`;
    assert.equal(filterCommentHits(row, "#f00", root), row);
  }, "css");
});

test("invalid input, escaping paths, bad expressions and invalid source fail closed", () => {
  fixture("const x = 1;\n", (root, path) => {
    assert.throws(() => filterCommentHits("bad input", "x", root), /grep input/);
    assert.throws(() => filterCommentHits(`${path}:0:x`, "x", root), /line number/);
    assert.throws(() => filterCommentHits(`${path}:1:x`, "[", root), /expression failed/);
    assert.throws(() => filterCommentHits("", "[", root), /expression failed/);
    const outside = join(root, "outside.ts");
    writeFileSync(outside, "const x = 1;");
    assert.throws(() => filterCommentHits(`${outside}:1:x`, "x", root), /within packages/);
  });
  fixture("const view = <div;\n", (root, path) => {
    assert.throws(() => filterCommentHits(`${path}:1:x`, "x", root));
  });
});

test("CLI rejects unknown arguments and malformed stdin rather than passing", () => {
  fixture("const x = 1;\n", (root) => {
    const badArgs = spawnSync(process.execPath, [filterPath, "x", "--unknown"], { cwd: root, encoding: "utf8" });
    assert.equal(badArgs.status, 2);
    const badInput = spawnSync(process.execPath, [filterPath, "x"], { cwd: root, input: "malformed", encoding: "utf8" });
    assert.equal(badInput.status, 2);
  });
});

test("a parser failure cannot be mistaken for an empty collection", () => {
  fixture('const view = <div className="text-primary-base"', (root) => {
    const result = collect(root);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Token source scan failed/);
  });
});

const sourceCollectors = [
  "collect_usage_hits", "collect_admin_invariant_hits", "collect_admin_wrapper_bypass_hits",
  "collect_admin_raw_type_size_hits", "collect_admin_view_m3_colour_hits",
  "collect_admin_chrome_violations", "collect_admin_focus_ring_violations",
];

test("every source collector accepts a complete scan with no matches", () => {
  fixture("const ok = 1;\n", root => {
    mkdirSync(join(root, "packages/shared/src/components/Canvas"), { recursive: true });
    for (const name of sourceCollectors) {
      const result = collect(root, `collect_optional_hits ${name}`);
      assert.equal(result.status, 0, `${name}: ${result.stderr}`);
      assert.equal(result.stdout, "", name);
    }
  });
});

test("source read errors survive later no-match filters in every collector", () => {
  fixture("const ok = 1;\n", root => {
    mkdirSync(join(root, "packages/shared/src/components/Canvas"), { recursive: true });
    const unreadable = join(root, "packages/admin/src/Unreadable.tsx");
    writeFileSync(unreadable, "const ok = 1;\n");
    chmodSync(unreadable, 0);
    try {
      for (const name of sourceCollectors) {
        const result = collect(root, `collect_optional_hits ${name}`);
        assert.equal(result.status, 2, `${name}: ${result.stderr}`);
        assert.equal(result.stdout, "", name);
      }
    } finally { chmodSync(unreadable, 0o600); }
  });
});
