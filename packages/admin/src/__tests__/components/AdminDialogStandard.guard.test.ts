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
 * no whole-package tsc gate wired into `bun run build` (its tsconfig.json is
 * solution-style with `files: []`), so this guard is the durable check that:
 *
 *   1. every `<AdminDialog` consumer passes a size within the shipped scale,
 *   2. no consumer smuggles an ad-hoc `max-w-*` width override through
 *      `className` (the only sanctioned width override is the shared
 *      ADMIN_FLOW_DIALOG_CLASS constant),
 *   3. every `variant="flow"` dialog uses ADMIN_FLOW_DIALOG_CLASS,
 *   4. the guard's own idea of the scale stays anchored to the source of
 *      truth (sizeClasses in AdminDialog.tsx) — adding a tier fails here
 *      first, forcing the contract doc + this guard to move together, and
 *   5. every consumer re-establishes the workspace tone (the dialog portals
 *      to <body>, escaping CanvasLayout's [data-tone] scope — an omitted
 *      tone silently falls back to the neutral accent; the 2026-07 audit
 *      caught exactly one such straggler after the #613 tone pass).
 */

const ADMIN_SRC = join(__dirname, "..", "..");
const VALID_SIZES = new Set(["sm", "md", "lg"]);
const VALID_TONES = new Set(["hub", "garden", "community", "actions", "home"]);

/**
 * Files whose `<AdminDialog` sites are deliberately neutral — the only
 * sanctioned omissions of the tone prop. Everything else must declare where
 * it lives.
 */
const TONE_EXEMPT_FILES = [
  // AdminConfirmDialog wrapper: confirms are transient alerts riding the
  // neutral default by design (DiscardChanges, destructive confirms).
  "components/AdminDialog.tsx",
  // Command palette: global chrome available from every workspace — neutral
  // by design (variant="palette").
  "components/Layout/CommandPalette.tsx",
];

function isToneExempt(filePath: string): boolean {
  const normalized = filePath.split("\\").join("/");
  return TONE_EXEMPT_FILES.some((exempt) => normalized.endsWith(exempt));
}

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

    // Tone (prompt-contract § Dialog size & variant standard): the dialog
    // portals out of the [data-tone] scope, so every non-exempt consumer must
    // pass tone explicitly — a literal from the shipped set, or an expression
    // (descriptor bridges resolve tone dynamically).
    if (!isToneExempt(filePath)) {
      const toneLiteral = tag.match(/\btone="([^"]*)"/);
      const hasToneExpression = /\btone=\{/.test(tag);
      if (!toneLiteral && !hasToneExpression) {
        violations.push(
          `${where} — no tone prop; the dialog portals out of [data-tone], so omitting tone silently falls back to the neutral accent (pass the workspace tone, or allowlist a deliberately-neutral file in TONE_EXEMPT_FILES)`
        );
      } else if (toneLiteral && !VALID_TONES.has(toneLiteral[1])) {
        violations.push(
          `${where} — tone="${toneLiteral[1]}" is outside the shipped set (hub|garden|community|actions|home)`
        );
      }
    }

    // Interior grammar (dialog quality pass) 5: the AdminDialog `actions`
    // slot already renders the pinned SheetFooter anatomy, so a non-flow
    // dialog that passes `actions` AND nests a <SheetFooter in the same file
    // is stacking two footers — the pre-unification mixed chrome. (Flow
    // dialogs and bridge-rendered inspector content legitimately use
    // SheetFooter as their own pinned bar.)
    if (
      /\bactions=/.test(tag) &&
      !/\bvariant="flow"/.test(tag) &&
      source.includes("<SheetFooter")
    ) {
      violations.push(
        `${where} — dialog passes an actions footer while the file also renders <SheetFooter; one footer only (the actions slot carries the pinned anatomy)`
      );
    }
  }

  // Interior grammar 6: no Card.Header inside a dialog-rendering file — the
  // dialog header owns the title, and a Card.Header beneath it is the
  // double-header drift the quality pass removed (Garden Profile).
  if (source.includes("<AdminDialog") && source.includes("Card.Header")) {
    violations.push(
      `${filePath} — Card.Header in a file that renders AdminDialog; the dialog header owns the title (no double chrome inside dialogs)`
    );
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
      <AdminDialog open size="xl" tone="hub" title="bad">
      <AdminDialog open size={wide ? "2xl" : "lg"} tone="hub" title="bad">
      <AdminDialog open size={dynamicSize} tone="hub" title="bad">
      <AdminDialog open className="p-0 max-w-5xl" tone="hub" title="bad">
      <AdminDialog open variant="flow" tone="hub" title="bad">
      <AdminDialog open size="lg" variant="flow" tone="hub" className={ADMIN_FLOW_DIALOG_CLASS} title="good">
      <AdminDialog open size="md" tone="hub" onOpenChange={(next) => { if (!next) close(); }} title="good">
    `;
    const violations = collectViolations(seeded, "seed.tsx");
    expect(violations).toHaveLength(5);
    expect(violations.join("\n")).toContain('size="xl"');
    expect(violations.join("\n")).toContain('"2xl"');
    expect(violations.join("\n")).toContain("dynamically");
    expect(violations.join("\n")).toContain("max-w-*");
    expect(violations.join("\n")).toContain("ADMIN_FLOW_DIALOG_CLASS");
  });

  it("detects seeded tone violations (self-check)", () => {
    // Missing tone on a non-exempt file → violation.
    const missing = `<AdminDialog open size="md" title="bad">`;
    expect(collectViolations(missing, "views/Bad.tsx").join("\n")).toContain("no tone prop");

    // Out-of-set literal → violation.
    const invalid = `<AdminDialog open size="md" tone="brand" title="bad">`;
    expect(collectViolations(invalid, "views/Bad.tsx").join("\n")).toContain(
      'tone="brand" is outside the shipped set'
    );

    // Expressions are fine — descriptor bridges resolve tone dynamically.
    const expression = `<AdminDialog open size="lg" tone={config?.tone ?? fallbackTone} title="good">`;
    expect(collectViolations(expression, "components/Layout/CanvasLayout.tsx")).toEqual([]);

    // Deliberately-neutral files are exempt.
    const palette = `<AdminDialog open variant="palette" title="palette">`;
    expect(collectViolations(palette, "components/Layout/CommandPalette.tsx")).toEqual([]);
  });

  it("detects seeded interior-grammar violations (self-check)", () => {
    const doubleFooterSeed = `<AdminDialog open size="md" title="x" actions={<button>ok</button>}>
      <SheetFooter>dup</SheetFooter>
    </AdminDialog>`;
    expect(collectViolations(doubleFooterSeed, "views/Bad.tsx").join("\n")).toContain(
      "one footer only"
    );

    // Flow dialogs own their chrome via ActionFlowShell — SheetFooter is fine.
    const flowSeed = `<AdminDialog open size="lg" variant="flow" tone="hub" className={ADMIN_FLOW_DIALOG_CLASS} title="x">
      <SheetFooter>flow footer</SheetFooter>
    </AdminDialog>`;
    expect(collectViolations(flowSeed, "views/Flow.tsx")).toEqual([]);

    const cardHeaderSeed = `<AdminDialog open title="x"><Card><Card.Header>dup</Card.Header></Card></AdminDialog>`;
    expect(collectViolations(cardHeaderSeed, "views/Bad.tsx").join("\n")).toContain(
      "double chrome"
    );
  });

  it("finds no violations across admin source", () => {
    const violations = collectTsxFiles(ADMIN_SRC).flatMap((file) =>
      collectViolations(readFileSync(file, "utf8"), relative(ADMIN_SRC, file))
    );
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
