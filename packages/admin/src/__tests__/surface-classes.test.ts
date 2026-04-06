import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const viewsDir = resolve(__dirname, "../views");

function readView(relativePath: string): string {
  return readFileSync(resolve(viewsDir, relativePath), "utf-8");
}

/**
 * Raw surface recipe — the Tailwind class string that surface primitives replace.
 * Any remaining instance means the migration is incomplete.
 */
const RAW_SURFACE_RECIPE =
  /rounded-(?:lg|xl) border border-stroke-soft bg-bg-white p-(?:4|6) shadow-sm/;

describe("surface class adoption", () => {
  it("HypercertDetail sections use surface-inset class", () => {
    const content = readView("Gardens/Garden/HypercertDetail.tsx");
    expect(content).toContain("surface-inset");
    expect(content).not.toMatch(RAW_SURFACE_RECIPE);
  });

  it("Endowments sections use surface-section class", () => {
    const content = readView("Endowments/index.tsx");
    expect(content).toContain("surface-section");
    expect(content).not.toMatch(RAW_SURFACE_RECIPE);
  });

  it("ProtocolYieldSummary uses surface-section class", () => {
    const content = readView("Endowments/ProtocolYieldSummary.tsx");
    expect(content).toContain("surface-section");
    expect(content).not.toMatch(RAW_SURFACE_RECIPE);
  });

  it("MyPositionsSection uses surface-section class", () => {
    const content = readView("Endowments/MyPositionsSection.tsx");
    expect(content).toContain("surface-section");
    expect(content).not.toMatch(RAW_SURFACE_RECIPE);
  });

  it("Dashboard cards use surface-card class", () => {
    const content = readView("Dashboard/index.tsx");
    expect(content).toContain("surface-card");
  });

  it("Strategies items use surface-inset class", () => {
    const content = readView("Gardens/Garden/Strategies.tsx");
    expect(content).toContain("surface-inset");
    expect(content).not.toMatch(RAW_SURFACE_RECIPE);
  });

  it("Vault items use surface-inset class", () => {
    const content = readView("Gardens/Garden/Vault.tsx");
    expect(content).toContain("surface-inset");
    expect(content).not.toMatch(RAW_SURFACE_RECIPE);
  });

  it("SignalPool items use surface-inset class", () => {
    const content = readView("Gardens/Garden/SignalPool.tsx");
    expect(content).toContain("surface-inset");
    expect(content).not.toMatch(RAW_SURFACE_RECIPE);
  });

  it("Hypercerts items use surface classes", () => {
    const content = readView("Gardens/Garden/Hypercerts.tsx");
    expect(content).toMatch(/surface-(?:section|inset)/);
    expect(content).not.toMatch(RAW_SURFACE_RECIPE);
  });
});
