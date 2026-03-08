import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

/**
 * Visual documentation of the Green Goods color system.
 *
 * Colors are defined as RGB triplets in `theme.css` `:root` and exposed
 * to Tailwind via `@theme` blocks. Dark mode overrides use
 * `[data-theme="dark"]` to remap semantic tokens while primitives stay fixed.
 */

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type Swatch = { name: string; cssVar: string; rgb: string };

const gray: Swatch[] = [
  { name: "gray-0", cssVar: "--gray-0", rgb: "255 255 255" },
  { name: "gray-50", cssVar: "--gray-50", rgb: "247 247 247" },
  { name: "gray-100", cssVar: "--gray-100", rgb: "245 245 245" },
  { name: "gray-200", cssVar: "--gray-200", rgb: "235 235 235" },
  { name: "gray-300", cssVar: "--gray-300", rgb: "209 209 209" },
  { name: "gray-400", cssVar: "--gray-400", rgb: "163 163 163" },
  { name: "gray-500", cssVar: "--gray-500", rgb: "123 123 123" },
  { name: "gray-600", cssVar: "--gray-600", rgb: "92 92 92" },
  { name: "gray-700", cssVar: "--gray-700", rgb: "51 51 51" },
  { name: "gray-800", cssVar: "--gray-800", rgb: "41 41 41" },
  { name: "gray-900", cssVar: "--gray-900", rgb: "28 28 28" },
  { name: "gray-950", cssVar: "--gray-950", rgb: "23 23 23" },
];

const green: Swatch[] = [
  { name: "green-50", cssVar: "--green-50", rgb: "224 250 236" },
  { name: "green-100", cssVar: "--green-100", rgb: "208 251 233" },
  { name: "green-200", cssVar: "--green-200", rgb: "194 245 218" },
  { name: "green-300", cssVar: "--green-300", rgb: "132 235 180" },
  { name: "green-400", cssVar: "--green-400", rgb: "62 224 137" },
  { name: "green-500", cssVar: "--green-500", rgb: "31 193 107" },
  { name: "green-600", cssVar: "--green-600", rgb: "29 175 97" },
  { name: "green-700", cssVar: "--green-700", rgb: "23 140 78" },
  { name: "green-800", cssVar: "--green-800", rgb: "26 117 68" },
  { name: "green-900", cssVar: "--green-900", rgb: "22 100 59" },
  { name: "green-950", cssVar: "--green-950", rgb: "11 70 39" },
];

const blue: Swatch[] = [
  { name: "blue-50", cssVar: "--blue-50", rgb: "235 241 255" },
  { name: "blue-100", cssVar: "--blue-100", rgb: "213 226 255" },
  { name: "blue-200", cssVar: "--blue-200", rgb: "192 213 255" },
  { name: "blue-300", cssVar: "--blue-300", rgb: "151 186 255" },
  { name: "blue-400", cssVar: "--blue-400", rgb: "104 149 255" },
  { name: "blue-500", cssVar: "--blue-500", rgb: "51 92 255" },
  { name: "blue-600", cssVar: "--blue-600", rgb: "53 89 233" },
  { name: "blue-700", cssVar: "--blue-700", rgb: "37 71 208" },
  { name: "blue-800", cssVar: "--blue-800", rgb: "31 59 173" },
  { name: "blue-900", cssVar: "--blue-900", rgb: "24 47 139" },
  { name: "blue-950", cssVar: "--blue-950", rgb: "18 35 104" },
];

