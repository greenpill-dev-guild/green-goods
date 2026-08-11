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
    "```",
    "```tsx",
    'const pane = "rounded-[var(--radius-2xl)] shadow-[var(--shadow-float)]";',
    "```",
  ].join("\n");
  assert.deepEqual(findDesignGuidanceViolations(text, "design.md"), []);
});

test("accepts pedagogical radius arithmetic and reduced-motion overrides", () => {
  const text = [
    "```css",
    ".parent { border-radius: 24px; padding: 16px; }",
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

test("does not let reduced-motion or token markers hide unrelated literals", () => {
  const text = [
    "```css",
    ".pane { transition-duration: 200ms; border-radius: 18px; }",
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
