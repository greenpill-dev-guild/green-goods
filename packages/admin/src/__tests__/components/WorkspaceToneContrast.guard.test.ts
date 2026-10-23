/**
 * Guard: every workspace's filled action carries its label at AA, at rest and
 * in every state it renders.
 *
 * A filled header action, the FAB, a step marker and the shared primary
 * buttons put `--tone-on-action` (white in light, the tone's -900 ink in dark,
 * DL-009) on `--tone-action`. Shared buttons hover on `--tone-action-hover`.
 * The cockpit's filled AdminButton and FAB keep their fill and lay the neutral
 * ink layer (`--m3-on-surface`, Rule 18) over it at the state opacities, which
 * deepens a light fill and lifts a dark one. Community's light fill was
 * orange-700, which carries white at 4.0:1, and a layer in the label's own
 * color took every hovered or pressed fill further toward its label.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf-8");
const tokens = read("../../styles/admin-m3-tokens.css");
const theme = read("../../../../shared/src/styles/theme.css");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Declarations of every rule in `css` whose last selector line is `selector`, in source order. */
const blocks = (css: string, selector: string) =>
  [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escape(selector)}\\s*\\{([^}]*)\\}`, "g"))]
    .map((match) => match[1])
    .join("\n");

type Rgb = [number, number, number];

/** The value a property is declared with in the first of `scopes` that declares it. */
function declared(property: string, scopes: string[]): string {
  for (const scope of scopes) {
    const value = scope.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1]?.trim();
    if (value) return value;
  }
  throw new Error(`${property} is not declared`);
}

/** The `R G B` triple a property resolves to through `scopes`, innermost first. */
function resolveRgb(property: string, scopes: string[]): Rgb {
  const value = declared(property, scopes);
  const reference = value.match(/^var\((--[\w-]+)/)?.[1];
  if (reference) return resolveRgb(reference, scopes);
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

/** A state layer of `layer` at `opacity` over `fill`. */
const over = (fill: Rgb, layer: Rgb, opacity: number): Rgb =>
  fill.map((channel, index) => channel * (1 - opacity) + layer[index] * opacity) as Rgb;

const STATES = ["--m3-state-hover", "--m3-state-focus", "--m3-state-pressed"].map((state) => ({
  state,
  opacity: Number(declared(state, [blocks(tokens, ":root")])),
}));

const TONES = ["hub", "garden", "community", "actions", "home"];

describe("workspace tone fills", () => {
  it.each(TONES)("%s keeps its filled action's label at AA at rest and in every state", (tone) => {
    const themes = {
      light: [
        blocks(tokens, `[data-tone="${tone}"]`),
        blocks(tokens, ":root"),
        blocks(theme, ":root"),
        theme,
      ],
      dark: [
        blocks(tokens, `[data-theme="dark"] [data-tone="${tone}"]`),
        blocks(tokens, '[data-theme="dark"]'),
        blocks(theme, '[data-theme="dark"]'),
        blocks(theme, ":root"),
        theme,
      ],
    };
    for (const [name, scopes] of Object.entries(themes)) {
      expect(scopes[0], `${tone} ${name} block`).not.toBe("");
      const ink = resolveRgb("--tone-on-action", scopes);
      const fill = resolveRgb("--tone-action", scopes);
      const label = `${tone} ${name}`;
      expect(contrast(fill, ink), `${label} at rest`).toBeGreaterThanOrEqual(4.5);
      const hover = resolveRgb("--tone-action-hover", scopes);
      expect(contrast(hover, ink), `${label} --tone-action-hover`).toBeGreaterThanOrEqual(4.5);
      const layer = resolveRgb("--m3-on-surface", scopes);
      for (const { state, opacity } of STATES) {
        const ratio = contrast(over(fill, layer, opacity), ink);
        expect(ratio, `${label} ${state}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("lays the neutral ink layer, not the label's color, over the cockpit's filled controls", () => {
    for (const path of [
      "../../components/AdminButton.tsx",
      "../../components/Shell/FabButton.tsx",
    ]) {
      expect(read(path), path).not.toMatch(/--state-layer-color:var\(--tone-on-action/);
    }
  });
});
