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

  it("exports modal height utilities", () => {
    expect(utilitiesContent).toContain(".h-modal");
    expect(utilitiesContent).toContain(".max-h-modal");
    expect(utilitiesContent).toContain(".max-h-sheet");
  });

  it("exports native-scroll", () => {
    expect(utilitiesContent).toContain(".native-scroll");
  });

  it("exports shared runtime control and button classes from theme.css", () => {
    expect(themeContent).toContain(".gg-control");
    expect(themeContent).toContain(".gg-control-trigger");
    expect(themeContent).toContain(".gg-button");
    expect(themeContent).toContain(".gg-button-secondary");
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

  it("sizes the surface to its content with an 85dvh cap", () => {
    expect(declarations("surface")).toMatch(/height:\s*auto/);
    expect(declarations("surface")).toMatch(/max-height:\s*85dvh/);
    expect(declarations("surface")).toMatch(/border-top-left-radius:\s*var\(--radius-lg\)/);
  });

  it("tints the drag handle and locks its touch action", () => {
    expect(declarations("grip")).toMatch(/background-color:\s*rgb\(var\(--tone-primary/);
    expect(declarations("drag-handle")).toMatch(/touch-action:\s*none/);
  });

  it("ships the shared header and scrollable body", () => {
    expect(declarations("header")).toMatch(/display:\s*flex/);
    expect(declarations("close")).toMatch(/width:\s*2\.75rem/);
    expect(declarations("body")).toMatch(/overflow-y:\s*auto/);
  });
});