const red: Swatch[] = [
  { name: "red-50", cssVar: "--red-50", rgb: "255 235 236" },
  { name: "red-100", cssVar: "--red-100", rgb: "255 213 216" },
  { name: "red-200", cssVar: "--red-200", rgb: "255 192 197" },
  { name: "red-300", cssVar: "--red-300", rgb: "255 151 160" },
  { name: "red-400", cssVar: "--red-400", rgb: "255 104 117" },
  { name: "red-500", cssVar: "--red-500", rgb: "251 55 72" },
  { name: "red-600", cssVar: "--red-600", rgb: "233 53 68" },
  { name: "red-700", cssVar: "--red-700", rgb: "208 37 51" },
  { name: "red-800", cssVar: "--red-800", rgb: "173 31 43" },
  { name: "red-900", cssVar: "--red-900", rgb: "139 24 34" },
  { name: "red-950", cssVar: "--red-950", rgb: "104 18 25" },
];

const orange: Swatch[] = [
  { name: "orange-50", cssVar: "--orange-50", rgb: "255 243 235" },
  { name: "orange-100", cssVar: "--orange-100", rgb: "255 230 213" },
  { name: "orange-200", cssVar: "--orange-200", rgb: "255 217 192" },
  { name: "orange-300", cssVar: "--orange-300", rgb: "255 193 151" },
  { name: "orange-400", cssVar: "--orange-400", rgb: "255 164 104" },
  { name: "orange-500", cssVar: "--orange-500", rgb: "250 115 25" },
  { name: "orange-600", cssVar: "--orange-600", rgb: "225 102 20" },
  { name: "orange-700", cssVar: "--orange-700", rgb: "206 94 18" },
  { name: "orange-800", cssVar: "--orange-800", rgb: "183 83 16" },
  { name: "orange-900", cssVar: "--orange-900", rgb: "150 68 13" },
  { name: "orange-950", cssVar: "--orange-950", rgb: "113 51 10" },
];

const yellow: Swatch[] = [
  { name: "yellow-50", cssVar: "--yellow-50", rgb: "255 244 214" },
  { name: "yellow-100", cssVar: "--yellow-100", rgb: "255 239 204" },
  { name: "yellow-200", cssVar: "--yellow-200", rgb: "255 236 192" },
  { name: "yellow-300", cssVar: "--yellow-300", rgb: "255 224 151" },
  { name: "yellow-400", cssVar: "--yellow-400", rgb: "255 210 104" },
  { name: "yellow-500", cssVar: "--yellow-500", rgb: "246 181 30" },
  { name: "yellow-600", cssVar: "--yellow-600", rgb: "230 168 25" },
  { name: "yellow-700", cssVar: "--yellow-700", rgb: "201 154 44" },
  { name: "yellow-800", cssVar: "--yellow-800", rgb: "167 128 37" },
  { name: "yellow-900", cssVar: "--yellow-900", rgb: "134 102 29" },
  { name: "yellow-950", cssVar: "--yellow-950", rgb: "98 76 24" },
];

const purple: Swatch[] = [
  { name: "purple-50", cssVar: "--purple-50", rgb: "239 235 255" },
  { name: "purple-100", cssVar: "--purple-100", rgb: "220 213 255" },
  { name: "purple-200", cssVar: "--purple-200", rgb: "202 192 255" },
  { name: "purple-300", cssVar: "--purple-300", rgb: "168 151 255" },
  { name: "purple-400", cssVar: "--purple-400", rgb: "140 113 246" },
  { name: "purple-500", cssVar: "--purple-500", rgb: "125 82 244" },
  { name: "purple-600", cssVar: "--purple-600", rgb: "105 62 224" },
  { name: "purple-700", cssVar: "--purple-700", rgb: "91 44 201" },
  { name: "purple-800", cssVar: "--purple-800", rgb: "76 37 167" },
  { name: "purple-900", cssVar: "--purple-900", rgb: "61 29 134" },
  { name: "purple-950", cssVar: "--purple-950", rgb: "53 26 117" },
];

