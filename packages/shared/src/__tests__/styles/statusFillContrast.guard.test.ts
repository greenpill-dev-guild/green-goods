/**
 * Guard: a status fill that carries white keeps AA in every theme.
 *
 * The installed app's dark lifts the shared error and information base roles
 * one step so their text and icons hold AA on its lifted card (DL-097). Those
 * base roles were also the fills under white labels and glyphs, and the lift
 * took white on them to 2.80 and 2.86:1. A fill that carries white takes an
 * action role instead, which keeps its deep step in every theme (DL-053).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const theme = readFileSync(resolve(__dirname, "../../styles/theme.css"), "utf-8");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Declarations of the first rule whose selector is `selector`. */
const block = (selector: string) =>
  theme.match(new RegExp(`(?:^|\\n)\\s*${escape(selector)}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

const light = [block(":root")];
const dark = [block('[data-theme="dark"]'), ...light];
// The app's dark block lists several selectors; its last line opens the rule.
const appDark = [block('[data-surface="app"] [data-theme="dark"]'), ...dark];
const THEMES = { light, dark, "the installed app's dark": appDark };

type Rgb = [number, number, number];

/** The `R G B` triple a property resolves to through a theme's scopes, innermost first. */
function resolveRgb(property: string, scopes: string[]): Rgb {
  for (const scope of scopes) {
    const value = scope.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1]?.trim();
    if (!value) continue;
    const reference = value.match(/^var\((--[\w-]+)/)?.[1];
    if (reference) return resolveRgb(reference, scopes);
    const triple = value.match(/^(\d+)\s+(\d+)\s+(\d+)/);
    if (triple) return [Number(triple[1]), Number(triple[2]), Number(triple[3])];
  }
  throw new Error(`${property} has no RGB triple in these scopes`);
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("status fills that carry white", () => {
  it("keep white text at AA on the action red in every theme", () => {
    for (const [name, scopes] of Object.entries(THEMES)) {
      const ratio = contrast(
        resolveRgb("--static-white", scopes),
        resolveRgb("--error-action", scopes)
      );
      expect(ratio, name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keep white text at AA on the action blue in every theme", () => {
    for (const [name, scopes] of Object.entries(THEMES)) {
      const ratio = contrast(
        resolveRgb("--static-white", scopes),
        resolveRgb("--information-action", scopes)
      );
      expect(ratio, name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("fill the danger icon button with the action red", () => {
    const danger = '.gg-icon-button[data-emphasis="primary"][data-tone="danger"]';
    expect(block(danger)).toContain("var(--error-action)");
    expect(block(`${danger}:hover`)).toContain("var(--error-action-hover)");
  });

  it("leave the installed app's lifted status text at AA on its dark card", () => {
    const card = resolveRgb("--bg-white-0", appDark);
    for (const role of ["--error-base", "--feature-dark", "--information-base"]) {
      expect(contrast(resolveRgb(role, appDark), card), role).toBeGreaterThanOrEqual(4.5);
    }
  });
});
