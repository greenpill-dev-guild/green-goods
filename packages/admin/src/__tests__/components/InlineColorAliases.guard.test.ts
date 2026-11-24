// TEST-QUALITY: allow-small-test-file - one sweep of admin code, plus the anchor that stops it passing on an empty or overgrown alias set
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: admin code reads no Tailwind color alias inline.
 *
 * The production build declares a `@theme` alias such as `--color-success-base`
 * only when a utility in the startup stylesheet's own sources uses it.
 * admin-workspace.css scans the rest of the app but compiles against
 * `@reference "../index.css"`, so it writes each utility with the alias's value
 * as a fallback and declares no alias itself. A bare `var(--color-success-base)`
 * in a chart fill, a style prop or an arbitrary value then resolves to nothing:
 * the hypercert distribution chart drew six of its nine segments black. Read the
 * role's triple (`rgb(var(--success-base))`) or use the utility instead. Plain
 * custom properties (`--color-material-solid`) and registered ones
 * (`--color-scrim`) always ship, so they are not aliases here.
 */

const ADMIN_SRC = join(__dirname, "..", "..");
const THEME_SHEETS = [
  join(ADMIN_SRC, "index.css"),
  join(ADMIN_SRC, "..", "..", "shared", "src", "styles", "theme.css"),
];

/** The `--color-*` aliases a stylesheet declares inside its `@theme` blocks. */
function themeColorAliases(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const aliases: string[] = [];
  for (const block of source.matchAll(/@theme\b[^{;]*\{/g)) {
    const start = (block.index ?? 0) + block[0].length;
    let depth = 1;
    let end = start;
    while (depth > 0 && end < source.length) {
      if (source[end] === "{") depth += 1;
      if (source[end] === "}") depth -= 1;
      end += 1;
    }
    for (const [, alias] of source.slice(start, end - 1).matchAll(/(--color-[\w-]+)\s*:/g)) {
      aliases.push(alias);
    }
  }
  return aliases;
}

const THEME_COLOR_ALIASES = new Set(
  THEME_SHEETS.flatMap((sheet) => themeColorAliases(readFileSync(sheet, "utf-8")))
);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "__mocks__" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (entry.includes(".test.") || entry.includes(".stories.")) continue;
    out.push(full);
  }
  return out;
}

describe("inline color aliases", () => {
  it("reads every inline color in admin code from a source the build declares", () => {
    const aliasReads: string[] = [];
    for (const file of collectSourceFiles(ADMIN_SRC)) {
      readFileSync(file, "utf-8")
        .split("\n")
        .forEach((line, index) => {
          for (const [, alias] of line.matchAll(/var\(\s*(--color-[\w-]+)\s*\)/g)) {
            if (THEME_COLOR_ALIASES.has(alias)) {
              aliasReads.push(`${relative(ADMIN_SRC, file)}:${index + 1} ${alias}`);
            }
          }
        });
    }
    expect(aliasReads).toEqual([]);
  });

  it("collects the aliases of the theme the admin compiles against, and only those", () => {
    const aliases = [...THEME_COLOR_ALIASES];
    expect(aliases).toContain("--color-success-base"); // admin index.css @theme
    expect(aliases).toContain("--color-feature-base"); // shared theme.css @theme
    expect(aliases).not.toContain("--color-material-solid"); // a plain :root property
    expect(aliases).not.toContain("--color-scrim"); // registered with @property
  });
});
