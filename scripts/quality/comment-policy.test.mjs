import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fixtureGitEnvironment } from "../lib/dev-shared.js";
import { classifySource, groupComments, main, purgeSource, sourceFiles } from "./comment-policy.mjs";

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

test("documentation stays on exported declarations and their members; a private note that restates its name goes", () => {
  const code = [
    "/** The helper. */",
    "function helper() {}",
    "/** Public API. */",
    "export interface Shape {",
    "  /** Member docs stay with the export. */",
    "  size: number;",
    "}",
  ].join("\n");
  assert.deepEqual(kinds(code), ["restatement", "documentation", "documentation"]);
  assert.equal(purgeSource(code, "example.ts").code.includes("The helper"), false);
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

test("banners, labels, restatements and commented-out code go with their lines; narration stays for triage", () => {
  const code = [
    "// ==== Helpers ====",
    "// Handler for the GardenMinted event",
    "export function onMint() {",
    "  // const legacy = readLegacy();",
    "  const ready = true;",
    "  // Get the current user",
    "  const user = getUser();",
    "  return user; // the result",
    "}",
    "",
  ].join("\n");
  assert.deepEqual(kinds(code), ["banner", "narration", "code", "restatement", "label"]);
  assert.equal(
    purgeSource(code, "example.ts").code,
    "// Handler for the GardenMinted event\nexport function onMint() {\n  const ready = true;\n  const user = getUser();\n  return user;\n}\n",
  );
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

test("Solidity keeps its licence, NatSpec, analyzer directives and constraints, and drops banners and labels", () => {
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
    "licence", "documentation", "label", "documentation", "banner", "directive", "constraint",
  ]);
  const purged = purgeSource(code, "Registry.sol").code;
  assert.doesNotMatch(purged, /the site|---- checks/);
  assert.match(purged, /"https:\/\/example\.org\/a\/\/b";\n/);
  assert.match(purged, /@custom:oz-upgrades-unsafe-allow constructor/);
  assert.match(purged, /solhint-disable-next-line/);
  assert.equal(purgeSource(purged, "Registry.sol").code, purged);
});

test("a NatSpec line and a plain comment under it stay separate comments", () => {
  const code = "/// @notice Kept.\n// Constants\nuint256 constant X = 1;\n";
  assert.deepEqual(kinds(code, "Lib.sol"), ["documentation", "label"]);
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
  assert.deepEqual(kinds(code), ["constraint", "dependency", "narration"]);
});

test("reasons, warnings and narration survive the narrow pass", () => {
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
  assert.deepEqual(kinds(code), ["rationale", "dependency", "constraint", "rationale", "narration"]);
  assert.equal(purgeSource(code, "example.ts").code, code);
});

test("a hashbang is never read as a comment", () => {
  const code = "#!/usr/bin/env node\n// Setup\nconst x = 1;\n";
  assert.deepEqual(kinds(code, "tool.mjs"), ["label"]);
  assert.equal(purgeSource(code, "tool.mjs").code, "#!/usr/bin/env node\nconst x = 1;\n");
});

test("only a JSX container that holds just comments goes with them; a comment that is a block's whole content stays", () => {
  const code = "const options = { /* defaults */ };\nfunction noop() { /* nothing */ }\nexport const View = () => <div>{/* a */ /* b */}</div>;\n";
  assert.equal(
    purgeSource(code, "example.tsx").code,
    "const options = { /* defaults */ };\nfunction noop() { /* nothing */ }\nexport const View = () => <div></div>;\n",
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
  const code = "const text = `a\n\n\nb`;\n\n// Setup\n\nconst next = 1;\n";
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
  const code = "/** Counts unread items. */\nfunction CountBadge() {}\n/** The badge. */\nconst Badge = () => null;\n/** The helper. */\nfunction helper() {}\nexport { CountBadge };\nexport default Badge;\n";
  assert.deepEqual(kinds(code), ["documentation", "documentation", "restatement"]);
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

test("every JavaScript line terminator inside a removed comment leaves a line break", () => {
  for (const terminator of ["\r", " ", " "]) {
    const code = `function f(value) {\n  return/* narration${terminator}*/value;\n}\n`;
    const purged = purgeSource(code, "example.ts").code;
    assert.equal(purged, "function f(value) {\n  return\nvalue;\n}\n", JSON.stringify(terminator));
    assert.equal(new Function("value", purged.slice(purged.indexOf("{") + 1, purged.lastIndexOf("}")))(42), undefined);
  }
});

test("a comment between two runs of JSX text stays, so the text renders the same", () => {
  // JSX trims each run of text on its own: these render "ab" and "Helloworld", and would render
  // "a b" and "Hello world" with the container gone.
  const inline = "export const A = () => <Label>a{/* note */}\nb</Label>;\n";
  const lines = "export const B = () => (\n  <p>\n    Hello\n    {/* note */}\n    world\n  </p>\n);\n";
  assert.equal(purgeSource(inline, "example.tsx").code, inline);
  assert.equal(purgeSource(lines, "example.tsx").code, lines);
  const besideElement = "export const C = () => (\n  <p>\n    Hello\n    {/* note */}\n    <b>world</b>\n  </p>\n);\n";
  assert.equal(
    purgeSource(besideElement, "example.tsx").code,
    "export const C = () => (\n  <p>\n    Hello\n    <b>world</b>\n  </p>\n);\n",
  );
});

test("every JSDoc tag TypeScript reads when it checks JavaScript keeps its comment", () => {
  for (const tag of ["@this {{x: number}}", "@extends {Base}", "@augments {Base}", "@implements {Shape}", "@constructor", "@private", "@readonly", "@override", "@arg {string} name"]) {
    assert.deepEqual(kinds(`/** ${tag} */\nfunction helper() {}`, "example.mjs"), ["documentation"], tag);
  }
});

test("a CommonJS file that returns at its top level is read as CommonJS", () => {
  const code = "// Setup\nif (!process.env.CI) return;\nmodule.exports = {};\n";
  assert.equal(purgeSource(code, "example.cjs").code, "if (!process.env.CI) return;\nmodule.exports = {};\n");
});

test("an ordering requirement is a claimed constraint", () => {
  // As written in the job-queue tests, above a side-effect import.
  assert.deepEqual(kinds('// Ensure fake-indexeddb is loaded before job-queue module\nimport "fake-indexeddb/auto";\n'), ["constraint"]);
  assert.deepEqual(kinds('// The polyfill is imported first.\nimport "./polyfill";\n'), ["constraint"]);
});

test("paths take in new files Git does not track yet, and never ignored ones", () => {
  const root = mkdtempSync(join(tmpdir(), "gg-comment-policy-"));
  try {
    const env = fixtureGitEnvironment();
    const git = (...args) => execFileSync("git", args, { cwd: root, env, stdio: "ignore" });
    git("init", "-q");
    writeFileSync(join(root, ".gitignore"), "ignored.ts\n");
    writeFileSync(join(root, "tracked.ts"), "export {};\n");
    git("add", "tracked.ts");
    writeFileSync(join(root, "new.ts"), "export {};\n");
    writeFileSync(join(root, "ignored.ts"), "export {};\n");
    assert.deepEqual(sourceFiles(["."], { root, env }).sort(), ["new.ts", "tracked.ts"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a purge that would change any element's rendered children keeps the file's comment containers", () => {
  // Removing the label's container would leave `{message} ` at a line end, and JSX drops a space
  // that runs into a line break: the text would read "now.Try Again".
  const code = "export const N = ({ message }) => (\n  <p>\n    {message} {/* note */}\n    <Button>Try Again</Button>\n  </p>\n);\n";
  assert.equal(purgeSource(code, "example.tsx").code, code);
});

test("commented-out JSX is code, prose that parses as a label is not, and a .js file may hold JSX", () => {
  assert.deepEqual(kinds("export const V = () => (\n  <div>\n    {/* <OldBanner tone=\"warm\" /> */}\n  </div>\n);\n", "example.tsx"), ["code"]);
  assert.deepEqual(kinds("// TODO: fix()\nconst x = 1;\n"), ["constraint"]);
  assert.equal(purgeSource("// Setup\nexport const A = () => <div />;\n", "example.js").code, "export const A = () => <div />;\n");
});

test("governed test skips and plain licence notices are kept", () => {
  const skip = "// SKIP: #312 the upstream RPC is down\n// Owner: protocol / Expiry: 2026-12-31\nit.skip(\"reads the chain\", () => {});\n";
  assert.deepEqual(kinds(skip), ["directive", "directive"]);
  assert.deepEqual(kinds("// Licensed under the Apache License, Version 2.0\nexport const icon = 1;\n"), ["licence"]);
  assert.deepEqual(kinds("/* MIT License */\nexport const icon = 1;\n"), ["licence"]);
});

test("a run writes nothing while any file fails to parse, and the triage report lists what stays", () => {
  const root = mkdtempSync(join(tmpdir(), "gg-comment-policy-main-"));
  const out = [];
  const errors = [];
  const { log, error } = console;
  console.log = (line) => out.push(line);
  console.error = (line) => errors.push(line);
  try {
    const env = fixtureGitEnvironment();
    execFileSync("git", ["init", "-q"], { cwd: root, env, stdio: "ignore" });
    writeFileSync(join(root, "good.ts"), "// Setup\n// Read the garden before the pool loads.\nexport const x = 1;\n");
    writeFileSync(join(root, "bad.ts"), "export const = ;\n");
    assert.equal(main(["--write", root], { root, env }), 1);
    assert.equal(readFileSync(join(root, "good.ts"), "utf8"), "// Setup\n// Read the garden before the pool loads.\nexport const x = 1;\n");
    assert.match(errors.join("\n"), /nothing was written/);
    rmSync(join(root, "bad.ts"));
    assert.equal(main(["--report", "triage", root], { root, env }), 0);
    assert.deepEqual(JSON.parse(out.at(-1)).triage.map((entry) => entry.kind), ["narration"]);
  } finally {
    console.log = log;
    console.error = error;
    rmSync(root, { recursive: true, force: true });
  }
});

test("notation in a comment is prose, and an ordering note is a claim", () => {
  assert.deepEqual(kinds("// isWearerOfHat => false\nconst read = vi.fn();\n"), ["narration"]);
  assert.deepEqual(kinds("// `${hash(text)}_${sourceLang}_${targetLang}`\nconst key = make();\n"), ["narration"]);
  assert.deepEqual(kinds('// Import after mocks\nimport { Login } from "./Login";\n'), ["constraint"]);
});

test("a comment that marks a deliberate empty block, or names a number, stays", () => {
  const swallow = "export function stop(close) {\n  try {\n    close();\n  } catch {\n    // Ignore errors\n  }\n}\n";
  assert.equal(purgeSource(swallow, "example.ts").code, swallow);
  const chain = "export const config = {\n  chainId: 11155111, // Sepolia\n  owner: owner(), // the owner\n};\n";
  assert.equal(purgeSource(chain, "example.ts").code, "export const config = {\n  chainId: 11155111, // Sepolia\n  owner: owner(),\n};\n");
  assert.deepEqual(kinds("uint256 constant WINDOW = 3600; // one hour\n", "Lib.sol"), ["narration"]);
});
