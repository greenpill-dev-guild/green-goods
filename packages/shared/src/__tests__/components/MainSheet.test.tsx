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

  it("recedes the main sheet content when the shell marks it as receded", () => {
    render(
      <MainSheet isReceded={true}>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet-content")).toHaveStyle({
      transform: "translateY(8px) scale(var(--canvas-scale-receded))",
    });
  });

  it("uses the shared main-sheet frame class for pane margins", () => {
    render(
      <MainSheet isReceded={false}>
        <div>Content</div>
      </MainSheet>
    );

    expect(screen.getByTestId("main-sheet").className).toContain("canvas-main-sheet-frame");
  });

  it("recedes the main sheet content when a bounded overlay is active", async () => {
    render(
      <MainSheet isReceded={false}>
        <OverlayActivator active={true} />
      </MainSheet>
    );

    await waitFor(() => {
      expect(screen.getByTestId("main-sheet-content")).toHaveStyle({
        transform: "translateY(8px) scale(var(--canvas-scale-receded))",
      });
    });
  });
});
