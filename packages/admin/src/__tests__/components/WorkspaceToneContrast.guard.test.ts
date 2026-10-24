/**
 * Guard: every workspace's filled action carries its label at AA, at rest and
 * in every state it renders.
 *
 * A filled header action, the FAB, a step marker and the shared primary
 * buttons put `--tone-on-action` (white in light, the tone's -900 ink in dark,
 * DL-009) on `--tone-action`. Shared buttons hover on `--tone-action-hover`.
 * The cockpit's filled AdminButton, AdminIconButton and FAB keep their fill
 * and lay the neutral ink layer (`--m3-on-surface`, Rule 18) over it at the
 * state opacities, beneath their content (`.m3-state-layer-beneath`): the
 * layer deepens a light fill and lifts a dark one while the label keeps its
 * color. Painted over the label as well, it pulls fill and label toward one
 * ink, and Community's dark pair (4.58:1 at rest) falls to 3.66:1 when pressed.
 * The tones resolve against the cockpit's amber ramp (index.css), set on <body>
 * so the canvas and the dialogs, side sheets and toasts it portals share it:
 * Community's light orange-700 carries white at 5.02:1 there, where the shared
 * ramp those portals drew before gave it 4.01:1. Storybook mirrors the ramp.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf-8");
const tokens = read("../../styles/admin-m3-tokens.css");
const theme = read("../../../../shared/src/styles/theme.css");
const app = read("../../index.css");
const storybook = read("../../../../shared/.storybook/surfaces.css");
const adminButton = read("../../components/AdminButton.tsx");
const fabButton = read("../../components/Shell/FabButton.tsx");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Declarations of every rule in `css` whose last selector line is `selector`, in source order. */
const blocks = (css: string, selector: string) =>
  [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escape(selector)}\\s*\\{([^}]*)\\}`, "g"))]
    .map((match) => match[1])
    .join("\n");

/** The first `count` rules after `marker` in `css`: their selector and declarations. */
const rulesAfter = (css: string, marker: string, count: number) => {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`${marker} not found`);
  return [...css.slice(start).matchAll(/([^{}]*)\{([^}]*)\}/g)]
    .slice(0, count)
    .map(([, selector, body]) => ({ selector: selector.split("*/").pop()?.trim(), body }));
};

/** A block's custom property declarations, comments dropped. */
const declarations = (body: string) =>
  [...body.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
    ([, property, value]) => `${property}: ${value.trim()}`
  );

const [RAMP, RAMP_DARK] = rulesAfter(app, "STATUS PALETTE REMAP", 2);

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

/** A state layer of `layer` at `opacity` over `color`. */
const over = (color: Rgb, layer: Rgb, opacity: number): Rgb =>
  color.map((channel, index) => channel * (1 - opacity) + layer[index] * opacity) as Rgb;

const STATES = ["--m3-state-hover", "--m3-state-focus", "--m3-state-pressed"].map((state) => ({
  state,
  opacity: Number(declared(state, [blocks(tokens, ":root")])),
}));

const TONES = ["hub", "garden", "community", "actions", "home"];

/** The class lists of the cockpit's filled controls. */
const filledVariants = [...adminButton.matchAll(/\n( *)filled: \[\n([\s\S]*?)\n\1\],/g)].map(
  (match) => match[2]
);
const FILLED_CONTROLS: Record<string, string> = {
  "AdminButton filled": filledVariants[0] ?? "",
  "AdminIconButton filled": filledVariants[1] ?? "",
  FabButton:
    fabButton.match(/data-slot="fab-button"[\s\S]*?className=\{cn\(([\s\S]*?)\n\s*\)\}/)?.[1] ?? "",
};

/** Whether the stylesheet paints an opted-in control's state layer beneath its content. */
const BENEATH_RULE =
  /isolation:\s*isolate;/.test(blocks(tokens, ".m3-state-layer-beneath")) &&
  /z-index:\s*-1;/.test(blocks(tokens, ".m3-state-layer-beneath::after"));

const layerBeneathLabel = (classes: string) =>
  BENEATH_RULE && /\bm3-state-layer-beneath\b/.test(classes);

describe("workspace tone fills", () => {
  it.each(TONES)("%s keeps its filled action's label at AA at rest and in every state", (tone) => {
    const themes = {
      light: [
        blocks(tokens, `[data-tone="${tone}"]`),
        blocks(tokens, ":root"),
        RAMP.body,
        blocks(theme, ":root"),
        theme,
      ],
      dark: [
        blocks(tokens, `[data-theme="dark"] [data-tone="${tone}"]`),
        blocks(tokens, '[data-theme="dark"]'),
        blocks(theme, '[data-theme="dark"]'),
        RAMP_DARK.body,
        RAMP.body,
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
      for (const [control, classes] of Object.entries(FILLED_CONTROLS)) {
        for (const { state, opacity } of STATES) {
          // A layer painted over the label moves the label toward its ink too.
          const shown = layerBeneathLabel(classes) ? ink : over(ink, layer, opacity);
          const ratio = contrast(over(fill, layer, opacity), shown);
          expect(ratio, `${label} ${control} ${state}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("keeps one ramp for the canvas, what it portals and Storybook's admin stories", () => {
    // On <body>, the dialogs, side sheets, toasts and popovers that portal there draw it too.
    expect([RAMP.selector, RAMP_DARK.selector]).toEqual(["body", '[data-theme="dark"] body']);
    const mirror = rulesAfter(storybook, "STATUS PALETTE REMAP (mirror)", 2);
    expect(mirror.map((rule) => declarations(rule.body))).toEqual(
      [RAMP, RAMP_DARK].map((rule) => declarations(rule.body))
    );
  });

  it("finds each filled control and lays the neutral ink layer, not the label's color", () => {
    for (const [control, classes] of Object.entries(FILLED_CONTROLS)) {
      expect(classes, control).toMatch(/bg-\[rgb\(var\(--tone-action,/);
      expect(classes, control).not.toMatch(/--state-layer-color:var\(--tone-on-action/);
    }
  });
});
