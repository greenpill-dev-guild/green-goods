import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { findDesignGuidanceViolations } from "./check-guidance-examples.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-guidance-examples.mjs");

test("accepts shared tokens and token definitions", () => {
  const text = [
    "```css",
    ":root {",
    "  --spring-fast: cubic-bezier(0.2, 0, 0, 1) 150ms;",
    "}",
    ".pane { transition: transform var(--spring-fast); box-shadow: var(--shadow-float); }",
    ".icon { filter: drop-shadow(var(--shadow-float)); color: currentColor; }",
    "```",
    "```tsx",
    'const pane = "rounded-[var(--radius-2xl)] shadow-[var(--shadow-float)]";',
    "```",
  ].join("\n");
  assert.deepEqual(findDesignGuidanceViolations(text, "design.md"), []);
});

test("checks declarations after a token definition on the same line", () => {
  const text = [
    "```css",
    ":root { --spring-fast: var(--spring-spatial); color: #fff; transition: opacity 200ms; }",
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.ok(failures.some((failure) => failure.includes("raw hexadecimal color")));
  assert.ok(failures.some((failure) => failure.includes("hardcoded transition duration")));
});

test("does not confuse HTML fragments with colors", () => {
  const text = ["```html", '<a href="#feed">Feed</a>', "```"].join("\n");
  assert.deepEqual(findDesignGuidanceViolations(text, "design.md"), []);
});

test("rejects named color property values", () => {
  const text = [
    "```css",
    ".bad { color: white; background-color: black; }",
    "```",
    "```tsx",
    'const bad = { color: "red" };',
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.equal(failures.filter((failure) => failure.includes("raw named color")).length, 2);
});

test("accepts pedagogical radius arithmetic and reduced-motion overrides", () => {
  const text = [
    "```css",
    ".parent { border-radius: 24px; padding: 16px; } /* design-guard: allow-radius-literal — pedagogical arithmetic */",
    "/* Token form — derive instead of hardcoding the arithmetic. */",
    ".child { border-radius: calc(var(--radius-2xl) - var(--space-4)); }",
    "```",
    "```css",
    "@media (prefers-reduced-motion: reduce) {",
    "  * { transition-duration: 0.01ms !important; }",
    "}",
    "```",
  ].join("\n");
  assert.deepEqual(findDesignGuidanceViolations(text, "design.md"), []);
});

test("rejects slow reduced-motion overrides", () => {
  const text = [
    "```css",
    "@media (prefers-reduced-motion: reduce) {",
    "  * { transition-duration: 0.9s !important; }",
    "}",
    "```",
  ].join("\n");
  assert.ok(
    findDesignGuidanceViolations(text, "design.md").some((failure) =>
      failure.includes("hardcoded transition duration"),
    ),
  );
});

test("checks multiline CSS declarations", () => {
  const text = [
    "```css",
    ".bad {",
    "  transition:",
    "    opacity 200ms ease;",
    "  color:",
    "    #fff;",
    "}",
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.ok(failures.some((failure) => failure.includes("hardcoded transition duration")));
  assert.ok(failures.some((failure) => failure.includes("raw hexadecimal color")));
});

test("checks color-bearing shorthand declarations", () => {
  const text = [
    "```css",
    ".bad { background: #fff; border: 1px solid red; }",
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.ok(failures.some((failure) => failure.includes("raw hexadecimal color")));
  assert.ok(failures.some((failure) => failure.includes("raw named color")));
});

test("ignores color names embedded in background resources", () => {
  const text = [
    "```css",
    '.hero { background: url("/images/black.svg") center / cover; }',
    "```",
  ].join("\n");
  assert.deepEqual(findDesignGuidanceViolations(text, "design.md"), []);
});

test("checks raw JSX and SVG color attributes", () => {
  const text = ["```tsx", '<path fill="#fff" stroke="red" />', "```"].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.ok(failures.some((failure) => failure.includes("raw hexadecimal color")));
  assert.ok(failures.some((failure) => failure.includes("raw named color")));
});

test("rejects radius literals nested in CSS functions", () => {
  const text = [
    "```css",
    ".one { border-radius: calc(24px - 4px); }",
    ".two { border-radius: max(8px, var(--radius-md)); }",
    "```",
  ].join("\n");
  assert.equal(
    findDesignGuidanceViolations(text, "design.md").filter((failure) =>
      failure.includes("arbitrary numeric radius"),
    ).length,
    2,
  );
});

test("does not let reduced-motion or token markers hide unrelated literals", () => {
  const text = [
    "```css",
    ".pane { transition-duration: 200ms; border-radius: 18px; }",
    ".bad { border-radius: 20px; } /* Token form */",
    ".example { border-radius: 24px; }",
    "/* Token form — derive instead of hardcoding the arithmetic. */",
    ".tokenized { border-radius: var(--radius-2xl); }",
    "@media (prefers-reduced-motion: reduce) {",
    "  * { transition-duration: 0.01ms !important; }",
    "}",
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.ok(failures.some((failure) => failure.includes("hardcoded transition duration")));
  assert.ok(failures.some((failure) => failure.includes("arbitrary numeric radius")));
});

test("detects arbitrary utilities and camelCase duration properties", () => {
  const text = [
    "```tsx",
    'const pane = "duration-[200ms]";',
    'const style = { transitionDuration: "200ms", animationDuration: "0.4s" };',
    'const tokenized = "duration-[var(--spring-fast)]";',
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.equal(
    failures.filter((failure) => failure.includes("hardcoded transition duration")).length,
    2,
  );
});

test("checks universal selectors but permits explicit shadow removal", () => {
  const text = [
    "```css",
    "* { color: #fff; }",
    ".flat { box-shadow: none; }",
    "```",
    "```tsx",
    'const flat = { boxShadow: "none" };',
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.ok(failures.some((failure) => failure.includes("raw hexadecimal color")));
  assert.equal(failures.some((failure) => failure.includes("raw shadow")), false);
});

test("rejects transition and animation shorthand durations independently", () => {
  const text = [
    "```css",
    ".fade { transition: opacity 200ms ease; }",
    ".pulse { animation: pulse 0.4s ease; }",
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.equal(
    failures.filter((failure) => failure.includes("hardcoded transition duration")).length,
    2,
  );
});

test("rejects the non-token shadow utility family", () => {
  const text = [
    "```tsx",
    'const values = ["shadow", "shadow-sm", "shadow-md", "shadow-lg", "shadow-inner", "drop-shadow-lg"];',
    "```",
  ].join("\n");
  assert.ok(
    findDesignGuidanceViolations(text, "design.md").some((failure) =>
      failure.includes("raw shadow"),
    ),
  );
});

test("does not treat JavaScript shadow identifiers as utility classes", () => {
  const text = [
    "```ts",
    'const shadow = "var(--shadow-float)";',
    "```",
  ].join("\n");
  assert.deepEqual(findDesignGuidanceViolations(text, "design.md"), []);
});

test("rejects raw drop-shadow functions and arbitrary shadow utilities", () => {
  const text = [
    "```css",
    ".icon { filter: drop-shadow(0 1px 2px #000); }",
    "```",
    "```tsx",
    'const card = "shadow-[0_1px_2px_#000]";',
    "```",
  ].join("\n");
  assert.equal(
    findDesignGuidanceViolations(text, "design.md").filter((failure) =>
      failure.includes("raw shadow"),
    ).length,
    2,
  );
});

test("rejects hardcoded implementation values", () => {
  const text = [
    "```tsx",
    'const pane = "duration-200 rounded-[18px] shadow-2xl bg-white/65";',
    "```",
    "```css",
    ".pane { transition: all 200ms cubic-bezier(0.2, 0, 0, 1); color: #ffffff; }",
    "```",
  ].join("\n");
  const failures = findDesignGuidanceViolations(text, "design.md");
  assert.ok(failures.some((failure) => failure.includes("hardcoded transition duration")));
  assert.ok(failures.some((failure) => failure.includes("arbitrary numeric radius")));
  assert.ok(failures.some((failure) => failure.includes("raw shadow")));
  assert.ok(failures.some((failure) => failure.includes("raw palette utility")));
  assert.ok(failures.some((failure) => failure.includes("hardcoded easing")));
  assert.ok(failures.some((failure) => failure.includes("raw hexadecimal color")));
});

test("rejects unknown CLI arguments", () => {
  const result = spawnSync(process.execPath, [script, "--unknown"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument/);
});
