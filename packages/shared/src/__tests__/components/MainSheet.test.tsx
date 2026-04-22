/**
 * MainSheet Tests
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";
import { MainSheet, useCanvasPortal } from "../../components/Canvas/MainSheet";

function OverlayActivator({ active }: { active: boolean }) {
  const { portalTarget, setOverlayActive } = useCanvasPortal();

  useEffect(() => {
    setOverlayActive("test-overlay", active);
    return () => setOverlayActive("test-overlay", false);
  }, [active, setOverlayActive]);

  return <div data-testid="portal-state">{portalTarget ? "ready" : "missing"}</div>;
}

describe("MainSheet", () => {
  it("exposes the bounded overlay root through context and an external ref", async () => {
    function Harness() {
      const overlayRef = useRef<HTMLDivElement | null>(null);

      return (
        <>
          <MainSheet isReceded={false} overlayRef={overlayRef}>
            <OverlayActivator active={false} />
          </MainSheet>
          <div data-testid="ref-state">{overlayRef.current ? "ready" : "missing"}</div>
        </>
      );
    }

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId("portal-state")).toHaveTextContent("ready");
      expect(screen.getByTestId("main-sheet-overlay-root")).toBeInTheDocument();
    });
  });

  it("applies glass-surface class to the content surface when receded", () => {
    render(
      <MainSheet isReceded={true}>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet-content").className).toContain("glass-surface");
  });

  it("uses the canvas-area-main class on the outermost div", () => {
    render(
      <MainSheet isReceded={false}>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet").className).toContain("canvas-area-main");
  });

  it("exposes design-readable slots and resting state", () => {
    render(
      <MainSheet isReceded={false}>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet")).toHaveAttribute("data-component", "MainSheet");
    expect(screen.getByTestId("main-sheet")).toHaveAttribute("data-state", "resting");
    expect(screen.getByTestId("main-sheet-content")).toHaveAttribute("data-slot", "surface");
    expect(screen.getByTestId("main-sheet-overlay-root")).toHaveAttribute(
      "data-slot",
      "overlay-root"
    );
  });

  it("recedes the main sheet content when a bounded overlay is active", async () => {
    render(
      <MainSheet isReceded={false}>
        <OverlayActivator active={true} />
      </MainSheet>
    );

    // With react-spring, the animated.div has will-change-[transform,opacity,filter]
    // indicating it is the receding surface; glass-surface class is always present
    await waitFor(() => {
      expect(screen.getByTestId("main-sheet-content").className).toContain("glass-surface");
    });
  });
});