const sky: Swatch[] = [
  { name: "sky-50", cssVar: "--sky-50", rgb: "235 248 255" },
  { name: "sky-100", cssVar: "--sky-100", rgb: "213 241 255" },
  { name: "sky-200", cssVar: "--sky-200", rgb: "192 234 255" },
  { name: "sky-300", cssVar: "--sky-300", rgb: "151 220 255" },
  { name: "sky-400", cssVar: "--sky-400", rgb: "104 205 255" },
  { name: "sky-500", cssVar: "--sky-500", rgb: "71 194 255" },
  { name: "sky-600", cssVar: "--sky-600", rgb: "53 173 233" },
  { name: "sky-700", cssVar: "--sky-700", rgb: "37 151 208" },
  { name: "sky-800", cssVar: "--sky-800", rgb: "31 126 173" },
  { name: "sky-900", cssVar: "--sky-900", rgb: "24 101 139" },
  { name: "sky-950", cssVar: "--sky-950", rgb: "18 75 104" },
];

const pink: Swatch[] = [
  { name: "pink-50", cssVar: "--pink-50", rgb: "255 235 244" },
  { name: "pink-100", cssVar: "--pink-100", rgb: "255 213 234" },
  { name: "pink-200", cssVar: "--pink-200", rgb: "255 192 223" },
  { name: "pink-300", cssVar: "--pink-300", rgb: "255 151 203" },
  { name: "pink-400", cssVar: "--pink-400", rgb: "255 104 179" },
  { name: "pink-500", cssVar: "--pink-500", rgb: "251 75 163" },
  { name: "pink-600", cssVar: "--pink-600", rgb: "233 53 143" },
  { name: "pink-700", cssVar: "--pink-700", rgb: "208 37 122" },
  { name: "pink-800", cssVar: "--pink-800", rgb: "173 31 102" },
  { name: "pink-900", cssVar: "--pink-900", rgb: "139 24 82" },
  { name: "pink-950", cssVar: "--pink-950", rgb: "104 18 61" },
];

const teal: Swatch[] = [
  { name: "teal-50", cssVar: "--teal-50", rgb: "228 251 248" },
  { name: "teal-100", cssVar: "--teal-100", rgb: "208 251 245" },
  { name: "teal-200", cssVar: "--teal-200", rgb: "194 245 238" },
  { name: "teal-300", cssVar: "--teal-300", rgb: "132 235 221" },
  { name: "teal-400", cssVar: "--teal-400", rgb: "63 222 201" },
  { name: "teal-500", cssVar: "--teal-500", rgb: "34 211 187" },
  { name: "teal-600", cssVar: "--teal-600", rgb: "29 175 156" },
  { name: "teal-700", cssVar: "--teal-700", rgb: "23 140 125" },
  { name: "teal-800", cssVar: "--teal-800", rgb: "26 117 105" },
  { name: "teal-900", cssVar: "--teal-900", rgb: "22 100 90" },
  { name: "teal-950", cssVar: "--teal-950", rgb: "11 70 62" },
];

const allPalettes = [
  { label: "Gray", swatches: gray },
  { label: "Green (Brand)", swatches: green },
  { label: "Blue", swatches: blue },
  { label: "Red", swatches: red },
  { label: "Orange", swatches: orange },
  { label: "Yellow", swatches: yellow },
  { label: "Purple", swatches: purple },
  { label: "Sky", swatches: sky },
  { label: "Pink", swatches: pink },
  { label: "Teal", swatches: teal },
];

type SemanticToken = { name: string; cssVar: string; lightRef: string; darkRef: string };

const bgTokens: SemanticToken[] = [
  { name: "bg-white-0", cssVar: "--bg-white-0", lightRef: "neutral-0", darkRef: "neutral-950" },
  { name: "bg-weak-50", cssVar: "--bg-weak-50", lightRef: "neutral-50", darkRef: "neutral-850" },
  { name: "bg-soft-200", cssVar: "--bg-soft-200", lightRef: "neutral-100", darkRef: "neutral-800" },
  { name: "bg-sub-300", cssVar: "--bg-sub-300", lightRef: "neutral-200", darkRef: "neutral-700" },
  {
    name: "bg-surface-800",
    cssVar: "--bg-surface-800",
    lightRef: "neutral-800",
    darkRef: "neutral-600",
  },
  {
    name: "bg-strong-950",
    cssVar: "--bg-strong-950",
    lightRef: "neutral-950",
    darkRef: "neutral-100",
  },
];

