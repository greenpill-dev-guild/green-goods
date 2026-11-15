import assert from "node:assert/strict";
import test from "node:test";
import { classifySource, groupComments, main, purgeSource } from "./comment-policy.mjs";

const kinds = (code, file = "example.ts") => classifySource(code, file).map((comment) => comment.kind);

test("licence headers, directives and tool markers are never removed", () => {
  const code = [
    "// SPDX-License-Identifier: MIT",
    "/* eslint-disable no-console */",
    "// @ts-expect-error the fixture omits a field on purpose",
    "const value = /* @vite-ignore */ load(path);",
    "// TEST-QUALITY: allow-small-test-file - one isolated regression",
    "// biome-ignore lint/style/noNonNullAssertion: asserted above",
    "export const PURE = /*#__PURE__*/ create();",
  ].join("\n");
  assert.deepEqual(kinds(code), ["licence", "directive", "directive", "directive", "directive", "directive", "directive"]);
  assert.equal(purgeSource(code, "example.ts").code, code);
});

test("documentation stays on exported declarations and their members, and goes elsewhere", () => {
  const code = [
    "/** Narration on a private helper. */",
    "function helper() {}",
    "/** Public API. */",
    "export interface Shape {",
    "  /** Member docs stay with the export. */",
    "  size: number;",
    "}",
  ].join("\n");
  assert.deepEqual(kinds(code), ["remove", "documentation", "documentation"]);
  assert.equal(purgeSource(code, "example.ts").code.includes("Narration"), false);
});

test("JSDoc that carries types stays in JavaScript", () => {
  assert.deepEqual(kinds("/** @param {string} name */\nfunction greet(name) {}", "example.mjs"), ["documentation"]);
});

test("a run of line comments reads as one comment, kept or removed whole", () => {
  const code = "// The worker stops after 30 s idle in MV3,\n// so remember the id while it runs.\nconst id = 1;\n";
  const comments = groupComments(code, classifySource(code, "example.ts"));
  assert.equal(comments.length, 1);
  // A platform named with its consequence is a dependency constraint, kept for good.
  assert.deepEqual(kinds(code), ["dependency"]);
  assert.equal(purgeSource(code, "example.ts").code, code);
});

test("narration, banners and commented-out code are removed with their lines", () => {
  const code = [
    "// ==== Helpers ====",
    "// Handler for the GardenMinted event",
    "export function onMint() {",
    "  // const legacy = readLegacy();",
    "  return 1; // the result",
    "}",
    "",
  ].join("\n");
  assert.equal(purgeSource(code, "example.ts").code, "export function onMint() {\n  return 1;\n}\n");
});

test("a JSX comment container goes with its comment", () => {
  const code = "export const View = () => (\n  <div>\n    {/* the header */}\n    <h1>Title http://example.org</h1>\n  </div>\n);\n";
  assert.equal(
    purgeSource(code, "example.tsx").code,
    "export const View = () => (\n  <div>\n    <h1>Title http://example.org</h1>\n  </div>\n);\n",
  );
});

test("strings, templates and regular expressions are never read as comments", () => {
  const code = "export const a = '// not a comment';\nexport const b = `/* nor this */`;\nexport const c = /\\/\\/x/g;\n";
  assert.deepEqual(kinds(code), []);
  assert.equal(purgeSource(code, "example.ts").code, code);
});

test("a purge is idempotent, so it can be re-run on any branch", () => {
  const code = "// Narration that goes.\n// TODO keep until the migration lands\nexport const x = 1; // trailing narration\n";
  const once = purgeSource(code, "example.ts").code;
  assert.equal(purgeSource(once, "example.ts").code, once);
  assert.match(once, /TODO keep until the migration lands/);
});

test("Solidity keeps its licence, NatSpec, analyzer directives and constraints, and drops narration", () => {
  const code = [
    "// SPDX-License-Identifier: MIT",
    "pragma solidity ^0.8.28;",
    "",
    "/// @title Garden registry",
    "/// @custom:oz-upgrades-unsafe-allow constructor",
    "contract Registry {",
    '    string internal constant SITE = "https://example.org/a//b"; // the site',
    "    /**",
    "     * @notice Registers a garden.",
    "     */",
    "    function register() external {",
    "        // ---- checks ----",
    "        // solhint-disable-next-line avoid-low-level-calls",
    '        (bool ok, ) = msg.sender.call("");',
    "        // Must stay after the call: the receiver reads the old state.",
    "        ok;",
    "    }",
    "}",
    "",
  ].join("\n");
  assert.deepEqual(kinds(code, "Registry.sol"), [
    "licence", "documentation", "remove", "documentation", "remove", "directive", "constraint",
  ]);
  const purged = purgeSource(code, "Registry.sol").code;
  assert.doesNotMatch(purged, /the site|---- checks/);
  assert.match(purged, /"https:\/\/example\.org\/a\/\/b";\n/);
  assert.match(purged, /@custom:oz-upgrades-unsafe-allow constructor/);
  assert.match(purged, /solhint-disable-next-line/);
  assert.equal(purgeSource(purged, "Registry.sol").code, purged);
});

test("a NatSpec line and a plain comment under it stay separate comments", () => {
  const code = "/// @notice Kept.\n// narration that goes\nuint256 constant X = 1;\n";
  assert.deepEqual(kinds(code, "Lib.sol"), ["documentation", "remove"]);
  assert.equal(purgeSource(code, "Lib.sol").code, "/// @notice Kept.\nuint256 constant X = 1;\n");
});

