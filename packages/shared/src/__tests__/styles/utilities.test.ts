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
