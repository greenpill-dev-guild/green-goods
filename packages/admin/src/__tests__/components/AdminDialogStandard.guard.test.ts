import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard for the AdminDialog size/variant standard
 * (.claude/skills/design/prompt-contract.md § Dialog size & variant standard).
 *
 * The size scale collapsed to three tiers (sm | md | lg); `xl`/`2xl` no longer
 * exist and an out-of-scale size fails silently at runtime (sizeClasses[size]
 * is undefined → the dialog loses its width constraint). The admin package has
 * no whole-package tsc gate wired into `bun build` (its tsconfig.json is
 * solution-style with `files: []`), so this guard is the durable check that:
 *
 *   1. every `<AdminDialog` consumer passes a size within the shipped scale,
 *   2. no consumer smuggles an ad-hoc `max-w-*` width override through
 *      `className` (the only sanctioned width override is the shared
 *      ADMIN_FLOW_DIALOG_CLASS constant),
 *   3. every `variant="flow"` dialog uses ADMIN_FLOW_DIALOG_CLASS, and
 *   4. the guard's own idea of the scale stays anchored to the source of
 *      truth (sizeClasses in AdminDialog.tsx) — adding a tier fails here
 *      first, forcing the contract doc + this guard to move together.
 */

const ADMIN_SRC = join(__dirname, "..", "..");
const VALID_SIZES = new Set(["sm", "md", "lg"]);

function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "__mocks__" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsxFiles(full));
      continue;
    }
    if (!entry.endsWith(".tsx")) continue;
    if (entry.includes(".test.") || entry.includes(".stories.")) continue;
    out.push(full);
  }
  return out;
}

/**
 * Extract every `<AdminDialog …>` opening tag. JSX attribute expressions can
 * contain `>` (arrow functions), so the scan tracks `{}` depth and only
 * terminates the tag at a `>` outside any expression.
 */
function extractOpeningTags(source: string): Array<{ tag: string; line: number }> {
  const tags: Array<{ tag: string; line: number }> = [];
  const matcher = /<AdminDialog(?![A-Za-z0-9_])/g;
  let match = matcher.exec(source);
  while (match !== null) {
    let depth = 0;
    let end = -1;
    for (let i = match.index; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end !== -1) {
      tags.push({
        tag: source.slice(match.index, end + 1),
        line: source.slice(0, match.index).split("\n").length,
      });
    }
    match = matcher.exec(source);
  }
  return tags;
}

/** Balanced-brace slice of an attribute expression starting at `{`. */
function sliceExpression(tag: string, braceStart: number): string {
  let depth = 0;
  for (let i = braceStart; i < tag.length; i++) {
    if (tag[i] === "{") depth++;
    else if (tag[i] === "}") {
      depth--;
      if (depth === 0) return tag.slice(braceStart + 1, i);
    }
  }
  return tag.slice(braceStart + 1);
}

function stringLiteralsIn(expression: string): string[] {
  return [...expression.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1]);
}

export function collectViolations(source: string, filePath: string): string[] {
  const violations: string[] = [];
  for (const { tag, line } of extractOpeningTags(source)) {
    const where = `${filePath}:${line}`;

    const sizeLiteral = tag.match(/\bsize="([^"]*)"/);
    const sizeExprStart = tag.search(/\bsize=\{/);
    if (sizeLiteral && !VALID_SIZES.has(sizeLiteral[1])) {
      violations.push(
        `${where} — size="${sizeLiteral[1]}" is outside the shipped scale (sm|md|lg)`
      );
    } else if (!sizeLiteral && sizeExprStart !== -1) {
      const expr = sliceExpression(tag, sizeExprStart + "size=".length);
      const literals = stringLiteralsIn(expr);
      if (literals.length === 0) {
        violations.push(
          `${where} — size={…} resolves entirely dynamically; use literal sm|md|lg values so the scale stays auditable`
        );
      }
      for (const literal of literals) {
        if (!VALID_SIZES.has(literal)) {
          violations.push(
            `${where} — size expression contains "${literal}", outside the shipped scale (sm|md|lg)`
          );
        }
      }
    }

    const classLiteral = tag.match(/\bclassName="([^"]*)"/);
    const classExprStart = tag.search(/\bclassName=\{/);
    if (classLiteral?.[1].includes("max-w-")) {
      violations.push(
        `${where} — className carries an ad-hoc max-w-* override; the only sanctioned width override is ADMIN_FLOW_DIALOG_CLASS`
      );
    } else if (classExprStart !== -1) {
      const expr = sliceExpression(tag, classExprStart + "className=".length);
      for (const literal of stringLiteralsIn(expr)) {
        if (literal.includes("max-w-")) {
          violations.push(
            `${where} — className expression carries an ad-hoc max-w-* override; the only sanctioned width override is ADMIN_FLOW_DIALOG_CLASS`
          );
        }
      }
    }

    if (/\bvariant="flow"/.test(tag) && !tag.includes("ADMIN_FLOW_DIALOG_CLASS")) {
      violations.push(
        `${where} — variant="flow" without ADMIN_FLOW_DIALOG_CLASS; flow dialogs must share the centralized sizing constant`
      );
    }
  }
  return violations;
}

describe("AdminDialog size/variant standard", () => {
  it("stays anchored to the shipped scale in AdminDialog.tsx", () => {
    const source = readFileSync(join(ADMIN_SRC, "components", "AdminDialog.tsx"), "utf8");
    const record = source.match(/const sizeClasses[^=]*=\s*\{([\s\S]*?)\n\};/);
    expect(
      record,
      "sizeClasses record not found — AdminDialog.tsx moved; update this guard"
    ).toBeTruthy();
    const keys = [...(record as RegExpMatchArray)[1].matchAll(/^\s*"?([A-Za-z0-9]+)"?:/gm)].map(
      (m) => m[1]
    );
    expect(new Set(keys)).toEqual(VALID_SIZES);
  });

  it("detects seeded violations (self-check)", () => {
    const seeded = `
      <AdminDialog open size="xl" title="bad">
      <AdminDialog open size={wide ? "2xl" : "lg"} title="bad">
      <AdminDialog open size={dynamicSize} title="bad">
      <AdminDialog open className="p-0 max-w-5xl" title="bad">
      <AdminDialog open variant="flow" title="bad">
      <AdminDialog open size="lg" variant="flow" className={ADMIN_FLOW_DIALOG_CLASS} title="good">
      <AdminDialog open size="md" onOpenChange={(next) => { if (!next) close(); }} title="good">
    `;
    const violations = collectViolations(seeded, "seed.tsx");
    expect(violations).toHaveLength(5);
    expect(violations.join("\n")).toContain('size="xl"');
    expect(violations.join("\n")).toContain('"2xl"');
    expect(violations.join("\n")).toContain("dynamically");
    expect(violations.join("\n")).toContain("max-w-*");
    expect(violations.join("\n")).toContain("ADMIN_FLOW_DIALOG_CLASS");
  });

  it("finds no violations across admin source", () => {
    const violations = collectTsxFiles(ADMIN_SRC).flatMap((file) =>
      collectViolations(readFileSync(file, "utf8"), relative(ADMIN_SRC, file))
    );
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
