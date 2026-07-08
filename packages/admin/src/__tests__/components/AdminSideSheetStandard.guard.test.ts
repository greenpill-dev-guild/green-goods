import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard for the AdminSideSheet scope standard
 * (.claude/skills/design/prompt-contract.md § Side sheets: the three global
 * surfaces).
 *
 * Side sheets exist for exactly the three global AppBar surfaces — Profile,
 * Settings, Notifications — rendered by CanvasLayout through the right-sheet
 * registry. Every workspace action, detail, and creation overlay stays a
 * AdminDialog. This guard keeps the carve-out from drifting back
 * into the retired sheets-for-everything era:
 *
 *   1. only CanvasLayout may render `<AdminSideSheet` (views must not adopt
 *      slide-in panels for detail/creation flows),
 *   2. every usage re-establishes tone (the sheet portals to <body>, escaping
 *      CanvasLayout's [data-tone] scope), and
 *   3. the right-sheet registry stays locked to the three global content ids —
 *      adding a fourth sheet surface is a design decision, not a code edit.
 */

const ADMIN_SRC = join(__dirname, "..", "..");
const VALID_TONES = new Set(["hub", "garden", "community", "actions", "home"]);

/** The only production files sanctioned to render an AdminSideSheet. */
const ALLOWED_CONSUMERS = ["components/Layout/CanvasLayout.tsx"];

const GLOBAL_SHEET_CONTENT_IDS = ["profile", "settings", "notifications"];

function isAllowedConsumer(filePath: string): boolean {
  const normalized = filePath.split("\\").join("/");
  return ALLOWED_CONSUMERS.some((allowed) => normalized.endsWith(allowed));
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
 * Extract every `<AdminSideSheet …>` opening tag. JSX attribute expressions
 * can contain `>` (arrow functions), so the scan tracks `{}` depth and only
 * terminates the tag at a `>` outside any expression.
 */
function extractOpeningTags(source: string): Array<{ tag: string; line: number }> {
  const tags: Array<{ tag: string; line: number }> = [];
  const matcher = /<AdminSideSheet(?![A-Za-z0-9_])/g;
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

export function collectViolations(source: string, filePath: string): string[] {
  const violations: string[] = [];
  for (const { tag, line } of extractOpeningTags(source)) {
    const where = `${filePath}:${line}`;

    if (!isAllowedConsumer(filePath)) {
      violations.push(
        `${where} — AdminSideSheet outside CanvasLayout; side sheets are reserved for the three global AppBar surfaces (Profile, Settings, Notifications). Use AdminDialog for workspace action/detail/creation flows.`
      );
    }

    const toneLiteral = tag.match(/\btone="([^"]*)"/);
    const hasToneExpression = /\btone=\{/.test(tag);
    if (!toneLiteral && !hasToneExpression) {
      violations.push(
        `${where} — no tone prop; the sheet portals out of [data-tone], so omitting tone silently falls back to the neutral accent`
      );
    } else if (toneLiteral && !VALID_TONES.has(toneLiteral[1])) {
      violations.push(
        `${where} — tone="${toneLiteral[1]}" is outside the shipped set (hub|garden|community|actions|home)`
      );
    }
  }
  return violations;
}

describe("AdminSideSheet scope standard", () => {
  it("keeps the right-sheet registry locked to the three global surfaces", () => {
    // Source-scan (not a barrel import): the shared barrel transitively pulls
    // wallet deps that don't resolve in every local environment, and this is
    // a source-contract check anyway — same style as the rest of the guard.
    const registrySource = readFileSync(
      join(
        ADMIN_SRC,
        "..",
        "..",
        "shared",
        "src",
        "hooks",
        "admin-ui",
        "navigation",
        "sheetRegistry.ts"
      ),
      "utf8"
    );
    const registryBlock = registrySource.match(
      /export const ADMIN_RIGHT_SHEET_REGISTRY = \{([\s\S]*?)\n\} satisfies/
    );
    expect(
      registryBlock,
      "ADMIN_RIGHT_SHEET_REGISTRY literal not found — sheetRegistry.ts moved; update this guard"
    ).toBeTruthy();

    const contentIdConstants = [
      ...(registryBlock as RegExpMatchArray)[1].matchAll(/\[([A-Z_]+_SHEET_CONTENT_ID)\]:/g),
    ].map((match) => match[1]);
    const resolvedIds = contentIdConstants.map((constant) => {
      const definition = registrySource.match(new RegExp(`export const ${constant} = "([^"]+)"`));
      return definition?.[1] ?? constant;
    });
    expect(resolvedIds.sort()).toEqual([...GLOBAL_SHEET_CONTENT_IDS].sort());
  });

  it("detects seeded violations (self-check)", () => {
    const outsideConsumer = `<AdminSideSheet open tone="hub" title="bad">`;
    expect(collectViolations(outsideConsumer, "views/Garden/Detail.tsx").join("\n")).toContain(
      "outside CanvasLayout"
    );

    const missingTone = `<AdminSideSheet open title="bad" onOpenChange={(next) => { if (!next) close(); }}>`;
    expect(
      collectViolations(missingTone, "components/Layout/CanvasLayout.tsx").join("\n")
    ).toContain("no tone prop");

    const invalidTone = `<AdminSideSheet open tone="brand" title="bad">`;
    expect(
      collectViolations(invalidTone, "components/Layout/CanvasLayout.tsx").join("\n")
    ).toContain('tone="brand" is outside the shipped set');

    const sanctioned = `<AdminSideSheet open tone="hub" title="good" onOpenChange={(next) => { if (!next) close(); }}>`;
    expect(collectViolations(sanctioned, "components/Layout/CanvasLayout.tsx")).toEqual([]);
  });

  it("finds no violations across admin source", () => {
    const violations = collectTsxFiles(ADMIN_SRC).flatMap((file) =>
      collectViolations(readFileSync(file, "utf8"), relative(ADMIN_SRC, file))
    );
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
