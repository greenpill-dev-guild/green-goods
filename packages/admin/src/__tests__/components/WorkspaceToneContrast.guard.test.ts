/**
 * Guard: every workspace's filled action carries its label at AA.
 *
 * A filled header action, the FAB, a step marker and the shared primary
 * buttons put `--tone-on-action` (white in light, the tone's -900 ink in dark,
 * DL-009) on `--tone-action`, and on `--tone-action-hover` while hovered.
 * Community's light fill was orange-700, which carries white at 4.0:1.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(resolve(__dirname, "../../styles/admin-m3-tokens.css"), "utf-8");
const palette = readFileSync(
  resolve(__dirname, "../../../../shared/src/styles/theme.css"),
  "utf-8"
);

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Declarations of the first rule in `css` whose last selector line is `selector`. */
const block = (css: string, selector: string) =>
  css.match(new RegExp(`(?:^|\\n)${escape(selector)}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

type Rgb = [number, number, number];

/** The `R G B` triple a property resolves to in a tone block, through the shared palette. */
function resolveRgb(property: string, scope: string): Rgb {
  const value =
    scope.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1]?.trim() ??
    palette.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`${property} is not declared`);
  const reference = value.match(/^var\((--[\w-]+)/)?.[1];
  if (reference) return resolveRgb(reference, scope);
  const triple = value.match(/^(\d+)\s+(\d+)\s+(\d+)/);
  if (!triple) throw new Error(`${property} has no RGB triple: ${value}`);
  return [Number(triple[1]), Number(triple[2]), Number(triple[3])];
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

const TONES = ["hub", "garden", "community", "actions", "home"];

describe("workspace tone fills", () => {
  it.each(TONES)("%s keeps its filled action's label at AA in light and dark", (tone) => {
    const themes = {
      light: block(tokens, `[data-tone="${tone}"]`),
      dark: block(tokens, `[data-theme="dark"] [data-tone="${tone}"]`),
    };
    for (const [theme, scope] of Object.entries(themes)) {
      expect(scope, `${tone} ${theme} block`).not.toBe("");
      const ink = resolveRgb("--tone-on-action", scope);
      for (const fill of ["--tone-action", "--tone-action-hover"]) {
        const ratio = contrast(resolveRgb(fill, scope), ink);
        expect(ratio, `${tone} ${theme} ${fill}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