test("deployed contract sources are never rewritten", () => {
  const out = [];
  const log = console.log;
  console.log = (line) => out.push(line);
  try {
    assert.equal(main(["--check", "packages/contracts/src/tokens/Garden.sol"]), 0);
  } finally {
    console.log = log;
  }
  assert.match(out.join("\n"), /Would remove 0 comment\(s\) from 0 file\(s\)/);
  assert.match(out.join("\n"), /Skipped 1 deployed contract source file/);
});

test("claims go to the owner's table, a named dependency needs a reason, and a bare mention is narration", () => {
  const code = [
    "// TODO: drop once the indexer ships the field",
    "const a = 1;",
    "// Safari rejects the request without a body, so send an empty one",
    "const b = 2;",
    "// Read the garden with viem",
    "const c = 3;",
    "",
  ].join("\n");
  assert.deepEqual(kinds(code), ["constraint", "dependency", "remove"]);
});

test("reasons and warnings survive the purge: only narration goes", () => {
  const code = [
    "/** The secret is required. Falling back to defaults would ship an app that looks signed in and is not. */",
    "function config() {}",
    "// `.js`, not `.ts`: Vercel compiles this to ESM and Node demands an explicit extension. Without it the function crashes at load.",
    'import { resolveCaller } from "../auth.js";',
    "// Never merge onto an assumed-empty base: that would overwrite the whole record.",
    "const previous = read();",
    "// Null rather than absent, so the page can tell signed out from a failed request.",
    "const address = null;",
    "// caseId -> person -> entry, the shape the page renders from.",
    "const entries = {};",
    "",
  ].join("\n");
  assert.deepEqual(kinds(code), ["rationale", "dependency", "constraint", "rationale", "remove"]);
  const purged = purgeSource(code, "example.ts").code;
  assert.doesNotMatch(purged, /caseId -> person/);
  assert.match(purged, /would ship an app/);
  assert.match(purged, /demands an explicit extension/);
});

test("a hashbang is never read as a comment", () => {
  const code = "#!/usr/bin/env node\n// Narration that goes.\nconst x = 1;\n";
  assert.deepEqual(kinds(code, "tool.mjs"), ["remove"]);
  assert.equal(purgeSource(code, "tool.mjs").code, "#!/usr/bin/env node\nconst x = 1;\n");
});

test("only a JSX container that holds just comments goes with them; object and function braces stay", () => {
  const code = "const options = { /* defaults */ };\nfunction noop() { /* nothing */ }\nexport const View = () => <div>{/* a */ /* b */}</div>;\n";
  assert.equal(
    purgeSource(code, "example.tsx").code,
    "const options = { };\nfunction noop() { }\nexport const View = () => <div></div>;\n",
  );
});

test("deleting an inline comment never joins two tokens", () => {
  const code = "function f(a, b, value) {\n  if (a) return/* narration */value;\n  return 1/* note */.toString() + (a +/* note */+b);\n}\n";
  assert.equal(
    purgeSource(code, "example.ts").code,
    "function f(a, b, value) {\n  if (a) return value;\n  return 1 .toString() + (a + +b);\n}\n",
  );
});

test("blank lines change only where a comment line went, never inside a template literal", () => {
  const code = "const text = `a\n\n\nb`;\n\n// Narration that goes.\n\nconst next = 1;\n";
  assert.equal(purgeSource(code, "example.ts").code, "const text = `a\n\n\nb`;\n\nconst next = 1;\n");
  assert.equal(purgeSource("const text = `a\n\n\nb`;\n", "example.ts").code, "const text = `a\n\n\nb`;\n");
});

test("markers that repository tools read are directives", () => {
  const code = [
    "/** Staged \u2014 not yet wired into the live checkout. */",
    "// @direct-test-subject packages/shared/src/modules/work/queue.ts",
    "// @direct-test-command bun run --cwd packages/shared test",
    "// @shared-graph isolate",
    "const x = 1;",
  ].join("\n");
  assert.deepEqual(kinds(code), ["directive", "directive", "directive", "directive"]);
});

test("documentation stays on declarations exported later by name or as the default", () => {
  const code = "/** Counts unread items. */\nfunction CountBadge() {}\n/** The badge. */\nconst Badge = () => null;\n/** Private. */\nfunction helper() {}\nexport { CountBadge };\nexport default Badge;\n";
  assert.deepEqual(kinds(code), ["documentation", "documentation", "remove"]);
});

test("JSDoc-form directives, object and union JSDoc types, and copyright notices in Solidity are kept", () => {
  assert.deepEqual(kinds("/** @vitest-environment jsdom */\nconst x = 1;\n"), ["directive"]);
  assert.deepEqual(kinds("/**\n * @vitest-environment jsdom\n */\nconst x = 1;\n"), ["directive"]);
  assert.deepEqual(kinds("/** @param {{id: string}} value */\nfunction f(value) {}\n", "example.mjs"), ["documentation"]);
  assert.deepEqual(kinds("/** @returns {(string|number)} */\nfunction g() {}\n", "example.mjs"), ["documentation"]);
  assert.deepEqual(kinds("/* Copyright (c) 2026 Example */\ncontract C {}\n", "C.sol"), ["licence"]);
});

test("a removed comment that held a line break leaves one, so automatic semicolons stay", () => {
  const code = "function f(value) {\n  return/* narration\n  */value;\n}\n";
  assert.equal(purgeSource(code, "example.ts").code, "function f(value) {\n  return\nvalue;\n}\n");
});

test("a JSX container whose comment sits on its own line goes with its braces", () => {
  const code = "export const View = () => (\n  <div>\n    {\n      /* narration */\n    }\n    <p>Text</p>\n  </div>\n);\n";
  assert.equal(purgeSource(code, "example.tsx").code, "export const View = () => (\n  <div>\n    <p>Text</p>\n  </div>\n);\n");
});
