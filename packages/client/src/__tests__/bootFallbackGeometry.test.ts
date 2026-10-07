/**
 * Geometry and surface parity contract for the boot skeleton.
 *
 * The website boot fallback in index.html hand-mirrors the editorial hero and
 * site header geometry in plain CSS because it renders before Tailwind loads.
 * The installed app's loading scene mirrors the sign-in scaffold the same way,
 * so the logo and the line under it do not move when React takes over.
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
const FOCUSED_HEADER_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/Navigation/FocusedSiteHeader.tsx"),
  "utf8"
);
const THEME_SOURCE = readFileSync(resolve(process.cwd(), "../shared/src/styles/theme.css"), "utf8");
const ATOMS_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/Public/atoms/EditorialAtoms.tsx"),
  "utf8"
);
const SCAFFOLD_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/Layout/SplashScaffold.tsx"),
  "utf8"
);
const LAUNCH_ERROR_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/Errors/AppLaunchError.tsx"),
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
  source: "header" | "hero" | "focused";
  /** Annotated declarations expected in the boot CSS, per media scope. */
  boot: { css: string; scope: MediaScope }[];
}

const GEOMETRY_PAIRS: GeometryPair[] = [
  // Both heroes hold the card in the flow, at the foot, under a header clearance, so a card too
  // tall for the hero grows the hero instead of sliding under the site header.
  {
    classLiteral: "flex-col justify-end",
    source: "hero",
    boot: [
      { css: "flex-direction: column; /* flex-col */", scope: "base" },
      { css: "justify-content: flex-end; /* justify-end */", scope: "base" },
    ],
  },
  {
    classLiteral: "pt-22 sm:pt-26",
    source: "hero",
    boot: [
      { css: "padding-top: 88px; /* pt-22 */", scope: "base" },
      { css: "padding-top: 104px; /* sm:pt-26 */", scope: "sm" },
    ],
  },
  // The fullscreen hero's offset from the foot of the first viewport.
  {
    classLiteral: "pb-14 sm:pb-24 lg:pb-[12svh]",
    source: "hero",
    boot: [
      { css: "padding-bottom: 56px; /* pb-14 */", scope: "base" },
      { css: "padding-bottom: 96px; /* sm:pb-24 */", scope: "sm" },
      { css: "padding-bottom: 12svh;", scope: "lg" },
      // The recovery card stays anchored to the viewport at the same foot offsets.
      { css: "bottom: 56px; /* as pb-14 */", scope: "base" },
      { css: "bottom: 96px; /* as sm:pb-24 */", scope: "sm" },
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
  // The banner's plate height is a floor, and its card spills past the foot by a negative margin.
  {
    classLiteral: "min-h-[340px] sm:min-h-[420px] lg:min-h-[500px]",
    source: "hero",
    boot: [
      { css: "min-height: 340px; /* min-h-[340px] */", scope: "base" },
      { css: "min-height: 420px; /* sm:min-h-[420px] */", scope: "sm" },
      { css: "min-height: 500px; /* lg:min-h-[500px] */", scope: "lg" },
    ],
  },
  {
    classLiteral: "-mb-16 sm:-mb-20",
    source: "hero",
    boot: [
      { css: "margin-bottom: -64px; /* -mb-16 */", scope: "base" },
      { css: "margin-bottom: -80px; /* sm:-mb-20 */", scope: "sm" },
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
  // The reporting pages' top bar: its column, its height, and the mark's size.
  {
    classLiteral: "mx-auto grid h-20 w-full max-w-3xl",
    source: "focused",
    boot: [
      { css: "height: 80px; /* h-20 */", scope: "base" },
      { css: "max-width: 768px; /* max-w-3xl */", scope: "base" },
    ],
  },
  {
    classLiteral: "px-4 pt-[1.1875rem] sm:px-6",
    source: "focused",
    boot: [
      { css: "padding: 0 16px; /* px-4 */", scope: "base" },
      { css: "padding: 0 24px; /* sm:px-6 */", scope: "sm" },
    ],
  },
  {
    classLiteral: 'className="h-7 w-auto"',
    source: "focused",
    boot: [{ css: "height: 28px; /* h-7 */", scope: "base" }],
  },
];

/** The declarations of the first rule for a selector, in a block of CSS. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} rule in the boot styles`);
  return css.slice(start, css.indexOf("}", start));
}

interface ScenePair {
  /** Literal class string expected in the mirrored component source. */
  classLiteral: string;
  source: "scaffold" | "launch";
  /** The boot rule that mirrors it. */
  selector: string;
  /** Annotated declarations expected in that rule. */
  boot: string[];
  /** Declarations expected in the rule from 640px. */
  sm?: string[];
}

// The sign-in scaffold, slot for slot: root, block, logo, line, the two control slots, the
// message zone and the text link. The note is the one the could-not-open screen puts in slot two.
// Match Tailwind's rem units, not their 16px-default conversions: browser text settings must
// scale the static scene and React by the same amount.
const SCENE_PAIRS: ScenePair[] = [
  {
    classLiteral: "min-h-screen flex flex-col items-center bg-bg-white-0 px-4 py-2",
    source: "scaffold",
    selector: ".boot-pwa-shell",
    boot: [
      "display: flex; /* flex */",
      "flex-direction: column; /* flex-col */",
      "align-items: center; /* items-center */",
      "min-height: 100vh; /* min-h-screen */",
      "padding: 0.5rem 1rem; /* py-2 px-4 */",
    ],
  },
  {
    classLiteral: "flex w-full max-w-sm flex-col items-center",
    source: "scaffold",
    selector: ".boot-pwa-content",
    boot: ["width: 100%; /* w-full */", "max-width: 24rem; /* max-w-sm */"],
  },
  {
    classLiteral: "flex-shrink-0 mb-4",
    source: "scaffold",
    selector: ".boot-pwa-logo-slot",
    boot: ["margin-bottom: 1rem; /* mb-4 */"],
  },
  {
    classLiteral: "h-24 w-auto sm:h-28",
    source: "scaffold",
    selector: ".boot-pwa-content img",
    boot: ["width: auto; /* w-auto */", "height: 6rem; /* h-24 */"],
    sm: ["height: 7rem; /* sm:h-28 */"],
  },
  {
    classLiteral: "h-8 flex items-center justify-center mb-5",
    source: "scaffold",
    selector: ".boot-pwa-message-slot",
    boot: ["height: 2rem; /* h-8 */", "margin-bottom: 1.25rem; /* mb-5 */"],
  },
  {
    classLiteral: "text-base font-[650] text-text-strong-950",
    source: "scaffold",
    selector: ".boot-pwa-message-slot p",
    boot: ["font-size: 1rem; /* text-base */", "font-weight: 650; /* font-[650] */"],
  },
  {
    classLiteral: "w-full flex flex-col items-center gap-3",
    source: "scaffold",
    selector: ".boot-pwa-stack",
    boot: ["gap: 0.75rem; /* gap-3 */"],
  },
  {
    classLiteral: "w-full h-11 flex items-center justify-center",
    source: "scaffold",
    selector: ".boot-pwa-note-slot",
    boot: ["height: 2.75rem; /* h-11 */"],
  },
  {
    classLiteral: "relative w-full h-20 overflow-y-auto",
    source: "scaffold",
    selector: ".boot-pwa-zone",
    boot: ["height: 5rem; /* h-20: sign-in's message zone */"],
  },
  {
    classLiteral: "h-5 flex items-center justify-center",
    source: "scaffold",
    selector: ".boot-pwa-link",
    boot: ["height: 1.25rem; /* h-5: sign-in's text link */"],
  },
  {
    classLiteral: "w-full self-start pt-1 text-center text-sm leading-5 text-text-sub-600",
    source: "launch",
    selector: ".boot-pwa-note-slot p",
    boot: [
      "padding-top: 0.25rem; /* pt-1 */",
      "font-size: 0.875rem; /* text-sm */",
      "line-height: 1.25rem; /* leading-5 */",
    ],
  },
];

describe("installed app loading scene parity", () => {
  it.each(SCENE_PAIRS)("keeps $selector in step with the $source's $classLiteral", (pair) => {
    expect(pair.source === "launch" ? LAUNCH_ERROR_SOURCE : SCAFFOLD_SOURCE).toContain(
      pair.classLiteral
    );
    const rule = ruleBody(BOOT_CSS, pair.selector);
    for (const declaration of pair.boot) expect(rule).toContain(declaration);
    if (pair.sm) {
      const smRule = ruleBody(mediaBlocks("min-width: 40rem"), pair.selector);
      for (const declaration of pair.sm) expect(smRule).toContain(declaration);
    }
  });

  it("gives both control slots one rule, so they can never differ in height", () => {
    expect(BOOT_CSS).toMatch(/\n {6}\.boot-pwa-action-slot,\n {6}\.boot-pwa-note-slot \{/);
  });

  it("splits the free space 11:9 above and below the block, as the scaffold does", () => {
    expect(SCAFFOLD_SOURCE).toContain("style={{ flexGrow: 11 }}");
    expect(SCAFFOLD_SOURCE).toContain('style={{ flexGrow: 9, flexBasis: "calc(20px * 20 / 11)" }}');
    expect(ruleBody(BOOT_CSS, ".boot-pwa-shell::before")).toContain("flex-grow: 11;");
    expect(ruleBody(BOOT_CSS, ".boot-pwa-shell::after")).toContain("flex-grow: 9;");
    expect(ruleBody(BOOT_CSS, ".boot-pwa-shell::after")).toContain(
      "flex-basis: calc(20px * 20 / 11);"
    );
  });

  it("lays the scene out in the scaffold's order: logo, line, action, note, zone, link", () => {
    expect(INDEX_HTML).toMatch(
      /class="boot-pwa-content">\s*<div class="boot-pwa-logo-slot"[^>]*>[\s\S]*?<\/div>\s*<div class="boot-pwa-message-slot"[^>]*>[\s\S]*?<\/div>\s*<div class="boot-pwa-stack">\s*<div class="boot-pwa-action-slot"[^>]*>[\s\S]*?<\/div>\s*<div class="boot-pwa-note-slot"[^>]*>[\s\S]*?<\/div>\s*<div class="boot-pwa-zone"[^>]*><\/div>\s*<div class="boot-pwa-link"[^>]*><\/div>/
    );
  });
});

describe("boot skeleton geometry parity", () => {
  it.each(GEOMETRY_PAIRS)("keeps the $source $classLiteral pair in sync", (pair) => {
    const source =
      pair.source === "hero"
        ? HERO_SOURCE
        : pair.source === "focused"
          ? FOCUSED_HEADER_SOURCE
          : HEADER_SOURCE;
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

  it("keeps the hero's rail in the flow so a card too tall for the hero grows it", () => {
    // Only the rail inside the hero joins the flow. The recovery rail keeps the absolute base rule.
    expect(BOOT_CSS).toMatch(
      /\n {6}\.boot-editorial-hero \.boot-editorial-card-rail \{\s*position: relative;\s*bottom: auto;\s*\}/
    );
    // The banner leaves its rail in that flow, over a plate whose height is only a floor: a rail
    // pinned to the foot of a fixed-height plate is what let a tall card climb under the header.
    const banner = BOOT_CSS.slice(
      BOOT_CSS.indexOf("/* Banner-variant skeleton"),
      BOOT_CSS.indexOf("/* Focused variant")
    );
    expect(banner).toContain("min-height: 340px; /* min-h-[340px] */");
    expect(banner).not.toMatch(/position:\s*absolute/);
    expect(banner).not.toMatch(/(?<!min-)height:/);
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
    // A title left to wrap drops its third bar from 378px. The five pages whose English title
    // is written as three lines keep it, and no other page or language does.
    expect(mediaBlocks("min-width: 378px")).toMatch(
      /\n {8}\.boot-skeleton-title-line\[data-line="3"\] \{\s*display: none;\s*\}\s*\[data-boot-title="three-lines"\] #boot-fallback\[lang="en"\] \.boot-skeleton-title-line\[data-line="3"\] \{\s*display: block;/
    );
    expect(BOOT_CSS).toContain("margin-top: 16px; /* mt-4 */");
    expect(BOOT_CSS).toContain("margin-top: 24px; /* mt-6 */");
    expect(BOOT_CSS).toContain("height: 44px; /* hero actions row (pill height) */");
    expect(BOOT_CSS).toContain(
      '[data-boot-hero="banner"] .boot-editorial-card .boot-skeleton-action'
    );
  });
});