const textTokens: SemanticToken[] = [
  {
    name: "text-strong-950",
    cssVar: "--text-strong-950",
    lightRef: "neutral-950",
    darkRef: "neutral-50",
  },
  {
    name: "text-sub-600",
    cssVar: "--text-sub-600",
    lightRef: "neutral-600",
    darkRef: "neutral-300",
  },
  {
    name: "text-soft-400",
    cssVar: "--text-soft-400",
    lightRef: "neutral-400",
    darkRef: "neutral-400",
  },
  {
    name: "text-disabled-300",
    cssVar: "--text-disabled-300",
    lightRef: "neutral-300",
    darkRef: "neutral-500",
  },
  { name: "text-white-0", cssVar: "--text-white-0", lightRef: "neutral-0", darkRef: "neutral-900" },
];

const strokeTokens: SemanticToken[] = [
  {
    name: "stroke-strong-950",
    cssVar: "--stroke-strong-950",
    lightRef: "neutral-950",
    darkRef: "neutral-300",
  },
  {
    name: "stroke-sub-300",
    cssVar: "--stroke-sub-300",
    lightRef: "neutral-300",
    darkRef: "neutral-700",
  },
  {
    name: "stroke-soft-200",
    cssVar: "--stroke-soft-200",
    lightRef: "neutral-100",
    darkRef: "neutral-800",
  },
  {
    name: "stroke-white-0",
    cssVar: "--stroke-white-0",
    lightRef: "neutral-0",
    darkRef: "neutral-950",
  },
];

type StateGroup = { label: string; prefix: string; hue: string };

const stateGroups: StateGroup[] = [
  { label: "Information", prefix: "information", hue: "blue" },
  { label: "Warning", prefix: "warning", hue: "orange" },
  { label: "Error", prefix: "error", hue: "red" },
  { label: "Success", prefix: "success", hue: "green" },
  { label: "Away", prefix: "away", hue: "yellow" },
  { label: "Feature", prefix: "feature", hue: "purple" },
  { label: "Verified", prefix: "verified", hue: "sky" },
  { label: "Highlighted", prefix: "highlighted", hue: "pink" },
  { label: "Stable", prefix: "stable", hue: "teal" },
];

/* -------------------------------------------------------------------------- */
/*  Rendering helpers                                                          */
/* -------------------------------------------------------------------------- */

function SwatchChip({ swatch }: { swatch: Swatch }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-16 h-16 rounded-lg border border-stroke-soft-200"
        style={{ backgroundColor: `rgb(${swatch.rgb})` }}
      />
      <span
        className="text-[11px] font-medium text-text-strong-950 text-center leading-tight"
        style={{ maxWidth: 72 }}
      >
        {swatch.name}
      </span>
      <span className="text-[10px] text-text-soft-400 font-mono">{swatch.rgb}</span>
    </div>
  );
}

function PaletteRow({ label, swatches }: { label: string; swatches: Swatch[] }) {
  return (
    <div className="mb-8">
      <h3 className="text-label-md text-text-strong-950 mb-3">{label}</h3>
      <div className="flex flex-wrap gap-3">
        {swatches.map((s) => (
          <SwatchChip key={s.name} swatch={s} />
        ))}
      </div>
    </div>
  );
}

