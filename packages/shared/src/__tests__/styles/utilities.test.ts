import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const utilitiesPath = resolve(__dirname, "../../styles/utilities.css");
const utilitiesContent = readFileSync(utilitiesPath, "utf-8");
const themePath = resolve(__dirname, "../../styles/theme.css");
const themeContent = readFileSync(themePath, "utf-8");

// Also read consumer files to verify deduplication
const clientUtilitiesPath = resolve(__dirname, "../../../../client/src/styles/utilities.css");
const clientUtilities = readFileSync(clientUtilitiesPath, "utf-8");

const adminIndexPath = resolve(__dirname, "../../../../admin/src/index.css");
const adminIndex = readFileSync(adminIndexPath, "utf-8");

describe("shared utilities.css", () => {
  it("exports btn-icon class", () => {
    expect(utilitiesContent).toContain(".btn-icon");
  });

  it("exports all 8 badge-pill variants", () => {
    const variants = [
      ".badge-pill",
      ".badge-pill-blue",
      ".badge-pill-amber",
      ".badge-pill-green",
      ".badge-pill-red",
      ".badge-pill-purple",
      ".badge-pill-slate",
      ".badge-pill-emerald",
    ];
    for (const v of variants) {
      expect(utilitiesContent).toContain(v);
    }
  });

  it("exports popover styles (not duplicated in client or admin)", () => {
    expect(utilitiesContent).toContain("[popover]");
    expect(clientUtilities).not.toContain("[popover]");
    expect(adminIndex).not.toContain("[popover]");
  });

  it("exports shimmer and skeleton", () => {
    expect(utilitiesContent).toContain("@keyframes shimmer");
    expect(utilitiesContent).toContain(".skeleton");
  });

  it("exports content-visibility utilities", () => {
    expect(utilitiesContent).toContain(".cv-auto");
    expect(utilitiesContent).toContain(".cv-work-card");
    expect(utilitiesContent).toContain(".cv-garden-card");
    expect(utilitiesContent).toContain(".cv-member");
  });

  it("exports tap-feedback and tap-target-lg", () => {
    expect(utilitiesContent).toContain(".tap-feedback");
    expect(utilitiesContent).toContain(".tap-target-lg");
  });

  it("no longer ships the unused modal height utilities", () => {
    expect(utilitiesContent).not.toContain(".h-modal");
    expect(utilitiesContent).not.toContain(".max-h-modal");
  });

  it("defines the four bottom-sheet height tiers (DL-014)", () => {
    const tier = (name: string) =>
      utilitiesContent.match(new RegExp(`\\[data-sheet-size="${name}"\\]\\s*\\{([^}]*)\\}`))?.[1] ??
      "";
    expect(tier("compact")).toMatch(/height:\s*auto/);
    expect(tier("compact")).toMatch(/max-height:\s*50dvh/);
    expect(tier("half")).toMatch(/height:\s*50dvh/);
    expect(tier("tall")).toMatch(/height:\s*70dvh/);
    expect(tier("full")).toMatch(/height:\s*85dvh/);
    // The tiers sit in the utilities layer so they outrank the PwaSheet surface
    // defaults in the components layer.
    const utilitiesLayer = utilitiesContent.indexOf("@layer utilities");
    const componentsLayer = utilitiesContent.indexOf("@layer components");
    const compactRule = utilitiesContent.indexOf('[data-sheet-size="compact"]');
    expect(utilitiesLayer).toBeGreaterThanOrEqual(0);
    expect(compactRule).toBeGreaterThan(utilitiesLayer);
    expect(compactRule).toBeLessThan(componentsLayer);
  });

  it("exports native-scroll", () => {
    expect(utilitiesContent).toContain(".native-scroll");
  });

  it("exports shared runtime control and button classes from theme.css", () => {
    expect(themeContent).toContain(".gg-control");
    expect(themeContent).toContain(".gg-control-trigger");
    expect(themeContent).toContain(".gg-button");
    expect(themeContent).toContain('.gg-button[data-emphasis="secondary"]');
    expect(themeContent).not.toContain(".gg-button-secondary");
  });
});

