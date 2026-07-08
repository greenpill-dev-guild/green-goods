/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "../../test-utils";
import { CanvasRouteContent, CanvasRouteFrame } from "@/components/Layout/CanvasRouteFrame";

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
});
