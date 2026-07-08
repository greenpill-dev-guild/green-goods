/**
 * MainSheet Tests
 * @vitest-environment jsdom
 *
 * MainSheet is a static surface since the QA refinement pass: it no longer
 * recedes (blur/dim/translate) when sheets open — sheets portal into
 * CanvasLayout's dedicated sheet layer and carry depth via their own scrim.
 * These tests pin the structural contract that remains.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MainSheet } from "../../components/Canvas/MainSheet";

describe("MainSheet", () => {
  it("renders children inside the content surface", () => {
    render(
      <MainSheet>
        <div data-testid="main-sheet-children">content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet-children")).toBeInTheDocument();
  });

  it("applies glass-surface class to the content surface", () => {
    render(
      <MainSheet>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet-content").className).toContain("glass-surface");
  });

  it("uses the canvas-area-main class on the outermost div", () => {
    render(
      <MainSheet>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet").className).toContain("canvas-area-main");
  });

  it("exposes design-readable slots and stays resting", () => {
    render(
      <MainSheet>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet")).toHaveAttribute("data-component", "MainSheet");
    expect(screen.getByTestId("main-sheet")).toHaveAttribute("data-state", "resting");
    expect(screen.getByTestId("main-sheet-content")).toHaveAttribute("data-slot", "surface");
  });

  it("applies no recession styles — the surface never blurs, dims, or shifts", () => {
    render(
      <MainSheet>
        <div>Content</div>
      </MainSheet>
    );

    const content = screen.getByTestId("main-sheet-content");
    expect(content.style.transform).toBe("");
    expect(content.style.opacity).toBe("");
    expect(content.style.filter).toBe("");
  });
});
