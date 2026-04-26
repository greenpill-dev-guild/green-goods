/**
 * MainSheet Tests
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

    await waitFor(() => {
      expect(screen.getByTestId("main-sheet")).toHaveAttribute("data-state", "receded");
    });

    const content = screen.getByTestId("main-sheet-content");
    expect(content.style.transition).toContain("--spring-spatial-duration");
    expect(content.style.transform).toBe("translateY(var(--canvas-recede-y, 8px))");
    expect(content.style.opacity).toBe("var(--canvas-opacity-receded, 0.95)");
    expect(content.style.filter).toBe("blur(var(--canvas-blur-receded, 1.5px))");
  });

  it("disables recession transitions when reduced motion is requested", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    render(
      <MainSheet isReceded>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet-content").style.transition).toBe("none");
  });
});
