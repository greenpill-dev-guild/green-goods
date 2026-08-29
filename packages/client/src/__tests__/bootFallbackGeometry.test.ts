/**
 * Geometry and surface parity contract for the boot skeleton.
 *
 * The website boot fallback in index.html hand-mirrors the editorial hero and
 * site header geometry in plain CSS because it renders before Tailwind loads.
 * Each mirrored declaration in index.html carries a trailing comment naming
 * the Tailwind class it replicates; this suite asserts both halves of every
 * pair, so tuning either side fails here and names the file to update with it.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const INDEX_HTML = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const HERO_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/Public/PublicEditorialHero.tsx"),
  "utf8"
);
const HEADER_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/Navigation/SiteHeader.tsx"),
  "utf8"
);
const THEME_SOURCE = readFileSync(resolve(process.cwd(), "../shared/src/styles/theme.css"), "utf8");
const ATOMS_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/Public/atoms/EditorialAtoms.tsx"),
  "utf8"
);

/** Hex for a theme.css `--name: R G B;` triple (the boot fallback format). */
function themeRgbToHex(varName: string): string {
  const match = THEME_SOURCE.match(new RegExp(`${varName}:\\s*(\\d+) (\\d+) (\\d+)`));
  if (!match) throw new Error(`Missing ${varName} triple in theme.css`);
  return `#${match
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

const BOOT_CSS = (() => {
  const match = INDEX_HTML.match(/<style id=["']boot-fallback-styles["']>([\s\S]*?)<\/style>/);
  if (!match?.[1]) throw new Error("Missing boot-fallback-styles block");
  return match[1];
})();

/** Concatenated contents of every `@media (<condition>)` block in the boot CSS. */
function mediaBlocks(condition: string): string {
  const marker = `@media (${condition})`;
  let out = "";
  let from = 0;
  for (;;) {
    const start = BOOT_CSS.indexOf(marker, from);
    if (start === -1) break;
    const open = BOOT_CSS.indexOf("{", start);
    let depth = 1;
    let index = open + 1;
    while (index < BOOT_CSS.length && depth > 0) {
      if (BOOT_CSS[index] === "{") depth += 1;
      else if (BOOT_CSS[index] === "}") depth -= 1;
      index += 1;
    }
    out += BOOT_CSS.slice(open + 1, index - 1);
    from = index;
  }
  if (!out) throw new Error(`No @media (${condition}) block in boot styles`);
  return out;
}

type MediaScope = "base" | "sm" | "lg";

function scopeCss(scope: MediaScope): string {
  if (scope === "sm") return mediaBlocks("min-width: 640px");
  if (scope === "lg") return mediaBlocks("min-width: 1024px");
  return BOOT_CSS;
}

interface GeometryPair {
  /** Literal class string expected in the mirrored component source. */
  classLiteral: string;
  source: "header" | "hero";
  /** Annotated declarations expected in the boot CSS, per media scope. */
  boot: { css: string; scope: MediaScope }[];
}

const GEOMETRY_PAIRS: GeometryPair[] = [
  {
    classLiteral: "bottom-14 sm:bottom-24 lg:bottom-[12svh]",
    source: "hero",
    boot: [
      { css: "bottom: 56px; /* bottom-14 */", scope: "base" },
      { css: "bottom: 96px; /* sm:bottom-24 */", scope: "sm" },
      { css: "bottom: 12svh;", scope: "lg" },
    ],
  },
  {
    classLiteral: 'className="px-6 sm:px-10"',
    source: "hero",
    boot: [
      { css: "padding: 0 24px; /* px-6 */", scope: "base" },
      { css: "padding: 0 40px; /* sm:px-10 */", scope: "sm" },
    ],
  },
  {
    classLiteral: "mx-auto max-w-7xl",
    source: "hero",
    boot: [{ css: "max-width: 1280px; /* max-w-7xl */", scope: "base" }],
  },
  {
    classLiteral: "max-w-[31rem]",
    source: "hero",
    boot: [{ css: "max-width: 496px; /* max-w-[31rem] */", scope: "base" }],
  },
  {
    classLiteral: "lg:max-w-[33.5rem]",
    source: "hero",
    boot: [{ css: "max-width: 536px; /* lg:max-w-[33.5rem] */", scope: "lg" }],
  },
  {
    classLiteral: "bg-bg-weak-50 p-6",
    source: "hero",
    boot: [{ css: "padding: 24px; /* p-6 */", scope: "base" }],
  },
  {
    classLiteral: "sm:p-8",
    source: "hero",
    boot: [{ css: "padding: 32px; /* sm:p-8 */", scope: "sm" }],
  },
  {
    classLiteral: "lg:p-10",
    source: "hero",
    boot: [{ css: "padding: 40px; /* lg:p-10 */", scope: "lg" }],
  },
  {
    classLiteral: "min-h-screen min-h-[100svh]",
    source: "hero",
    boot: [{ css: "min-height: 100svh; /* min-h-[100svh] */", scope: "base" }],
  },
  {
    classLiteral: "h-[340px] sm:h-[420px] lg:h-[500px]",
    source: "hero",
    boot: [
      { css: "height: 340px; /* h-[340px] */", scope: "base" },
      { css: "height: 420px; /* sm:h-[420px] */", scope: "sm" },
      { css: "height: 500px; /* lg:h-[500px] */", scope: "lg" },
    ],
  },
  {
    classLiteral: "bottom-[-4rem] sm:bottom-[-5rem]",
    source: "hero",
    boot: [
      { css: "bottom: -64px; /* bottom-[-4rem] */", scope: "base" },
      { css: "bottom: -80px; /* sm:bottom-[-5rem] */", scope: "sm" },
    ],
  },
  {
    classLiteral: 'className="px-6 sm:px-10"',
    source: "header",
    boot: [],
  },
  {
    classLiteral: "mx-auto flex h-16 max-w-7xl",
    source: "header",
    boot: [{ css: "height: 64px; /* h-16 */", scope: "base" }],
  },
];

describe("boot skeleton geometry parity", () => {
  it.each(GEOMETRY_PAIRS)("keeps the $source $classLiteral pair in sync", (pair) => {
    const source = pair.source === "hero" ? HERO_SOURCE : HEADER_SOURCE;
    expect(source).toContain(pair.classLiteral);
    for (const declaration of pair.boot) {
      expect(scopeCss(declaration.scope)).toContain(declaration.css);
    }
  });

  it("routes the skeleton and recovery cards through rail → column → card wrappers", () => {
    expect(INDEX_HTML).toMatch(
      /class="boot-editorial-hero">\s*<div class="boot-editorial-card-rail">\s*<div class="boot-editorial-card-column">\s*<div class="boot-editorial-card">/
    );
    expect(INDEX_HTML).toMatch(
      /class="boot-editorial-card-rail" id="boot-website-recovery" hidden>\s*<div class="boot-editorial-card-column">\s*<div class="boot-editorial-card boot-editorial-recovery">/
    );
    expect(INDEX_HTML).toMatch(
      /class="boot-editorial-header">\s*<div class="boot-editorial-header-row">/
    );
  });

  it("keeps card and header geometry out of the 767px nav-visibility query", () => {
    const navQuery = mediaBlocks("max-width: 767px");
    expect(navQuery).not.toContain("boot-editorial-card");
    expect(navQuery).not.toContain("boot-editorial-header");
  });

  it("scopes the banner spill to rails inside the plate so recovery stays viewport-anchored", () => {
    expect(BOOT_CSS).toContain(
      '[data-boot-hero="banner"] .boot-editorial-hero .boot-editorial-card-rail'
    );
    expect(BOOT_CSS).toContain('[data-boot-hero="banner"] .boot-editorial-shell');
    expect(BOOT_CSS).not.toContain('[data-boot-hero="banner"] .boot-editorial-card-rail');
  });

  it("paints the card and canvas with the hero's bg-weak-50 surface at the theme's values", () => {
    // The hero card surface is bg-bg-weak-50. The boot card must carry the
    // same token, and because no app CSS is loaded at boot time, its fallback
    // hexes must equal the theme's resolved values (light: neutral-50,
    // dark: neutral-925 — the two halves of the bg-weak-50 mapping).
    expect(HERO_SOURCE).toContain("bg-bg-weak-50");
    expect(THEME_SOURCE).toContain("--bg-weak-50: var(--neutral-50)");
    expect(THEME_SOURCE).toContain("--bg-weak-50: var(--neutral-925)");
    const light = themeRgbToHex("--neutral-50");
    const dark = themeRgbToHex("--neutral-925");
    expect(BOOT_CSS).toContain("background: var(--boot-card); /* bg-bg-weak-50 */");
    expect(BOOT_CSS).toContain(`--boot-card: var(--color-bg-weak-50, ${light})`);
    expect(BOOT_CSS).toContain(`--boot-card: var(--color-bg-weak-50, ${dark})`);
    expect(BOOT_CSS).toContain(`--boot-canvas: var(--color-bg-weak-50, ${light})`);
    expect(BOOT_CSS).toContain(`--boot-canvas: var(--color-bg-weak-50, ${dark})`);
    // The vellum material (--boot-warm) was a mismatch against the real hero
    // card; keep it out so it is not reintroduced by habit.
    expect(BOOT_CSS).not.toContain("--boot-warm");
  });

  it("builds the card line boxes from the hero type scale", () => {
    // Skeleton bars each occupy one line-height of the type they stand in
    // for, so the card's height equals the loaded hero card's. The expected
    // values are DERIVED here from the same font sizes the atoms declare —
    // change the type scale and this test fails until the boot metrics follow.
    expect(ATOMS_SOURCE).toContain("text-3xl leading-[1.04]");
    expect(ATOMS_SOURCE).toContain("sm:text-4xl md:text-5xl lg:text-6xl");
    expect(ATOMS_SOURCE).toContain("text-base leading-[1.6] md:text-lg");
    expect(HERO_SOURCE).toContain("md:text-[3.35rem] lg:text-[4rem]");

    const px = (value: number) => `${Number(value.toFixed(3))}px`;
    const titleLh = (fontPx: number) => px(fontPx * 1.04); // leading-[1.04]
    const ledeLh = (fontPx: number) => px(fontPx * 1.6); // leading-[1.6]

    expect(BOOT_CSS).toContain(`--boot-title-lh: ${titleLh(30)}; /* text-3xl × 1.04 */`);
    expect(BOOT_CSS).toContain(`--boot-lede-lh: ${ledeLh(16)}; /* text-base × 1.6 */`);
    expect(scopeCss("sm")).toContain(`--boot-title-lh: ${titleLh(36)}; /* sm:text-4xl × 1.04 */`);
    const mdCss = mediaBlocks("min-width: 768px");
    expect(mdCss).toContain(
      `--boot-title-lh: ${titleLh(53.6)}; /* md:text-[3.35rem] × 1.04 (home override) */`
    );
    expect(mdCss).toContain(`--boot-title-lh: ${titleLh(48)}; /* md:text-5xl × 1.04 */`);
    expect(mdCss).toContain(`--boot-lede-lh: ${ledeLh(18)}; /* md:text-lg × 1.6 */`);
    expect(scopeCss("lg")).toContain(
      `--boot-title-lh: ${titleLh(64)}; /* lg:text-[4rem] × 1.04 (home override) */`
    );
    expect(scopeCss("lg")).toContain(`--boot-title-lh: ${titleLh(60)}; /* lg:text-6xl × 1.04 */`);
  });

  it("keeps the card composition measured from the real heroes", () => {
    // Home hero is title + lede + actions (no kicker); most banner heroes are
    // title + lede only. Line counts per band are measured from the rendered
    // heroes and documented in the boot styles.
    expect(INDEX_HTML).not.toContain("boot-skeleton-kicker");
    const titleLines = INDEX_HTML.match(
      /class="boot-skeleton boot-skeleton-title-line" data-line="\d"/g
    );
    const ledeLines = INDEX_HTML.match(
      /class="boot-skeleton boot-skeleton-lede-line" data-line="\d"/g
    );
    expect(titleLines).toHaveLength(3);
    expect(ledeLines).toHaveLength(8);
    // Measured wrap-threshold steps inside the base band (viewport px).
    for (const threshold of [348, 364, 378, 424, 488]) {
      expect(BOOT_CSS).toContain(`@media (min-width: ${threshold}px)`);
    }
    expect(BOOT_CSS).toContain("margin-top: 16px; /* mt-4 */");
    expect(BOOT_CSS).toContain("margin-top: 24px; /* mt-6 */");
    expect(BOOT_CSS).toContain("height: 44px; /* hero actions row (pill height) */");
    expect(BOOT_CSS).toContain(
      '[data-boot-hero="banner"] .boot-editorial-card .boot-skeleton-action'
    );
  });
});