describe("PwaSheet layout contract", () => {
  // Tailwind v4 does not scan packages/shared, so the sheet's geometry must be
  // attribute-driven CSS here rather than utility classes on the JSX.
  const rule = (slot: string) =>
    new RegExp(`\\[data-component="PwaSheet"\\]\\[data-slot="${slot}"\\]\\s*\\{([^}]*)\\}`);
  const declarations = (slot: string) => utilitiesContent.match(rule(slot))?.[1] ?? "";

  it("anchors the sheet to the viewport bottom from attribute rules", () => {
    expect(declarations("overlay")).toMatch(/position:\s*fixed/);
    expect(declarations("overlay")).toMatch(/align-items:\s*flex-end/);
    expect(declarations("overlay")).toMatch(/z-index:\s*var\(--z-modal\)/);
  });

  it("leaves every cap to the height tiers: the surface sets none of its own", () => {
    expect(declarations("surface")).toMatch(/height:\s*auto/);
    expect(declarations("surface")).not.toMatch(/max-height/);
    expect(declarations("surface")).toMatch(/border-top-left-radius:\s*var\(--radius-lg\)/);
  });

  it("tints the drag handle and locks its touch action", () => {
    expect(declarations("grip")).toMatch(/background-color:\s*rgb\(var\(--tone-primary/);
    expect(declarations("drag-handle")).toMatch(/touch-action:\s*none/);
  });

  it("ships the scrollable body under the shared header", () => {
    expect(declarations("body")).toMatch(/overflow-y:\s*auto/);
    // The header itself is the shared SheetHeader; see its contract below.
    expect(declarations("header")).toBe("");
  });
});

describe("PwaSheet motion contract", () => {
  const keyframes = (name: string) =>
    utilitiesContent.match(new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]*\\{[^}]*\\})*)`))?.[1] ??
    "";
  const stateRule = (slot: string, state: string) =>
    utilitiesContent.match(
      new RegExp(
        `\\[data-component="PwaSheet"\\]\\[data-slot="${slot}"\\]\\[data-state="${state}"\\]\\s*\\{([^}]*)\\}`
      )
    )?.[1] ?? "";

  it("slides in one move: no waypoint, no rise above rest, and no fade", () => {
    // The sheet is anchored to the viewport's bottom edge, so an overshoot
    // shows the page under it, and a fading surface shows the page through it.
    for (const name of ["dialogSlideInFromBottom", "dialogSlideOutToBottom"]) {
      expect(keyframes(name), name).toMatch(/from\s*\{/);
      expect(keyframes(name), name).not.toMatch(/\d%\s*\{/);
      expect(keyframes(name), name).not.toMatch(/translate3d\(0,\s*-/);
      expect(keyframes(name), name).not.toMatch(/opacity/);
    }
  });

  it("drags on translate, so the keyframes' transform never overrides the gesture", () => {
    expect(keyframes("dialogSlideInFromBottom")).not.toMatch(/(^|[^-])translate\s*:/);
    expect(utilitiesContent).toMatch(
      /\[data-component="PwaSheet"\]\[data-slot="surface"\]\s*\{\s*transition:\s*translate var\(--spring-spatial\);/
    );
    expect(utilitiesContent).toMatch(
      /\[data-component="PwaSheet"\]\[data-slot="drag-dim"\]\s*\{\s*transition:\s*opacity var\(--spring-spatial\);/
    );
  });

  it("accelerates a close from rest, and settles a release on that same token (DL-033)", () => {
    // The drag offset a release leaves behind and the exit keyframe share one
    // token, so the two sum to a single slide from under the finger.
    const closed = stateRule("surface", "closed");
    expect(closed).toMatch(/dialogSlideOutToBottom var\(--spring-spatial-exit-duration\)/);
    expect(closed).toMatch(/var\(--spring-spatial-exit-easing\)/);
    expect(closed).toMatch(/transition:\s*translate var\(--spring-spatial-exit\);/);
  });

  it("lets a flicked sheet leave on the decelerating token, keyframe and settle alike", () => {
    const flicked =
      utilitiesContent.match(
        /\[data-component="PwaSheet"\]\[data-flicked\] > \[data-slot="surface"\]\[data-state="closed"\]\s*\{([^}]*)\}/
      )?.[1] ?? "";
    expect(flicked).toMatch(/animation-duration:\s*var\(--spring-spatial-duration\);/);
    expect(flicked).toMatch(/animation-timing-function:\s*var\(--spring-spatial-easing\);/);
    expect(flicked).toMatch(/transition:\s*translate var\(--spring-spatial\);/);
  });

  it("keeps the exit within the close duration sheets time their unmount on", () => {
    // PwaSheet and its consumers unmount after --spring-spatial-duration, so
    // no exit may run longer than that.
    const durationMs = (token: string) =>
      Number(themeContent.match(new RegExp(`${token}:\\s*(\\d+)ms;`))?.[1] ?? Number.NaN);
    expect(durationMs("--spring-spatial-exit-duration")).toBeGreaterThan(0);
    expect(durationMs("--spring-spatial-exit-duration")).toBeLessThanOrEqual(
      durationMs("--spring-spatial-duration")
    );
    expect(themeContent).toMatch(
      /--spring-spatial-exit:\s*var\(--spring-spatial-exit-easing\) var\(--spring-spatial-exit-duration\);/
    );
  });

  it("makes the title block under the grip part of the grab area", () => {
    const dragRegion =
      utilitiesContent.match(
        /\[data-component="SheetHeader"\]\[data-slot="text"\]\[data-drag-region\]\s*\{([^}]*)\}/
      )?.[1] ?? "";
    // Without it the browser claims a vertical touch for a pan and cancels the drag.
    expect(dragRegion).toMatch(/touch-action:\s*none/);
    expect(dragRegion).toMatch(/user-select:\s*none/);
  });

  it("holds the sheet under the finger without a transition while dragging", () => {
    const dragging = utilitiesContent.match(
      /\[data-component="PwaSheet"\]\[data-dragging\] > \[data-slot="surface"\],\s*\[data-component="PwaSheet"\]\[data-dragging\] > \[data-slot="drag-dim"\]\s*\{([^}]*)\}/
    )?.[1];
    expect(dragging).toMatch(/transition:\s*none/);
  });

  it("drops the settle along with the keyframes under reduced motion", () => {
    const reducedMotion =
      utilitiesContent.match(
        /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\[data-component="PwaSheet"\]\[data-slot\][^}]*\{([^}]*)\}/
      )?.[1] ?? "";
    expect(reducedMotion).toMatch(/animation-duration:\s*0ms !important/);
    expect(reducedMotion).toMatch(/transition-duration:\s*0ms !important/);
  });
});

describe("SheetHeader anatomy contract (DL-028)", () => {
  const rule = (slot: string) =>
    new RegExp(`\\[data-component="SheetHeader"\\]\\[data-slot="${slot}"\\]\\s*\\{([^}]*)\\}`);
  const declarations = (slot: string) => utilitiesContent.match(rule(slot))?.[1] ?? "";

  it("types the title at 18/600 on a 24px line and the description at 14/400 on 20px", () => {
    expect(declarations("title")).toMatch(/font-size:\s*1\.125rem/);
    expect(declarations("title")).toMatch(/line-height:\s*1\.5rem/);
    expect(declarations("title")).toMatch(/font-weight:\s*600/);
    expect(declarations("description")).toMatch(/font-size:\s*0\.875rem/);
    expect(declarations("description")).toMatch(/line-height:\s*1\.25rem/);
  });

  it("wraps instead of clipping and draws no rule under the header", () => {
    expect(declarations("title")).toMatch(/overflow-wrap:\s*anywhere/);
    expect(declarations("description")).toMatch(/overflow-wrap:\s*anywhere/);
    expect(declarations("title")).not.toMatch(/text-overflow|white-space:\s*nowrap/);
    expect(declarations("root")).not.toMatch(/border-bottom/);
    expect(declarations("root")).toMatch(/align-items:\s*flex-start/);
  });

  it("gives every heading inside a sheet body one style: 14/600 on a 20px line, sentence case", () => {
    const heading =
      utilitiesContent.match(/\[data-component="SheetHeading"\]\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(heading).toMatch(/font-size:\s*0\.875rem/);
    expect(heading).toMatch(/line-height:\s*1\.25rem/);
    expect(heading).toMatch(/font-weight:\s*600/);
    expect(heading).toMatch(/text-transform:\s*none/);
    expect(heading).toMatch(/color:\s*rgb\(var\(--text-strong-950\)\)/);
  });

  it("keeps the close control on the shared 44px IconButton and shows a hairline only while the body scrolls", () => {
    expect(declarations("close")).toBe("");
    expect(themeContent).toMatch(
      /\.gg-icon-button\s*\{[^}]*--gg-icon-button-size:\s*var\(--gg-icon-size-md, 2\.75rem\)/
    );
    expect(utilitiesContent).toMatch(
      /\[data-scroll-edge="top"\]\s*\{[^}]*background-attachment:\s*local,\s*scroll/
    );
    expect(utilitiesContent).toMatch(/\[data-scroll-edge="both"\]/);
  });
});

describe("SheetActions layout contract (DL-016)", () => {
  const block = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return utilitiesContent.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  };

  it("stacks full-width actions in the components layer", () => {
    const componentsLayer = utilitiesContent.indexOf("@layer components");
    expect(utilitiesContent.indexOf('[data-component="SheetActions"] {')).toBeGreaterThan(
      componentsLayer
    );
    expect(block('[data-component="SheetActions"]')).toMatch(/flex-direction:\s*column/);
    expect(block('[data-component="SheetActions"] > .gg-button')).toMatch(/width:\s*100%/);
    expect(block('[data-component="SheetActions"] > .gg-button')).toMatch(/white-space:\s*normal/);
  });

  it("keeps step navigation in one row", () => {
    expect(block('[data-component="SheetActions"][data-layout="steps"]')).toMatch(
      /flex-direction:\s*row/
    );
  });

  it("becomes one right-aligned row with the primary rightmost from 640px", () => {
    const media = utilitiesContent.indexOf("@media (min-width: 40rem)");
    expect(media).toBeGreaterThan(utilitiesContent.indexOf('[data-component="SheetActions"] {'));
    const wide = utilitiesContent.slice(
      media,
      utilitiesContent.indexOf("[data-scroll-edge", media)
    );
    expect(wide).toMatch(/justify-content:\s*flex-end/);
    expect(wide).toMatch(/\[data-layout="stack"\] > \[data-action="primary"\]\s*\{\s*order:\s*2/);
  });

  it("draws the scroll-edge divider without script", () => {
    expect(block('[data-scroll-edge="bottom"]')).toMatch(
      /background-attachment:\s*local,\s*scroll/
    );
  });
});
