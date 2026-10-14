/**
 * @vitest-environment happy-dom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "../../test-utils";
import { CanvasRouteContent, CanvasRouteFrame } from "@/components/Layout/CanvasRouteFrame";

const readAdminCss = (file: string) => readFileSync(resolve(__dirname, "../../..", file), "utf-8");

describe("CanvasRouteFrame", () => {
  it("uses the shared full-height flex contract for admin route canvases", () => {
    render(
      <CanvasRouteFrame data-testid="route-frame">
        <CanvasRouteContent data-testid="route-content">Route content</CanvasRouteContent>
      </CanvasRouteFrame>
    );

    const frame = screen.getByTestId("route-frame");
    const content = screen.getByTestId("route-content");

    expect(frame).toHaveClass("canvas-route-card", "flex", "min-h-0", "flex-col");
    expect(content).toHaveClass("min-h-0", "w-full");
  });

  // happy-dom cannot lay a page out or match a media query, so the stylesheets are
  // the contract here: these two fail when a second side inset returns below 600px.
  it("adds no side padding below 600px and keeps its tablet and desktop steps", () => {
    const framePaddings = Array.from(
      readAdminCss("styles/admin-layout.css").matchAll(
        /\.canvas-route-card\s*{[^}]*?padding:\s*([^;]+);/g
      ),
      (match) => match[1].trim()
    );

    expect(framePaddings).toEqual([
      "0.75rem 0 1.5rem",
      "0.75rem 1.5rem 1.5rem",
      "0.75rem 2rem 1.5rem",
    ]);
  });

  it("leaves the phone gutter to the shell: one token, swapped in once", () => {
    const css = readAdminCss("index.css");
    const phoneBlock = css.match(/@media \(max-width: 599px\) {\s*:root {[^}]*}/)?.[0] ?? "";

    expect(css.match(/--admin-main-inline-gutter-mobile:/g)).toHaveLength(1);
    expect(css).toContain("--admin-main-inline-gutter-mobile: 0.75rem;");
    // The app bar row and the main scroll area both read --admin-main-inline-gutter,
    // and the width cap's 1rem margins go, so the gutter is the only side inset.
    expect(phoneBlock).toContain(
      "--admin-main-inline-gutter: var(--admin-main-inline-gutter-mobile);"
    );
    expect(phoneBlock).toContain("--admin-main-max-width: 100%;");
  });
});