function SemanticRow({ token, kind }: { token: SemanticToken; kind: "bg" | "text" | "stroke" }) {
  const isBg = kind === "bg";
  const isText = kind === "text";
  const isStroke = kind === "stroke";

  return (
    <div className="flex items-center gap-4 py-2 border-b border-stroke-soft-200">
      {isBg && (
        <div
          className="w-12 h-12 rounded-lg border border-stroke-soft-200"
          style={{ backgroundColor: `rgb(var(${token.cssVar}))` }}
        />
      )}
      {isText && (
        <div className="w-12 h-12 rounded-lg border border-stroke-soft-200 flex items-center justify-center bg-bg-white-0">
          <span className="text-label-lg font-bold" style={{ color: `rgb(var(${token.cssVar}))` }}>
            Aa
          </span>
        </div>
      )}
      {isStroke && (
        <div
          className="w-12 h-12 rounded-lg bg-bg-white-0"
          style={{ border: `2px solid rgb(var(${token.cssVar}))` }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-label-sm text-text-strong-950 font-medium">{token.name}</div>
        <div className="text-paragraph-xs text-text-soft-400 font-mono">var({token.cssVar})</div>
      </div>
      <div className="text-paragraph-xs text-text-sub-600 text-right">
        <div>Light: {token.lightRef}</div>
        <div>Dark: {token.darkRef}</div>
      </div>
    </div>
  );
}

function StateColorRow({ group }: { group: StateGroup }) {
  const suffixes = ["dark", "base", "light", "lighter"] as const;
  return (
    <div className="mb-6">
      <h4 className="text-label-sm text-text-strong-950 mb-2">
        {group.label} <span className="text-text-soft-400 font-normal">({group.hue})</span>
      </h4>
      <div className="flex gap-2">
        {suffixes.map((s) => {
          const varName = `--${group.prefix}-${s}`;
          return (
            <div key={s} className="flex flex-col items-center gap-1">
              <div
                className="w-14 h-14 rounded-lg border border-stroke-soft-200"
                style={{ backgroundColor: `rgb(var(${varName}))` }}
              />
              <span className="text-[10px] text-text-sub-600 font-mono">{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

const meta: Meta = {
  title: "Design Tokens/Colors",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The Green Goods color system: primitive palettes (fixed RGB values) and semantic tokens that swap between light and dark themes via `[data-theme]`.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/* -------------------------------------------------------------------------- */
/*  Stories                                                                     */
/* -------------------------------------------------------------------------- */

/** All primitive color palettes organized by hue. */
export const Default: Story = {
  name: "Primitive Palettes",
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Primitive colors are raw RGB triplets stored in <code>:root</code>. They never change
        between themes -- semantic tokens reference them indirectly.
      </p>
      {allPalettes.map((p) => (
        <PaletteRow key={p.label} label={p.label} swatches={p.swatches} />
      ))}
    </div>
  ),
};

/** Semantic tokens: bg-*, text-*, stroke-*, state-* with their CSS variable names. */
export const SemanticColors: Story = {
  render: () => (
    <div>
      <p className="text-paragraph-sm text-text-sub-600 mb-6">
        Semantic tokens are the public API of the color system. Components should always use these
        -- never raw primitive values. They remap automatically in dark mode.
      </p>

      <h3 className="text-label-md text-text-strong-950 mb-3">Backgrounds</h3>
      <div className="mb-8">
        {bgTokens.map((t) => (
          <SemanticRow key={t.name} token={t} kind="bg" />
        ))}
      </div>

      <h3 className="text-label-md text-text-strong-950 mb-3">Text</h3>
      <div className="mb-8">
        {textTokens.map((t) => (
          <SemanticRow key={t.name} token={t} kind="text" />
        ))}
      </div>

      <h3 className="text-label-md text-text-strong-950 mb-3">Strokes / Borders</h3>
      <div className="mb-8">
        {strokeTokens.map((t) => (
          <SemanticRow key={t.name} token={t} kind="stroke" />
        ))}
      </div>

      <h3 className="text-label-md text-text-strong-950 mb-3">State Colors</h3>
      <div className="flex flex-wrap gap-x-8">
        {stateGroups.map((g) => (
          <StateColorRow key={g.prefix} group={g} />
        ))}
      </div>
    </div>
  ),
};

/**
 * Side-by-side comparison of semantic tokens in light and dark mode.
 * Left column renders without data-theme (light default), right column
 * renders with data-theme="dark".
 */
export const DarkModeComparison: Story = {
  render: () => {
    const semanticPairs = [...bgTokens, ...textTokens, ...strokeTokens];

    return (
      <div>
        <p className="text-paragraph-sm text-text-sub-600 mb-6">
          The same CSS variable resolves to different primitives depending on
          <code> [data-theme]</code>. This side-by-side shows how each semantic token maps in light
          vs dark mode.
        </p>

        <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden border border-stroke-soft-200">
          {/* Light column */}
          <div className="p-4" style={{ backgroundColor: "rgb(255,255,255)" }}>
            <h4 className="text-label-sm font-semibold mb-4" style={{ color: "rgb(23,23,23)" }}>
              Light Mode
            </h4>
            {semanticPairs.map((t) => (
              <div key={t.name} className="flex items-center gap-3 py-1.5">
                <div
                  className="w-8 h-8 rounded border"
                  style={{
                    backgroundColor: t.name.startsWith("bg")
                      ? `rgb(var(${t.cssVar}))`
                      : "rgb(255,255,255)",
                    borderColor: t.name.startsWith("stroke")
                      ? `rgb(var(${t.cssVar}))`
                      : "rgb(235,235,235)",
                    color: t.name.startsWith("text") ? `rgb(var(${t.cssVar}))` : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {t.name.startsWith("text") && "Aa"}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgb(23,23,23)" }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: "rgb(123,123,123)" }}>{t.lightRef}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Dark column */}
          <div data-theme="dark" className="p-4" style={{ backgroundColor: "rgb(23,23,23)" }}>
            <h4 className="text-label-sm font-semibold mb-4" style={{ color: "rgb(247,247,247)" }}>
              Dark Mode
            </h4>
            {semanticPairs.map((t) => (
              <div key={t.name} className="flex items-center gap-3 py-1.5">
                <div
                  className="w-8 h-8 rounded"
                  data-theme="dark"
                  style={{
                    backgroundColor: t.name.startsWith("bg")
                      ? `rgb(var(${t.cssVar}))`
                      : "rgb(23,23,23)",
                    border: `1px solid ${
                      t.name.startsWith("stroke") ? `rgb(var(${t.cssVar}))` : "rgb(51,51,51)"
                    }`,
                    color: t.name.startsWith("text") ? `rgb(var(${t.cssVar}))` : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {t.name.startsWith("text") && "Aa"}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgb(247,247,247)" }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: "rgb(163,163,163)" }}>{t.darkRef}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
};

/** Full gallery: primitives, semantics, and state colors in one view. */
export const Gallery: Story = {
  render: () => (
    <div>
      <h2 className="text-title-h5 text-text-strong-950 mb-6">Complete Color Reference</h2>

      <section className="mb-12">
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          Primitive Palettes
        </h3>
        {allPalettes.map((p) => (
          <PaletteRow key={p.label} label={p.label} swatches={p.swatches} />
        ))}
      </section>

      <section className="mb-12">
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          Semantic Backgrounds
        </h3>
        {bgTokens.map((t) => (
          <SemanticRow key={t.name} token={t} kind="bg" />
        ))}
      </section>

      <section className="mb-12">
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          Semantic Text
        </h3>
        {textTokens.map((t) => (
          <SemanticRow key={t.name} token={t} kind="text" />
        ))}
      </section>

      <section className="mb-12">
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          Semantic Strokes
        </h3>
        {strokeTokens.map((t) => (
          <SemanticRow key={t.name} token={t} kind="stroke" />
        ))}
      </section>

      <section>
        <h3 className="text-label-lg text-text-strong-950 mb-4 pb-2 border-b border-stroke-soft-200">
          State Colors
        </h3>
        <div className="flex flex-wrap gap-x-8">
          {stateGroups.map((g) => (
            <StateColorRow key={g.prefix} group={g} />
          ))}
        </div>
      </section>
    </div>
  ),
};
